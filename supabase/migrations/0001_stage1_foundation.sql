-- =============================================================
-- Этап 1: Фундамент. families, profiles, family_members, roles,
-- audit_logs, settings. Всё с RLS по family_id.
-- =============================================================

create extension if not exists "pgcrypto";

-- -------------------------------------------------------------
-- families
-- -------------------------------------------------------------
create table families (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------
-- profiles — привязаны к auth.users (Supabase Auth) через id,
-- либо создаются напрямую для telegram-only пользователей.
-- -------------------------------------------------------------
create table profiles (
  id           uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users (id) on delete set null,
  telegram_id  bigint unique,
  name         text not null,
  username     text,
  avatar_url   text,
  timezone     text not null default 'Asia/Krasnoyarsk',
  language     text not null default 'ru',
  status       text not null default 'active'
               check (status in ('active', 'suspended', 'invited')),
  created_at   timestamptz not null default now()
);

create index profiles_telegram_id_idx on profiles (telegram_id);

-- -------------------------------------------------------------
-- family_members — членство + роль + точечные permissions
-- -------------------------------------------------------------
create type family_role as enum ('owner', 'admin', 'member', 'child', 'guest');

create table family_members (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families (id) on delete cascade,
  user_id      uuid not null references profiles (id) on delete cascade,
  role         family_role not null default 'member',
  -- точечные права поверх роли, например {"finance.edit": false}
  permissions  jsonb not null default '{}'::jsonb,
  status       text not null default 'active'
               check (status in ('active', 'invited', 'removed')),
  created_at   timestamptz not null default now(),
  unique (family_id, user_id)
);

create index family_members_family_idx on family_members (family_id);
create index family_members_user_idx on family_members (user_id);

-- -------------------------------------------------------------
-- settings — настройки на уровне семьи (key/value, гибко)
-- -------------------------------------------------------------
create table settings (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  key         text not null,
  value       jsonb not null,
  updated_at  timestamptz not null default now(),
  unique (family_id, key)
);

-- -------------------------------------------------------------
-- audit_logs — источник правды по всем значимым действиям
-- -------------------------------------------------------------
create table audit_logs (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid references families (id) on delete set null,
  actor_id     uuid references profiles (id) on delete set null,
  action       text not null,          -- напр. 'order.created', 'card.linked'
  entity_type  text,
  entity_id    uuid,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index audit_logs_family_idx on audit_logs (family_id, created_at desc);

-- =============================================================
-- Вспомогательная функция: family_id текущего пользователя(ей).
-- Используется в RLS-политиках всех последующих модулей.
-- =============================================================
create or replace function auth_family_ids()
returns setof uuid
language sql
security definer
stable
as $$
  select fm.family_id
  from family_members fm
  join profiles p on p.id = fm.user_id
  where p.auth_user_id = auth.uid()
    and fm.status = 'active';
$$;

-- =============================================================
-- RLS
-- =============================================================
alter table families enable row level security;
alter table profiles enable row level security;
alter table family_members enable row level security;
alter table settings enable row level security;
alter table audit_logs enable row level security;

-- families: видно только свои
create policy families_select on families
  for select using (id in (select auth_family_ids()));

-- profiles: видно себя + участников своих семей
create policy profiles_select on profiles
  for select using (
    auth_user_id = auth.uid()
    or id in (
      select fm.user_id from family_members fm
      where fm.family_id in (select auth_family_ids())
    )
  );

create policy profiles_update_self on profiles
  for update using (auth_user_id = auth.uid());

-- family_members: видно участников своих семей
create policy family_members_select on family_members
  for select using (family_id in (select auth_family_ids()));

-- только owner/admin могут менять состав семьи
create policy family_members_write on family_members
  for all using (
    family_id in (
      select fm.family_id from family_members fm
      join profiles p on p.id = fm.user_id
      where p.auth_user_id = auth.uid()
        and fm.role in ('owner', 'admin')
        and fm.status = 'active'
    )
  );

-- settings: видно и правится в рамках своей семьи
create policy settings_all on settings
  for all using (family_id in (select auth_family_ids()));

-- audit_logs: только чтение в рамках своей семьи, запись — через service role
create policy audit_logs_select on audit_logs
  for select using (family_id in (select auth_family_ids()));
