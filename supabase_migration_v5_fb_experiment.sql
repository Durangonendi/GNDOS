-- V5 — Facebook grup dagitim deneyi (120 grup "kontrol" vs az-ama-kaliteli "test")
-- Basit, tek-satirlik gunluk kayit: tarih + bucket + grup sayisi + toplam
-- goruntulenme. Grup isimlerini tek tek tutmuyoruz — deneyin cevaplamaya
-- calistigi soru "hacim mi kalite mi daha iyi" oldugu icin gunluk agregat
-- yeterli, hangi spesifik grubun calistigi sorusu su an sorulmuyor.

create table if not exists fb_experiment_days (
  id bigint generated always as identity primary key,
  log_date date not null,
  bucket text not null check (bucket in ('control','test')),
  group_count int,
  total_views int,
  notes text,
  created_at timestamptz not null default now(),
  unique(log_date, bucket)
);

alter table fb_experiment_days enable row level security;
drop policy if exists "fb_experiment_days_all_authenticated" on fb_experiment_days;
create policy "fb_experiment_days_all_authenticated" on fb_experiment_days for all to authenticated using (true) with check (true);
