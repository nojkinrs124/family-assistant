-- =============================================================
-- Этап 2: покупки. stores, store_integrations, shopping_lists,
-- shopping_list_items, orders, order_items. RLS по family_id.
-- =============================================================

create type store_integration_type as enum ('api', 'browser_automation');
create type order_status as enum (
  'draft',                       -- список ещё собирается
  'cart_ready',                  -- корзина собрана, ссылка есть
  'awaiting_manual_confirmation',-- дошли до оплаты, ждём пользователя
  'confirmed',                   -- пользователь подтвердил, что оплатил
  'cancelled'
);

-- -------------------------------------------------------------
-- stores — глобальный справочник магазинов (не per-family)
-- -------------------------------------------------------------
create table stores (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------
-- store_integrations — конкретная интеграция конкретной семьи
-- с конкретным магазином. Секреты (сессии/токены) сюда НЕ пишем —
-- только ссылку на запись в Vault (session_ref) и метаданные.
-- -------------------------------------------------------------
create table store_integrations (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families (id) on delete cascade,
  store_id          uuid not null references stores (id) on delete cascade,
  integration_type  store_integration_type not null,
  -- напр. {"search": true, "cart_add": true, "checkout_link": true, "auto_pay": false}
  capabilities      jsonb not null default '{}'::jsonb,
  session_ref        text,  -- идентификатор секрета в Vault, не сам секрет
  status            text not null default 'active'
                    check (status in ('active', 'needs_relogin', 'disabled')),
  created_at        timestamptz not null default now(),
  unique (family_id, store_id)
);

create index store_integrations_family_idx on store_integrations (family_id);

-- -------------------------------------------------------------
-- shopping_lists / shopping_list_items
-- -------------------------------------------------------------
create table shopping_lists (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  name        text not null default 'Список покупок',
  status      text not null default 'active'
              check (status in ('active', 'archived')),
  created_by  uuid references profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index shopping_lists_family_idx on shopping_lists (family_id);

create table shopping_list_items (
  id            uuid primary key default gen_random_uuid(),
  list_id       uuid not null references shopping_lists (id) on delete cascade,
  name          text not null,
  quantity      numeric not null default 1,
  unit          text,
  note          text,
  is_purchased  boolean not null default false,
  created_at    timestamptz not null default now()
);

create index shopping_list_items_list_idx on shopping_list_items (list_id);

-- -------------------------------------------------------------
-- orders / order_items
-- -------------------------------------------------------------
create table orders (
  id            uuid primary key default gen_random_uuid(),
  family_id     uuid not null references families (id) on delete cascade,
  store_id      uuid not null references stores (id),
  list_id       uuid references shopping_lists (id) on delete set null,
  status        order_status not null default 'draft',
  total_amount  numeric(12,2),
  currency      text not null default 'RUB',
  checkout_url  text,
  source        text not null default 'assistant'
                check (source in ('assistant', 'manual')),
  created_by    uuid references profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz
);

create index orders_family_idx on orders (family_id, created_at desc);

create table order_items (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references orders (id) on delete cascade,
  name        text not null,
  quantity    numeric not null default 1,
  unit        text,
  price       numeric(12,2),
  created_at  timestamptz not null default now()
);

create index order_items_order_idx on order_items (order_id);

-- =============================================================
-- RLS
-- =============================================================
alter table stores enable row level security;
alter table store_integrations enable row level security;
alter table shopping_lists enable row level security;
alter table shopping_list_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;

-- stores — общий справочник, читать могут все авторизованные
create policy stores_select on stores
  for select using (auth.role() = 'authenticated');

-- store_integrations — только своя семья, и только owner/admin видят/меняют
-- (там ссылка на секреты сессии — лишним людям в семье это ни к чему)
create policy store_integrations_all on store_integrations
  for all using (
    family_id in (
      select fm.family_id from family_members fm
      join profiles p on p.id = fm.user_id
      where p.auth_user_id = auth.uid()
        and fm.role in ('owner', 'admin')
        and fm.status = 'active'
    )
  );

create policy shopping_lists_all on shopping_lists
  for all using (family_id in (select internal.auth_family_ids()));

create policy shopping_list_items_all on shopping_list_items
  for all using (
    list_id in (
      select id from shopping_lists
      where family_id in (select internal.auth_family_ids())
    )
  );

create policy orders_all on orders
  for all using (family_id in (select internal.auth_family_ids()));

create policy order_items_all on order_items
  for all using (
    order_id in (
      select id from orders
      where family_id in (select internal.auth_family_ids())
    )
  );
