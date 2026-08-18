-- =============================================================
-- Этап 3: финансы. accounts, categories, transactions, budgets,
-- savings_goals. RLS по family_id (categories — гибрид: глобальные
-- + семейные).
-- =============================================================

create type account_type as enum ('bank_card', 'cash', 'savings', 'other');
create type category_kind as enum ('expense', 'income');
create type transaction_type as enum ('expense', 'income', 'transfer');
create type transaction_source as enum ('manual', 'assistant', 'shopping_order', 'bank_import');
create type budget_period as enum ('weekly', 'monthly', 'yearly');

-- -------------------------------------------------------------
-- accounts
-- -------------------------------------------------------------
create table accounts (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references families (id) on delete cascade,
  name        text not null,               -- напр. «Т-Банк», «Наличные», «Копилка»
  type        account_type not null default 'other',
  currency    text not null default 'RUB',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index accounts_family_idx on accounts (family_id);

-- -------------------------------------------------------------
-- categories — глобальные (family_id is null, видны всем) +
-- собственные семейные категории поверх них
-- -------------------------------------------------------------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid references families (id) on delete cascade,  -- null = глобальная
  name        text not null,
  kind        category_kind not null default 'expense',
  icon        text,
  created_at  timestamptz not null default now()
);

create index categories_family_idx on categories (family_id);

-- NULL != NULL для обычного unique-constraint'а в Postgres, поэтому для
-- дедупликации глобальных категорий (family_id is null) нужен именно
-- expression index с coalesce, а не unique (family_id, name, kind).
create unique index categories_unique_idx on categories (
  coalesce(family_id, '00000000-0000-0000-0000-000000000000'::uuid),
  name,
  kind
);

-- -------------------------------------------------------------
-- transactions — источник правды по расходам/доходам семьи
-- -------------------------------------------------------------
create table transactions (
  id                uuid primary key default gen_random_uuid(),
  family_id         uuid not null references families (id) on delete cascade,
  account_id        uuid not null references accounts (id) on delete restrict,
  category_id       uuid references categories (id) on delete set null,
  type              transaction_type not null default 'expense',
  amount            numeric(12,2) not null check (amount > 0),
  currency          text not null default 'RUB',
  description       text,
  source            transaction_source not null default 'manual',
  related_order_id  uuid references orders (id) on delete set null,
  created_by        uuid references profiles (id) on delete set null,
  occurred_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index transactions_family_idx on transactions (family_id, occurred_at desc);
create index transactions_account_idx on transactions (account_id);
create index transactions_order_idx on transactions (related_order_id);

-- -------------------------------------------------------------
-- budgets — лимит по категории на период
-- -------------------------------------------------------------
create table budgets (
  id           uuid primary key default gen_random_uuid(),
  family_id    uuid not null references families (id) on delete cascade,
  category_id  uuid not null references categories (id) on delete cascade,
  period       budget_period not null default 'monthly',
  amount_limit numeric(12,2) not null check (amount_limit > 0),
  start_date   date not null default current_date,
  created_at   timestamptz not null default now(),
  unique (family_id, category_id, period, start_date)
);

create index budgets_family_idx on budgets (family_id);

-- -------------------------------------------------------------
-- savings_goals
-- -------------------------------------------------------------
create table savings_goals (
  id              uuid primary key default gen_random_uuid(),
  family_id       uuid not null references families (id) on delete cascade,
  name            text not null,           -- напр. «Новая машина», «Отпуск»
  target_amount   numeric(12,2) not null check (target_amount > 0),
  current_amount  numeric(12,2) not null default 0 check (current_amount >= 0),
  target_date     date,
  created_at      timestamptz not null default now()
);

create index savings_goals_family_idx on savings_goals (family_id);

-- =============================================================
-- RLS
-- =============================================================
alter table accounts enable row level security;
alter table categories enable row level security;
alter table transactions enable row level security;
alter table budgets enable row level security;
alter table savings_goals enable row level security;

create policy accounts_all on accounts
  for all using (family_id in (select internal.auth_family_ids()));

-- categories: глобальные видят все авторизованные, семейные — только своя семья
create policy categories_select on categories
  for select using (
    family_id is null
    or family_id in (select internal.auth_family_ids())
  );

create policy categories_write on categories
  for insert with check (family_id in (select internal.auth_family_ids()));

create policy categories_update on categories
  for update using (family_id in (select internal.auth_family_ids()));

create policy categories_delete on categories
  for delete using (family_id in (select internal.auth_family_ids()));

create policy transactions_all on transactions
  for all using (family_id in (select internal.auth_family_ids()));

create policy budgets_all on budgets
  for all using (family_id in (select internal.auth_family_ids()));

create policy savings_goals_all on savings_goals
  for all using (family_id in (select internal.auth_family_ids()));
