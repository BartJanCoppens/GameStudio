-- Who may play is set through set_game_access only. A column grant on games.access let the creator's rename
-- policy change it too, and a trigger guard can't tell the creator from publish_game acting for them.

revoke update (access) on public.games from authenticated;
drop policy "Access managers set access" on public.games;

create or replace function private.game_update_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and (new.title, new.description, new.archived_at) is distinct from (old.title, old.description, old.archived_at)
     and not (select private.can_edit_game(old.key)) then
    raise exception 'Only the game’s creator or a platform admin can change that' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.game_update_guard() from public, anon, authenticated;

create function public.set_game_access(p_game_key text, p_access text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.can_manage_access(p_game_key)) then
    raise exception 'Only this game’s game admin can change who may play it' using errcode = '42501';
  end if;
  if p_access not in ('everyone', 'restricted') then
    raise exception 'Access is everyone or restricted' using errcode = '22023';
  end if;
  update public.games set access = p_access where key = p_game_key;
end;
$$;
revoke all on function public.set_game_access(text, text) from public, anon;
grant execute on function public.set_game_access(text, text) to authenticated;
