-- V2 — Production Hardening: 100.000+ kayit icin index'ler.
-- Sadece eksik olan, gercekten kullanilan filtreler icin index ekleniyor.
-- Hicbir tablo/veri silinmiyor, hepsi "if not exists" ile guvenli.

-- contacts: firma bazli sorgular + Send Queue/Contacts/Dashboard status filtreleri
create index if not exists idx_contacts_company_id on contacts(company_id);
create index if not exists idx_contacts_status on contacts(status);

-- contact_methods: firma/kisi bazli sorgular (CompanyDetail, kampanya hedefleme, import dedup)
create index if not exists idx_contact_methods_company_id on contact_methods(company_id);
create index if not exists idx_contact_methods_contact_id on contact_methods(contact_id);

-- activity_log: Activity ekrani ve Dashboard "bugun" sorgulari
create index if not exists idx_activity_log_company_id on activity_log(company_id);
create index if not exists idx_activity_log_occurred_at on activity_log(occurred_at);
create index if not exists idx_activity_log_action on activity_log(action);
create index if not exists idx_activity_log_campaign_id on activity_log(campaign_id);

-- outbound_messages: Send Queue sekmeleri + ilerleme sayaclari
create index if not exists idx_outbound_messages_campaign_target_id on outbound_messages(campaign_target_id);
create index if not exists idx_outbound_messages_contact_method_id on outbound_messages(contact_method_id);
create index if not exists idx_outbound_messages_status on outbound_messages(status);

-- campaign_targets: firma bazli kampanya gecmisi (CompanyDetail)
create index if not exists idx_campaign_targets_company_id on campaign_targets(company_id);

-- leads: CRM/Dashboard'da stage ve tarih bazli filtreler
create index if not exists idx_leads_stage on leads(stage);
create index if not exists idx_leads_created_at on leads(created_at);

-- Firma adi aramasi (ilike '%metin%') 100.000+ satirda hizli kalsin diye
-- trigram index. Mevcut btree index'e dokunulmuyor, ek olarak ekleniyor.
create extension if not exists pg_trgm;
create index if not exists idx_companies_name_searchable_trgm on companies using gin (name_searchable gin_trgm_ops);
