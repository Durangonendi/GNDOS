-- V5 — Facebook grup dagitim deneyi (120 grup "kontrol" vs az-ama-kaliteli "test")
-- Faz 7'de tanimlanan social_groups/social_queue tablolarina, bu 1 haftalik
-- A/B testi icin gereken kolonlari ekliyor.

alter table social_groups add column if not exists experiment_bucket text;
alter table social_queue add column if not exists views int;
alter table social_queue add column if not exists content_variant text;
