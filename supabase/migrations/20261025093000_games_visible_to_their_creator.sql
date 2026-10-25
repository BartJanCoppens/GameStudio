-- A row being inserted isn't visible to lookups by key within the same statement, so can_play_game alone refused
-- the creator their own new game (insert … returning). The creator, game admin and platform admins are read off
-- the row itself.
drop policy "People read the games they may play, edit or look after" on public.games;
create policy "People read the games they may play, edit or look after" on public.games
  for select to authenticated using (
    created_by = (select auth.uid())
    or (game_admin = (select auth.uid()) and (select private.has_permission('live.edit')))
    or (select private.has_permission('users.manage'))
    or (select private.can_play_game(key)));

-- Creators choose a game admin by name; only platform admins see the email addresses.
create or replace function public.game_admins_to_choose()
returns table (id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  admin_view boolean := (select private.has_permission('users.manage'));
begin
  if not (admin_view or (select private.has_permission('workflow.publish'))) then
    raise exception 'You can’t choose a game admin' using errcode = '42501';
  end if;
  return query select p.id, coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)), case when admin_view then p.email end
    from public.profiles p where (select private.can_be_game_admin(p.id)) order by 2;
end;
$$;
