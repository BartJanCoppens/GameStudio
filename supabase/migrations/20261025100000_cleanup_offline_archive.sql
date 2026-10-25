-- Clean-up from the reviews: archived games are closed to players; offline also stops common-goal contributions
-- and counted runs (tests still work); changing an unknown game is an error rather than a silent no-op.

create or replace function private.can_play_game(p_game_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.games g
      where g.key = p_game_key and g.offline_at is null and g.archived_at is null and (
        g.access = 'everyone'
        or exists (select 1 from public.game_access a where a.game_key = g.key and a.user_id = (select auth.uid()))
        or exists (select 1 from public.game_access a join public.group_members m on m.group_id = a.group_id
                   where a.game_key = g.key and m.user_id = (select auth.uid()))
      )
    )
    or (select private.can_edit_game(p_game_key))
    or (select private.is_game_admin(p_game_key));
$$;

drop policy "Players start their own runs" on public.game_runs;
create policy "Players start their own runs" on public.game_runs
  for insert to authenticated
  with check (
    (select private.has_permission('games.play'))
    and not exists (select 1 from public.games g where g.key = game_runs.game_key and g.archived_at is not null)
    and case when test
      then (select private.can_edit_game(game_key)) or (select private.is_game_admin(game_key))
      else (select private.can_play_game(game_key)) and not (select private.game_is_offline(game_key)) end
  );

create or replace function private.game_contribution_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := (select auth.uid());
  perform 1 from public.game_runs r where r.id = new.run_id for update;
  if not exists (
    select 1 from public.game_runs r
    where r.id = new.run_id and r.user_id = new.user_id and r.game_key = new.game_key and r.finished_at is null and not r.test
  ) then
    raise exception 'Contributions need your own unfinished run of this game' using errcode = '42501';
  end if;
  if (select private.game_is_offline(new.game_key)) then
    raise exception 'This game is offline' using errcode = 'P0001';
  end if;
  if (select count(*) from public.game_contributions c where c.run_id = new.run_id) >= 50 then
    raise exception 'At most 50 contributions per run' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function public.set_game_offline(p_game_key text, p_offline boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_game_admin(p_game_key)) then
    raise exception 'Only this game’s game admin can do that' using errcode = '42501';
  end if;
  update public.games set offline_at = case when p_offline then coalesce(offline_at, now()) end where key = p_game_key;
  if not found then
    raise exception 'That game no longer exists' using errcode = 'P0002';
  end if;
end;
$$;

create or replace function public.set_game_admin(p_game_key text, p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.has_permission('users.manage')) then
    raise exception 'Only a platform admin can change a game’s game admin' using errcode = '42501';
  end if;
  if not (select private.can_be_game_admin(p_user)) then
    raise exception 'Choose a game admin who can look after games' using errcode = 'P0001';
  end if;
  update public.games set game_admin = p_user where key = p_game_key;
  if not found then
    raise exception 'That game no longer exists' using errcode = 'P0002';
  end if;
end;
$$;
