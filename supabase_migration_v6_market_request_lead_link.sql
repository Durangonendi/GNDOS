-- V6 — market_requests -> leads donusumunun kalicilastirilmasi.
-- Onceden "Lead'e Donustur" tiklandiginda sonuc yalnizca tarayici hafizasinda
-- (React state) tutuluyordu; sayfa yenilenince kayboluyor, ayni ilan tekrar
-- "Lead'e Donustur" gosteriyordu ve tekrar tiklanirsa mukerrer lead olusabiliyordu.

alter table market_requests add column if not exists converted_lead_id bigint references leads(id);
