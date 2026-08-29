-- GND OS V1 — Operasyon Paketi migration
-- Bu dosyayı Supabase SQL Editor'de calistir. Tekrar calistirmak guvenlidir
-- (hepsi "if not exists" / "if exists" ile korunuyor).

-- 1) Takip (follow-up) sistemi icin contacts tablosuna tarih alani
alter table contacts add column if not exists followup_date date;
create index if not exists idx_contacts_followup_date on contacts(followup_date);

-- 2) Firmalar icin soft-delete (yanlislikla veri kaybini onlemek icin,
--    gercekten DELETE atmiyoruz, sadece gizliyoruz)
alter table companies add column if not exists deleted_at timestamptz;
create index if not exists idx_companies_deleted_at on companies(deleted_at);

-- 3) Ayni kisiye ayni gun iki kez "gonderildi" yazilamasin (DB seviyesinde guvenlik)
alter table outbound_messages add column if not exists sent_date date
  generated always as ((sent_at at time zone 'utc')::date) stored;
create unique index if not exists uq_outbound_sent_per_day
  on outbound_messages(contact_method_id, sent_date) where status = 'sent';

-- 4) Import gecmisi (Import Center'da her yuklemenin sonuc raporu saklansin)
create table if not exists import_batches (
  id bigint generated always as identity primary key,
  file_name text,
  imported_by uuid,
  imported_by_email text,
  total_rows int default 0,
  new_count int default 0,
  updated_count int default 0,
  duplicate_count int default 0,
  error_count int default 0,
  error_rows jsonb,
  created_at timestamptz not null default now()
);

alter table import_batches enable row level security;
drop policy if exists "import_batches_all_authenticated" on import_batches;
create policy "import_batches_all_authenticated" on import_batches
  for all to authenticated using (true) with check (true);

-- 5) companies uzerinde ayni firmayi tekrar tekrar olusturmamak icin
--    name_searchable + country ikilisine indeks (import sirasinda hizli arama)
create index if not exists idx_companies_search_country on companies(name_searchable, country);
