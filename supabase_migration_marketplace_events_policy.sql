-- Faz 7 — marketplace_events RLS
-- Bu tabloya gndmachinery.com (gnd-website) ANONİM ziyaretçilerden yazılıyor,
-- bu yüzden anon rolüne SADECE insert izni veriyoruz (okuma/güncelleme/silme yok).
-- GNDOS tarafında (authenticated) okuma serbest, ki dashboard'da funnel görülebilsin.

alter table marketplace_events enable row level security;

drop policy if exists "marketplace_events_anon_insert" on marketplace_events;
create policy "marketplace_events_anon_insert" on marketplace_events
  for insert to anon
  with check (true);

drop policy if exists "marketplace_events_authenticated_read" on marketplace_events;
create policy "marketplace_events_authenticated_read" on marketplace_events
  for select to authenticated
  using (true);
