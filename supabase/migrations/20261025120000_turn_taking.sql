-- Turn-taking games between two colleagues: a snapshot of every published version (a match plays the version it
-- started on), matches with a shared state and a private state per player, the move log, inactivity limits set by
-- the game admin, a job that expires invitations and cancels quiet matches, and phone notification subscriptions.
-- Matches are written only by the game-match Edge Function (service role); players and game admins read.

-- ---------------------------------------------------------------------------
-- Versions
-- ---------------------------------------------------------------------------
create table public.game_versions (
  game_key   text not null references public.games (key) on delete cascade,
  version    integer not null,
  content    jsonb not null,
  created_at timestamptz not null default now(),
  primary key (game_key, version)
);
insert into public.game_versions (game_key, version, content)
  select game_key, version, content from public.game_content where stage = 'live';
alter table public.game_versions enable row level security;
revoke all on public.game_versions from anon, authenticated;
grant select on public.game_versions to authenticated;
grant all on public.game_versions to service_role;
create policy "Players read the versions of games they may play" on public.game_versions
  for select to authenticated using ((select private.can_play_game(game_key)));

create or replace function public.publish_game(p_game_key text, p_game_admin uuid default null)
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
  -- Matches in progress keep playing the version they started on.
  insert into public.game_versions (game_key, version, content) values (p_game_key, live_version, content)
    on conflict (game_key, version) do update set content = excluded.content;
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

create or replace function public.publish_live_content(p_game_key text, p_data jsonb, p_fingerprint text, p_checked_by uuid, p_expected_version integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_data jsonb;
  revision integer;
  current_version integer;
  live_version integer;
  live_content jsonb;
begin
  -- Draft before live, the same lock order as publish_game.
  perform 1 from public.game_content c where c.game_key = p_game_key and c.stage = 'draft' for update;
  select c.content->'data', c.data_revision, c.version into old_data, revision, current_version
    from public.game_content c where c.game_key = p_game_key and c.stage = 'live' for update;
  if revision is null then
    raise exception 'This game isn’t published' using errcode = 'P0002';
  end if;
  if p_expected_version is not null and current_version <> p_expected_version then
    raise exception 'The game changed while the new content was being written or checked. Generate again.' using errcode = 'P0001';
  end if;
  update public.game_content set content = jsonb_set(content, '{data}', p_data), data_revision = revision + 1
    where game_key = p_game_key and stage = 'live' returning version, content into live_version, live_content;
  insert into public.game_versions (game_key, version, content) values (p_game_key, live_version, live_content)
    on conflict (game_key, version) do update set content = excluded.content;
  insert into public.game_checks (game_key, fingerprint, passed, reasons, checked_by) values (p_game_key, p_fingerprint, true, '[]', p_checked_by);
  update public.game_content set content = jsonb_set(content - 'previous', '{data}', p_data), base_revision = revision + 1
    where game_key = p_game_key and stage = 'draft' and content->'data' is not distinct from old_data;
  return live_version;
end;
$$;

-- ---------------------------------------------------------------------------
-- Matches
-- ---------------------------------------------------------------------------
alter table public.games
  add column turn_limit_async interval not null default interval '3 days',
  add column turn_limit_live interval not null default interval '10 minutes';

create table public.matches (
  id               uuid primary key default gen_random_uuid(),
  game_key         text not null references public.games (key) on delete cascade,
  version          integer not null,
  way              text not null check (way in ('live', 'async')),
  status           text not null default 'invited' check (status in ('invited', 'waiting', 'active', 'finished', 'declined', 'withdrawn', 'expired', 'cancelled')),
  player_a         uuid not null references public.profiles (id) on delete cascade,
  player_b         uuid not null references public.profiles (id) on delete cascade,
  a_name           text not null,
  b_name           text not null,
  turn             text not null default 'b' check (turn in ('a', 'b')),
  move_no          integer not null default 0,
  state            jsonb,
  last_move        jsonb,
  a_ready          boolean not null default false,
  b_ready          boolean not null default false,
  turn_ends_at     timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  finished_at      timestamptz,
  winner           text check (winner in ('a', 'b')),
  check (player_a <> player_b)
);
create index matches_player_a_idx on public.matches (player_a);
create index matches_player_b_idx on public.matches (player_b);
create index matches_game_idx on public.matches (game_key);
create index matches_open_idx on public.matches (status) where status in ('invited', 'waiting', 'active');

create table public.match_private (
  match_id uuid not null references public.matches (id) on delete cascade,
  side     text not null check (side in ('a', 'b')),
  state    jsonb,
  primary key (match_id, side)
);

create table public.match_moves (
  match_id   uuid not null references public.matches (id) on delete cascade,
  move_no    integer not null,
  side       text not null check (side in ('a', 'b')),
  move       jsonb,
  created_at timestamptz not null default now(),
  primary key (match_id, move_no)
);

alter table public.matches enable row level security;
alter table public.match_private enable row level security;
alter table public.match_moves enable row level security;
revoke all on public.matches, public.match_private, public.match_moves from anon, authenticated;
grant select on public.matches, public.match_private, public.match_moves to authenticated;
grant all on public.matches, public.match_private, public.match_moves to service_role;

create policy "Players and the game admin read matches" on public.matches
  for select to authenticated
  using (player_a = (select auth.uid()) or player_b = (select auth.uid()) or (select private.is_game_admin(game_key)));
create policy "Each player reads only their own secrets" on public.match_private
  for select to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id
                 and ((side = 'a' and m.player_a = (select auth.uid())) or (side = 'b' and m.player_b = (select auth.uid())))));
create policy "Players read the moves of their matches" on public.match_moves
  for select to authenticated
  using (exists (select 1 from public.matches m where m.id = match_id and (m.player_a = (select auth.uid()) or m.player_b = (select auth.uid()))));

-- Live updates for the players' own rows (RLS applies). Private state isn't published.
alter publication supabase_realtime add table public.matches;

/** The access branch of can_play_game, for another person (who may be invited). */
create function private.can_play_game_as(p_game_key text, p_user uuid)
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
      or exists (select 1 from public.game_access a where a.game_key = g.key and a.user_id = p_user)
      or exists (select 1 from public.game_access a join public.group_members gm on gm.group_id = a.group_id
                 where a.game_key = g.key and gm.user_id = p_user)))
  and exists (
    select 1 from public.user_roles ur
    join public.role_permissions rp on rp.role_key = ur.role_key and rp.permission_key = 'games.play' and rp.level = 1
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = p_user and p.status = 'active');
$$;
revoke all on function private.can_play_game_as(text, uuid) from public, anon, authenticated;
grant execute on function private.can_play_game_as(text, uuid) to service_role;

/** The colleagues the caller can invite to a game: active players who may play it, by name. */
create function public.match_candidates(p_game_key text)
returns table (id uuid, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.can_play_game(p_game_key)) then
    raise exception 'This game isn’t available' using errcode = '42501';
  end if;
  return query select p.id, coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)) from public.profiles p
    where p.id <> (select auth.uid()) and (select private.can_play_game_as(p_game_key, p.id)) order by 2;
end;
$$;
revoke all on function public.match_candidates(text) from public, anon;
grant execute on function public.match_candidates(text) to authenticated;

create function public.set_turn_limits(p_game_key text, p_async interval, p_live interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not (select private.is_game_admin(p_game_key)) then
    raise exception 'Only this game’s game admin can do that' using errcode = '42501';
  end if;
  if p_async < interval '1 minute' or p_async > interval '30 days' or p_live < interval '1 minute' or p_live > interval '30 days' then
    raise exception 'Choose between 1 minute and 30 days' using errcode = '22023';
  end if;
  update public.games set turn_limit_async = p_async, turn_limit_live = p_live where key = p_game_key;
  if not found then
    raise exception 'That game no longer exists' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.set_turn_limits(text, interval, interval) from public, anon;
grant execute on function public.set_turn_limits(text, interval, interval) to authenticated;

/** Unanswered invitations expire (live 1 hour, turn by turn 7 days); quiet matches are cancelled. */
create function private.expire_matches()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.matches set status = 'expired', finished_at = now()
    where status = 'invited'
      and created_at < now() - case way when 'live' then interval '1 hour' else interval '7 days' end;
  update public.matches m set status = 'cancelled', finished_at = now()
    from public.games g
    where g.key = m.game_key and m.status in ('waiting', 'active')
      and m.last_activity_at < now() - case m.way when 'live' then g.turn_limit_live else g.turn_limit_async end;
$$;
revoke all on function private.expire_matches() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.unschedule('expire-matches') where exists (select 1 from cron.job where jobname = 'expire-matches');
select cron.schedule('expire-matches', '*/5 * * * *', 'select private.expire_matches()');

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column notify_email boolean not null default true,
  add column notify_push boolean not null default true;

create function public.set_my_notifications(p_email boolean, p_push boolean)
returns void
language sql
security definer
set search_path = ''
as $$ update public.profiles set notify_email = p_email, notify_push = p_push where id = (select auth.uid()); $$;
revoke all on function public.set_my_notifications(boolean, boolean) from public, anon;
grant execute on function public.set_my_notifications(boolean, boolean) to authenticated;

create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade default auth.uid(),
  endpoint   text not null unique check (endpoint like 'https://%' and length(endpoint) <= 1000),
  p256dh     text not null check (length(p256dh) <= 200),
  auth       text not null check (length(auth) <= 100),
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete, insert (endpoint, p256dh, auth) on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
create policy "People keep their own devices" on public.push_subscriptions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
