-- V3 — GND Website'e uye olanlari otomatik lead'e cevirir.
-- Website'de biri kayit olunca marketplace_events'e "registration" satiri
-- dusuyor (email/ad_soyad/telefon ile birlikte); bu trigger o satiri
-- yakalayip otomatik olarak firma+kisi+iletisim+lead olusturur.
-- Anonim (anon) rolu companies/leads gibi tablolara yazamadigi icin fonksiyon
-- "security definer" ile calisiyor (tablo sahibinin yetkisiyle, kontrollu).

create or replace function handle_marketplace_registration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_ad_soyad text;
  v_telefon text;
  v_email_norm text;
  v_company_id bigint;
  v_contact_id bigint;
begin
  if new.event_type <> 'registration' then
    return new;
  end if;

  v_email := nullif(trim(new.metadata->>'email'), '');
  v_ad_soyad := nullif(trim(new.metadata->>'ad_soyad'), '');
  v_telefon := nullif(trim(new.metadata->>'telefon'), '');

  if v_email is null then
    return new; -- email yoksa anlamli bir lead olusturulamaz
  end if;
  v_email_norm := lower(v_email);

  -- Ayni email zaten bir firmaya bagliysa (daha once import/marketplace'ten
  -- gelmis olabilir) o firmayi kullan, tekrar olusturma.
  select company_id, contact_id into v_company_id, v_contact_id
  from contact_methods
  where value_normalized = v_email_norm
  limit 1;

  if v_company_id is null then
    insert into companies (name_original, name_searchable, data_source, verification_status, notes)
    values (coalesce(v_ad_soyad, v_email), coalesce(v_ad_soyad, v_email), 'gnd_website_registration', 'unverified', 'GND Website üzerinden kayıt oldu')
    returning id into v_company_id;

    insert into contacts (company_id, person_name, status)
    values (v_company_id, v_ad_soyad, 'Gönderilmedi')
    returning id into v_contact_id;

    insert into contact_methods (company_id, contact_id, type, value_original, value_normalized, is_primary)
    values (v_company_id, v_contact_id, 'email', v_email, v_email_norm, true)
    on conflict do nothing;

    if v_telefon is not null then
      insert into contact_methods (company_id, contact_id, type, value_original, value_normalized, is_primary)
      values (v_company_id, v_contact_id, 'phone', v_telefon, regexp_replace(v_telefon, '[^0-9+]', '', 'g'), false)
      on conflict do nothing;
    end if;
  end if;

  insert into leads (company, contact, country, sector, product_type, product, value, stage, email, phone, notes, company_id, contact_id)
  values (coalesce(v_ad_soyad, v_email), coalesce(v_ad_soyad, ''), 'Türkiye', 'Diğer', 'Yeni Makine', 'GND Website Kaydı', 0, 'Lead', v_email, v_telefon, 'GND Website üzerinden otomatik oluşturuldu (kayıt).', v_company_id, v_contact_id);

  return new;
end;
$$;

drop trigger if exists trg_marketplace_registration on marketplace_events;
create trigger trg_marketplace_registration
  after insert on marketplace_events
  for each row
  execute function handle_marketplace_registration();
