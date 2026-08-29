-- V1 Bolum 7 (Toplu Veri Yonetimi) icin: firmalara etiket ekleme/kaldirma.
alter table companies add column if not exists tags text[];
create index if not exists idx_companies_tags on companies using gin(tags);
