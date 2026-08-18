-- =============================================================
-- Фикс замечаний security-линтера Supabase (get_advisors):
-- 1) search_path у auth_family_ids() не был зафиксирован
-- 2) SECURITY DEFINER функция была случайно доступна как публичный
--    REST-эндпоинт (/rest/v1/rpc/auth_family_ids). Переносим в схему
--    internal, которую PostgREST не экспонирует как API — RLS внутри
--    Postgres по-прежнему может её вызывать.
-- =============================================================

create schema if not exists internal;

create or replace function internal.auth_family_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select fm.family_id
  from family_members fm
  join profiles p on p.id = fm.user_id
  where p.auth_user_id = auth.uid()
    and fm.status = 'active';
$$;

revoke all on function internal.auth_family_ids() from public;
revoke all on function internal.auth_family_ids() from anon;
grant execute on function internal.auth_family_ids() to authenticated;

drop policy families_select on families;
create policy families_select on families
  for select using (id in (select internal.auth_family_ids()));

drop policy profiles_select on profiles;
create policy profiles_select on profiles
  for select using (
    auth_user_id = auth.uid()
    or id in (
      select fm.user_id from family_members fm
      where fm.family_id in (select internal.auth_family_ids())
    )
  );

drop policy family_members_select on family_members;
create policy family_members_select on family_members
  for select using (family_id in (select internal.auth_family_ids()));

drop policy family_members_write on family_members;
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

drop policy settings_all on settings;
create policy settings_all on settings
  for all using (family_id in (select internal.auth_family_ids()));

drop policy audit_logs_select on audit_logs;
create policy audit_logs_select on audit_logs
  for select using (family_id in (select internal.auth_family_ids()));

drop function if exists public.auth_family_ids();
