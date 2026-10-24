-- Fixes from the final review of the game admin section.

-- The update guard ran as the caller: the service role (scripts, Edge Functions) has no access to the private
-- schema, so every server-side update of a game failed. It runs as its owner now; it only reads.
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
