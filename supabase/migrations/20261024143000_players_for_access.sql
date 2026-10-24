-- The people a game can be given to: active users who play games, by name and email only, for people who
-- manage access. Profiles themselves stay readable by user managers only.
create function public.players_for_access()
returns table (id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.has_permission('allocation.manage')) then
    raise exception 'You need “Allocate to cohorts and players”' using errcode = '42501';
  end if;
  return query
    select p.id, p.full_name, p.email from public.profiles p
    where p.status = 'active' and exists (
      select 1 from public.user_roles ur join public.role_permissions rp on rp.role_key = ur.role_key
      where ur.user_id = p.id and rp.permission_key = 'games.play' and rp.level = 1)
    order by p.full_name, p.email;
end;
$$;
revoke all on function public.players_for_access() from public, anon;
grant execute on function public.players_for_access() to authenticated;
