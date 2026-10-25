-- One game admin per game, named by the creator at first publish. Only that person (and platform admins) sees
-- and looks after the game: who may play it, content, offline. A newly published game starts closed.

alter table public.games
  add column game_admin uuid references public.profiles (id) on delete set null,
  add column offline_at timestamptz;
-- No column grants: these two are written only by the functions below.

-- Games published before this get the longest-standing active platform admin; their access stays as it is.
update public.games g set game_admin = (
    select p.id from public.profiles p
    join public.user_roles ur on ur.user_id = p.id
    join public.role_permissions rp on rp.role_key = ur.role_key and rp.permission_key = 'users.manage' and rp.level = 1
    where p.status = 'active' order by p.created_at limit 1)
  where exists (select 1 from public.game_content c where c.game_key = g.key and c.stage = 'live');

/** The game's own game admin (while they still hold the game admin permission), or a platform admin. */
create function private.is_game_admin(p_game_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select private.has_permission('users.manage'))
    or ((select private.has_permission('live.edit'))
        and exists (select 1 from public.games g where g.key = p_game_key and g.game_admin = (select auth.uid())));
$$;

/** Whether someone can be named game admin: an active holder of "Add content to a live game". */
create function private.can_be_game_admin(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_key = ur.role_key and rp.permission_key = 'live.edit' and rp.level = 1
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = p_user and p.status = 'active');
$$;

create or replace function private.can_manage_access(p_game_key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select private.has_permission('allocation.manage')) and (select private.is_game_admin(p_game_key));
$$;

create or replace function private.can_play_game(p_game_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.games g
      where g.key = p_game_key and g.offline_at is null and (
        g.access = 'everyone'
        or exists (select 1 from public.game_access a where a.game_key = g.key and a.user_id = (select auth.uid()))
        or exists (select 1 from public.game_access a join public.group_members m on m.group_id = a.group_id
                   where a.game_key = g.key and m.user_id = (select auth.uid()))
      )
    )
    or (select private.can_edit_game(p_game_key))
    or (select private.is_game_admin(p_game_key));
$$;
revoke all on function private.is_game_admin(text), private.can_be_game_admin(uuid) from public, anon;
grant execute on function private.is_game_admin(text), private.can_be_game_admin(uuid) to authenticated;

-- A game is seen only by those who may play it, edit it or look after it.
drop policy "Signed-in users read the games list" on public.games;
create policy "People read the games they may play, edit or look after" on public.games
  for select to authenticated using ((select private.can_play_game(key)));

drop policy "Players start their own runs" on public.game_runs;
create policy "Players start their own runs" on public.game_runs
  for insert to authenticated
  with check (
    (select private.has_permission('games.play'))
    and not exists (select 1 from public.games g where g.key = game_runs.game_key and g.archived_at is not null)
    and case when test
      then (select private.can_edit_game(game_key)) or (select private.is_game_admin(game_key))
      else (select private.can_play_game(game_key)) end
  );

-- Offline means stopped: a player's run in progress can't finish.
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
    if not old.test and exists (select 1 from public.games g where g.key = old.game_key and g.offline_at is not null) then
      raise exception 'This game is offline' using errcode = 'P0001';
    end if;
    -- The clock is the server's.
    new.finished_at := now();
    new.duration_seconds := least(86400, greatest(0, extract(epoch from (now() - old.started_at))::integer));
  end if;
  return new;
end;
$$;

-- Publishing names the game admin the first time, and starts the game closed.
drop function public.publish_game(text);
create function public.publish_game(p_game_key text, p_game_admin uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest  public.game_checks;
  content jsonb;
  secret  jsonb;
  base    integer;
  revision integer;
  live_version integer;
  first_publish boolean;
begin
  if not (select private.has_permission('workflow.publish')) or not (select private.can_edit_game(p_game_key)) then
    raise exception 'You can’t publish this game' using errcode = '42501';
  end if;
  select c.content, c.base_revision into content, base from public.game_content c where c.game_key = p_game_key and c.stage = 'draft' for update;
  if content is null then
    raise exception 'This game has no draft to publish' using errcode = 'P0002';
  end if;
  select c.data_revision into revision from public.game_content c where c.game_key = p_game_key and c.stage = 'live' for update;
  first_publish := revision is null;
  if first_publish and (p_game_admin is null or not (select private.can_be_game_admin(p_game_admin))) then
    raise exception 'Choose a game admin who can look after games' using errcode = 'P0001';
  end if;
  if revision is not null and base < revision then
    raise exception 'A game admin added content to the live game. Take it into your draft first.' using errcode = 'P0001';
  end if;
  select s.ai into secret from public.game_secrets s where s.game_key = p_game_key and s.stage = 'draft' for update;
  select * into latest from public.game_checks where game_key = p_game_key order by id desc limit 1;
  if latest is null or not latest.passed or latest.fingerprint is distinct from md5(content::text || coalesce(secret::text, '')) then
    raise exception 'A passed house-rules check is required for this exact version. The game changed since the house-rules check, or it hasn’t been checked. Check again.' using errcode = 'P0001';
  end if;

  insert into public.game_content (game_key, stage, content) values (p_game_key, 'live', content)
    on conflict (game_key, stage) do update set content = excluded.content
    returning version into live_version;
  if secret is not null then
    insert into public.game_secrets (game_key, stage, ai) values (p_game_key, 'live', secret)
      on conflict (game_key, stage) do update set ai = excluded.ai;
  end if;
  update public.game_content set base_revision = coalesce(revision, 0) where game_key = p_game_key and stage = 'draft';
  -- A republish keeps the game admin, who may play it, and offline.
  if first_publish then
    update public.games set game_admin = p_game_admin, access = 'restricted' where key = p_game_key;
    delete from public.game_access where game_key = p_game_key;
  end if;
  return live_version;
end;
$$;
revoke all on function public.publish_game(text, uuid) from public, anon;
grant execute on function public.publish_game(text, uuid) to authenticated;

/** The people a creator (or platform admin) can name as game admin. */
create function public.game_admins_to_choose()
returns table (id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ((select private.has_permission('workflow.publish')) or (select private.has_permission('users.manage'))) then
    raise exception 'You can’t choose a game admin' using errcode = '42501';
  end if;
  return query select p.id, p.full_name, p.email from public.profiles p
    where (select private.can_be_game_admin(p.id)) order by p.full_name, p.email;
end;
$$;

create function public.is_game_admin(p_game_key text)
returns boolean
language sql
stable
set search_path = ''
as $$ select private.is_game_admin(p_game_key); $$;

create function public.set_game_offline(p_game_key text, p_offline boolean)
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
end;
$$;

create function public.set_game_admin(p_game_key text, p_user uuid)
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
end;
$$;
revoke all on function public.game_admins_to_choose(), public.is_game_admin(text), public.set_game_offline(text, boolean), public.set_game_admin(text, uuid) from public, anon;
grant execute on function public.game_admins_to_choose(), public.is_game_admin(text), public.set_game_offline(text, boolean), public.set_game_admin(text, uuid) to authenticated;
