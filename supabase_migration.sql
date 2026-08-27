-- ============================================================================
-- GND OS — Veritabanı Migration
-- Supabase Dashboard > SQL Editor > yapıştır > Run.
-- Tekrar çalıştırmak güvenlidir (DROP IF EXISTS / IF NOT EXISTS kullanılıyor).
-- Hiçbir mevcut satır silinmez. leads tablosundaki 1.982+ kayıt korunur.
-- ============================================================================


-- ============================================================================
-- FAZ 0 — GÜVENLİK (şimdi aktif edilecek)
-- ============================================================================

-- 0.1) leads tablosunda anon (herkese açık) yazma yetkisini kapat.
-- Şu ana kadar anon anahtarla insert/update/delete serbestti — artık sadece
-- giriş yapmış (authenticated) kullanıcı yazabilir. Okuma da authenticated'e
-- taşınıyor (anon SELECT açık bırakılmıyor, çünkü GNDOS herkese açık bir
-- ürün değil, sadece Duran'ın kullandığı iç araç).

alter table leads enable row level security;

drop policy if exists "leads_select_authenticated" on leads;
create policy "leads_select_authenticated"
on leads for select
to authenticated
using (true);

drop policy if exists "leads_insert_authenticated" on leads;
create policy "leads_insert_authenticated"
on leads for insert
to authenticated
with check (true);

drop policy if exists "leads_update_authenticated" on leads;
create policy "leads_update_authenticated"
on leads for update
to authenticated
using (true) with check (true);

drop policy if exists "leads_delete_authenticated" on leads;
create policy "leads_delete_authenticated"
on leads for delete
to authenticated
using (true);

-- 0.2) audit_log — kim, ne zaman, hangi kaydı değiştirdi.
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  actor_user_id uuid,
  actor_email text,
  action text not null,            -- insert / update / delete / login
  table_name text,
  record_id text,
  before jsonb,
  after jsonb,
  occurred_at timestamptz not null default now()
);

alter table audit_log enable row level security;

drop policy if exists "audit_log_select_authenticated" on audit_log;
create policy "audit_log_select_authenticated"
on audit_log for select
to authenticated
using (true);

drop policy if exists "audit_log_insert_authenticated" on audit_log;
create policy "audit_log_insert_authenticated"
on audit_log for insert
to authenticated
with check (true);

create index if not exists idx_audit_log_occurred_at on audit_log(occurred_at desc);
create index if not exists idx_audit_log_table_record on audit_log(table_name, record_id);


-- ============================================================================
-- FAZ 1 — COMPANY / CONTACT / LEAD AYRIMI (şema hazır, veri taşıma ayrı adım)
-- ============================================================================

create table if not exists companies (
  id bigint generated always as identity primary key,
  gnd_id text unique,
  name_original text not null,
  name_searchable text,
  country text,
  city text,
  region text,
  iso_code text,
  company_type text,
  sector text,
  sub_sector text,
  website text,
  website_domain text,
  address text,
  source_url text,
  data_source text,
  description text,
  product_interest text[],
  verified_at timestamptz,
  verification_status text default 'unverified',
  lead_score int default 0,
  owner_user_id uuid,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_companies_country_sector on companies(country, sector);
create index if not exists idx_companies_name_searchable on companies(name_searchable);
create unique index if not exists uq_companies_website_domain on companies(website_domain) where website_domain is not null;

create table if not exists contacts (
  id bigint generated always as identity primary key,
  company_id bigint references companies(id) on delete cascade,
  person_name text,
  role text,
  last_contact_at timestamptz,
  last_contact_channel text,
  last_campaign_id bigint,
  last_message_template text,
  contact_count int default 0,
  last_response_at timestamptz,
  status text default 'Gönderilmedi',
  created_at timestamptz not null default now()
);

create index if not exists idx_contacts_company_id on contacts(company_id);

-- 4) contact_methods — firma seviyesinde genel iletişim bilgisi (info@firma.com,
-- santral telefonu gibi) kişiye bağlı olmak zorunda değil, bu yüzden contact_id
-- nullable. Normalizasyon ve duplicate kontrolü bu tabloda yapılır.
create table if not exists contact_methods (
  id bigint generated always as identity primary key,
  company_id bigint not null references companies(id) on delete cascade,
  contact_id bigint references contacts(id) on delete set null,
  type text not null check (type in ('phone','whatsapp','email')),
  value_original text not null,
  value_normalized text not null,
  is_primary boolean default false,
  status text default 'active',
  created_at timestamptz not null default now()
);

create unique index if not exists uq_contact_methods_phone
  on contact_methods(value_normalized) where type in ('phone','whatsapp');
create unique index if not exists uq_contact_methods_email
  on contact_methods(value_normalized) where type = 'email';
create index if not exists idx_contact_methods_company on contact_methods(company_id);

-- Mevcut leads tablosuna yeni bağlantı sütunları (id'ler korunur).
alter table leads add column if not exists company_id bigint references companies(id);
alter table leads add column if not exists contact_id bigint references contacts(id);
create index if not exists idx_leads_company_id on leads(company_id);
create index if not exists idx_leads_contact_id on leads(contact_id);


-- ============================================================================
-- FAZ 3 — ACTIVITY LOG (append-only, günlük kilit YOK — düzeltme #1)
-- ============================================================================

create table if not exists activity_log (
  id bigint generated always as identity primary key,
  company_id bigint references companies(id),
  contact_id bigint references contacts(id),
  lead_id bigint references leads(id),
  campaign_id bigint,
  channel text,                 -- whatsapp / email / facebook / phone / site
  action text not null,         -- sent / delivered / read / failed / replied / registered / ...
  result text,
  actor_user_id uuid,
  metadata jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_activity_log_company on activity_log(company_id, occurred_at desc);
create index if not exists idx_activity_log_contact on activity_log(contact_id, occurred_at desc);
create index if not exists idx_activity_log_campaign on activity_log(campaign_id);

alter table activity_log enable row level security;
drop policy if exists "activity_log_all_authenticated" on activity_log;
create policy "activity_log_all_authenticated"
on activity_log for all
to authenticated
using (true) with check (true);


-- ============================================================================
-- FAZ 4 — CAMPAIGN CENTER + OUTBOUND MESSAGES + PG QUEUE (düzeltme #2,3,6)
-- ============================================================================

create table if not exists campaigns (
  id bigint generated always as identity primary key,
  name text not null,
  channel text not null,        -- whatsapp / email
  filter_json jsonb,
  message_template text,
  language text default 'tr',
  status text default 'draft',  -- draft / active / paused / completed
  created_by uuid,
  created_at timestamptz not null default now()
);

-- campaign_targets = SADECE üyelik (kişi bu kampanyaya dahil edildi).
-- Gerçek gönderim outbound_messages'ta, bire çok ilişki (ilk mesaj + follow-up'lar).
create table if not exists campaign_targets (
  id bigint generated always as identity primary key,
  campaign_id bigint not null references campaigns(id) on delete cascade,
  contact_method_id bigint references contact_methods(id),
  company_id bigint references companies(id),
  added_at timestamptz not null default now(),
  unique (campaign_id, contact_method_id)
);

create index if not exists idx_campaign_targets_campaign on campaign_targets(campaign_id);

-- outbound_messages = HER gerçek gönderim burada tek satır.
-- idempotency_key UNIQUE: aynı mesaj iki worker tarafından iki kez gönderilemez.
create table if not exists outbound_messages (
  id bigint generated always as identity primary key,
  campaign_target_id bigint references campaign_targets(id),
  contact_method_id bigint not null references contact_methods(id),
  channel text not null,
  template text,
  sequence_step text default 'initial',  -- initial / follow_up_3d / follow_up_7d / follow_up_14d
  idempotency_key text not null unique,
  status text not null default 'queued', -- queued/sending/sent/delivered/read/failed/dead_letter
  provider_message_id text,
  retry_count int not null default 0,
  next_attempt_at timestamptz default now(),
  locked_at timestamptz,
  locked_by text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  replied_at timestamptz
);

create index if not exists idx_outbound_messages_status_next
  on outbound_messages(status, next_attempt_at)
  where status in ('queued','sending');
create index if not exists idx_outbound_messages_contact_method on outbound_messages(contact_method_id);

-- Suppression — kalıcı "iletişim istemiyor" listesi (düzeltme #8).
-- Import tekrar yapılsa bile worker göndermeden önce burayı kontrol eder.
create table if not exists suppressions (
  id bigint generated always as identity primary key,
  contact_method_id bigint references contact_methods(id),
  company_id bigint references companies(id),
  do_not_contact boolean not null default true,
  channel text,                 -- null = tüm kanallar
  opt_out_at timestamptz not null default now(),
  reason text
);

create index if not exists idx_suppressions_contact_method on suppressions(contact_method_id);


-- ============================================================================
-- FAZ 7 — MARKETPLACE CONVERSION TRACKING (düzeltme #9)
-- ============================================================================

create table if not exists marketplace_events (
  id bigint generated always as identity primary key,
  visitor_ref text,             -- gndmachinery.com tarafında üretilen, ziyaret boyunca saklanan referral id
  campaign_id bigint references campaigns(id),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  event_type text not null,     -- website_visit / registration / listing_created / request_created / lead_created / quote_created / sale
  company_id bigint references companies(id),
  contact_method_id bigint references contact_methods(id),
  metadata jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_marketplace_events_visitor on marketplace_events(visitor_ref);
create index if not exists idx_marketplace_events_campaign on marketplace_events(campaign_id);

alter table marketplace_events enable row level security;
drop policy if exists "marketplace_events_insert_service" on marketplace_events;
create policy "marketplace_events_insert_service"
on marketplace_events for insert
to authenticated
with check (true);
drop policy if exists "marketplace_events_select_authenticated" on marketplace_events;
create policy "marketplace_events_select_authenticated"
on marketplace_events for select
to authenticated
using (true);
