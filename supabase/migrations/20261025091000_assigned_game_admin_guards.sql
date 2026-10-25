-- Follow-ups to 20261025090000: the creator's rename policy must not open a back door to access, and a player's
-- run can't finish while the game is offline (the player can no longer read an offline game's row themselves).

create function private.game_is_offline(p_game_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select exists (select 1 from public.games g where g.key = p_game_key and g.offline_at is not null); $$;
revoke all on function private.game_is_offline(text) from public, anon;
grant execute on function private.game_is_offline(text) to authenticated;

create or replace function private.game_run_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.finished_at is not null then
    raise exception 'A finished run cannot change' using errcode = 'check_violation';
  end if;
  if new.finished_at is not null then
    if not old.test and (select private.game_is_offline(old.game_key)) then
      raise exception 'This game is offline' using errcode = 'P0001';
    end if;
    -- The clock is the server's.
    new.finished_at := now();
    new.duration_seconds := least(86400, greatest(0, extract(epoch from (now() - old.started_at))::integer));
  end if;
  return new;
end;
$$;

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
  -- Who may play is the game admin's call, not the creator's (who may update the row to rename it).
  if (select auth.uid()) is not null and new.access is distinct from old.access and not (select private.can_manage_access(old.key)) then
    raise exception 'Only this game’s game admin can change who may play it' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.game_update_guard() from public, anon, authenticated;
