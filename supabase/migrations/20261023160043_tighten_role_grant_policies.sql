-- The no-escalation rule, extended to every way a role editor can change a role.
--
-- Before: a role editor could only *grant* permissions they hold, but could still remove grants,
-- or delete a whole custom role, out from under people more privileged than themselves, and an
-- update could re-point an existing grant at a different permission.
-- Now: every change to a role's grants, and deleting a role, needs (1) every permission involved
-- and (2) the right to manage every user who holds the role.

-- Every user holding the role is someone the caller may manage.
create function private.can_manage_role_holders(p_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and not exists (
    select 1 from public.user_roles ur
    where ur.role_key = p_role and not private.can_manage_user(ur.user_id)
  );
$$;

revoke all on function private.can_manage_role_holders(text) from public, anon;
grant execute on function private.can_manage_role_holders(text) to authenticated;

-- Only a grant's level can change; moving a grant to another role or permission is a delete plus an insert.
revoke update on public.role_permissions from authenticated;
grant update (level) on public.role_permissions to authenticated;

drop policy "Role editors grant permissions" on public.role_permissions;
drop policy "Role editors change grants" on public.role_permissions;
drop policy "Role editors revoke permissions" on public.role_permissions;
drop policy "Role editors delete custom roles" on public.roles;

create policy "Role editors grant permissions" on public.role_permissions
  for insert to authenticated
  with check (
    (select private.has_permission('roles.manage'))
    and private.has_permission(permission_key)
    and private.can_manage_role_holders(role_key)
  );

create policy "Role editors change grants" on public.role_permissions
  for update to authenticated
  using (
    (select private.has_permission('roles.manage'))
    and private.has_permission(permission_key)
    and private.can_manage_role_holders(role_key)
  )
  with check (
    (select private.has_permission('roles.manage'))
    and private.has_permission(permission_key)
    and private.can_manage_role_holders(role_key)
  );

create policy "Role editors revoke permissions" on public.role_permissions
  for delete to authenticated
  using (
    (select private.has_permission('roles.manage'))
    and private.has_permission(permission_key)
    and private.can_manage_role_holders(role_key)
  );

create policy "Role editors delete custom roles" on public.roles
  for delete to authenticated
  using (
    (select private.has_permission('roles.manage'))
    and not is_system
    and private.can_grant_role(key)
    and private.can_manage_role_holders(key)
  );
