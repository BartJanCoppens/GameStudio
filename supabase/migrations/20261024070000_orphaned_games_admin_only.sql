-- A game whose creator's account was deleted (created_by set null) stays editable by platform admins
-- only; the demo game is the one game every creator may edit.
create or replace function private.can_edit_game(p_game_key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select private.has_permission('games.create')) and exists (
    select 1 from public.games g
    where g.key = p_game_key
      and (g.key = 'invoice-errors' or g.created_by = (select auth.uid()) or (select private.has_permission('users.manage')))
  );
$$;
