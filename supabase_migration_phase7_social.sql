-- Faz 7 — Publishing / Distribution Center tabloları

create table if not exists social_groups (
  id bigint generated always as identity primary key,
  name text not null,
  url text,
  country text,
  category text,
  est_members int,
  active boolean default true,
  last_shared_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists social_queue (
  id bigint generated always as identity primary key,
  content text,
  media_url text,
  channel text not null,        -- facebook_group / facebook_page / instagram / linkedin / youtube
  target_group_id bigint references social_groups(id),
  scheduled_at timestamptz default now(),
  status text default 'pending', -- pending / shared / skipped
  shared_by uuid,
  shared_at timestamptz,
  created_at timestamptz not null default now()
);

alter table social_groups enable row level security;
drop policy if exists "social_groups_all_authenticated" on social_groups;
create policy "social_groups_all_authenticated" on social_groups for all to authenticated using (true) with check (true);

alter table social_queue enable row level security;
drop policy if exists "social_queue_all_authenticated" on social_queue;
create policy "social_queue_all_authenticated" on social_queue for all to authenticated using (true) with check (true);
