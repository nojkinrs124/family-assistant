-- =============================================================
-- Фикс performance-линтера Supabase (get_advisors):
-- 1) auth_rls_initplan — auth.uid()/auth.role() пересчитывался на
--    каждую строку вместо одного раза на запрос. Заменено на
--    (select auth.uid()) / (select auth.role()).
-- 2) multiple_permissive_policies — family_members_write (`for all`)
--    дублировался с family_members_select для действия SELECT.
--    Сужен до insert/update/delete.
-- =============================================================

drop policy profiles_select on profiles;
create policy profiles_select on profiles
  for select using (
    auth_user_id = (select auth.uid())
    or id in (
      select fm.user_id from family_members fm
      where fm.family_id in (select internal.auth_family_ids())
    )
  );

drop policy profiles_update_self on profiles;
create policy profiles_update_self on profiles
  for update using (auth_user_id = (select auth.uid()));

drop policy stores_select on stores;
create policy stores_select on stores
  for select using ((select auth.role()) = 'authenticated');

drop policy family_members_write on family_members;

create policy family_members_insert on family_members
  for insert with check (
    family_id in (
      select fm.family_id from family_members fm
      join profiles p on p.id = fm.user_id
      where p.auth_user_id = (select auth.uid())
        and fm.role in ('owner', 'admin')
        and fm.status = 'active'
    )
  );

create policy family_members_update on family_members
  for update using (
    family_id in (
      select fm.family_id from family_members fm
      join profiles p on p.id = fm.user_id
      where p.auth_user_id = (select auth.uid())
        and fm.role in ('owner', 'admin')
        and fm.status = 'active'
    )
  );

create policy family_members_delete on family_members
  for delete using (
    family_id in (
      select fm.family_id from family_members fm
      join profiles p on p.id = fm.user_id
      where p.auth_user_id = (select auth.uid())
        and fm.role in ('owner', 'admin')
        and fm.status = 'active'
    )
  );

drop policy store_integrations_all on store_integrations;
create policy store_integrations_all on store_integrations
  for all using (
    family_id in (
      select fm.family_id from family_members fm
      join profiles p on p.id = fm.user_id
      where p.auth_user_id = (select auth.uid())
        and fm.role in ('owner', 'admin')
        and fm.status = 'active'
    )
  );
