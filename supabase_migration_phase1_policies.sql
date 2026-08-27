-- ============================================================================
-- GND OS — Faz 1+ tabloları için authenticated policy'ler
-- Bu tablolar RLS açık geldi ama hiç policy yoktu (hiç kimse yazamıyordu).
-- Şimdilik: giriş yapmış herhangi bir kullanıcı okuyup yazabilir (tek kullanıcı
-- olduğun için yeterli; çok kullanıcılı olunca owner bazlı kısıtlama eklenir).
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array['companies','contacts','contact_methods','campaigns','campaign_targets','outbound_messages','suppressions']
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "%1$s_all_authenticated" on %1$I;', t);
    execute format(
      'create policy "%1$s_all_authenticated" on %1$I for all to authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;
