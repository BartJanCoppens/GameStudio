-- The game admin section: groups (kept by platform admins), per-game access (everyone, or selected groups
-- and people), and content added to a live game after a house-rules check.

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------

create table public.user_groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(name) between 1 and 60),
  description text not null default '' check (length(description) <= 300),
  created_at  timestamptz not null default now()
);
create table public.group_members (
  group_id uuid not null references public.user_groups (id) on delete cascade,
  user_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (group_id, user_id)
);
create index group_members_user_idx on public.group_members (user_id);

alter table public.user_groups enable row level security;
alter table public.group_members enable row level security;
revoke all on public.user_groups, public.group_members from anon, authenticated;
grant select, delete on public.user_groups, public.group_members to authenticated;
grant insert (name, description) on public.user_groups to authenticated;
grant update (name, description) on public.user_groups to authenticated;
grant insert (group_id, user_id) on public.group_members to authenticated;
grant all on public.user_groups, public.group_members to service_role;

create policy "Signed-in users read group names" on public.user_groups for select to authenticated using (true);
create policy "Platform admins add groups" on public.user_groups for insert to authenticated with check ((select private.has_permission('users.manage')));
create policy "Platform admins change groups" on public.user_groups for update to authenticated
  using ((select private.has_permission('users.manage'))) with check ((select private.has_permission('users.manage')));
create policy "Platform admins remove groups" on public.user_groups for delete to authenticated using ((select private.has_permission('users.manage')));
create policy "People who manage access read members" on public.group_members for select to authenticated
  using ((select private.has_permission('users.manage')) or (select private.has_permission('allocation.manage')));
create policy "Platform admins add members" on public.group_members for insert to authenticated with check ((select private.has_permission('users.manage')));
create policy "Platform admins remove members" on public.group_members for delete to authenticated using ((select private.has_permission('users.manage')));

-- ---------------------------------------------------------------------------
-- Access per game
-- ---------------------------------------------------------------------------

alter table public.games add column access text not null default 'everyone' check (access in ('everyone', 'restricted'));
grant update (access) on public.games to authenticated;

create table public.game_access (
  id       uuid primary key default gen_random_uuid(),
  game_key text not null references public.games (key) on delete cascade,
  group_id uuid references public.user_groups (id) on delete cascade,
  user_id  uuid references public.profiles (id) on delete cascade,
  check ((group_id is null) <> (user_id is null)),
  unique nulls not distinct (game_key, group_id, user_id)
);
create index game_access_game_idx on public.game_access (game_key);

/** Who may set a game's access: allocation rights, plus editing the game or looking after games (game admins). */
create function private.can_manage_access(p_game_key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select private.has_permission('allocation.manage'))
    and ((select private.can_edit_game(p_game_key)) or (select private.has_permission('live.edit')));
$$;

/**
 * Who may play a game: everyone when its access is open, else the people and groups listed; its creator,
 * platform admins and game admins always. Security definer: players can't read the access lists themselves.
 */
create function private.can_play_game(p_game_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1 from public.games g
      where g.key = p_game_key and (
        g.access = 'everyone'
        or exists (select 1 from public.game_access a where a.game_key = g.key and a.user_id = (select auth.uid()))
        or exists (select 1 from public.game_access a join public.group_members m on m.group_id = a.group_id
                   where a.game_key = g.key and m.user_id = (select auth.uid()))
      )
    )
    or (select private.can_edit_game(p_game_key))
    or (select private.has_permission('live.edit'));
$$;
revoke all on function private.can_manage_access(text), private.can_play_game(text) from public, anon;
grant execute on function private.can_manage_access(text), private.can_play_game(text) to authenticated;

alter table public.game_access enable row level security;
revoke all on public.game_access from anon, authenticated;
grant select, delete, insert (game_key, group_id, user_id) on public.game_access to authenticated;
grant all on public.game_access to service_role;
create policy "Access managers read a game's access" on public.game_access for select to authenticated using ((select private.can_manage_access(game_key)));
create policy "Access managers add access" on public.game_access for insert to authenticated with check ((select private.can_manage_access(game_key)));
create policy "Access managers remove access" on public.game_access for delete to authenticated using ((select private.can_manage_access(game_key)));

create policy "Access managers set access" on public.games for update to authenticated
  using ((select private.can_manage_access(key))) with check ((select private.can_manage_access(key)));

-- Setting access must not let a game admin rename or archive a game that isn't theirs.
create function private.game_update_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.title, new.description, new.archived_at) is distinct from (old.title, old.description, old.archived_at)
     and (select auth.uid()) is not null and not (select private.can_edit_game(old.key)) then
    raise exception 'Only the game’s creator or a platform admin can change that' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger game_update_guard before update on public.games for each row execute function private.game_update_guard();
revoke all on function private.game_update_guard() from public, anon, authenticated;

-- Live content and runs follow access.
drop policy "Players, creators and result viewers read the live game" on public.game_content;
create policy "Players read live games they may play" on public.game_content
  for select to authenticated using (stage = 'live' and (select private.can_play_game(game_key)));

drop policy "Players start their own runs" on public.game_runs;
create policy "Players start their own runs" on public.game_runs
  for insert to authenticated
  with check (
    (select private.has_permission('games.play'))
    and not exists (select 1 from public.games g where g.key = game_runs.game_key and g.archived_at is not null)
    and case when test
      then (select private.can_edit_game(game_key)) or (select private.has_permission('live.edit'))
      else (select private.can_play_game(game_key)) end
  );

-- ---------------------------------------------------------------------------
-- Content added to the live game, and drafts that fall behind it
-- ---------------------------------------------------------------------------

alter table public.game_content
  add column data_revision integer not null default 0,
  add column base_revision integer not null default 0;

/** Called by the game-content function after a passed review: the new content goes live, with its check. */
create function public.publish_live_content(p_game_key text, p_data jsonb, p_fingerprint text, p_checked_by uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_data jsonb;
  revision integer;
  live_version integer;
begin
  select c.content->'data', c.data_revision into old_data, revision
    from public.game_content c where c.game_key = p_game_key and c.stage = 'live' for update;
  if revision is null then
    raise exception 'This game isn’t published' using errcode = 'P0002';
  end if;
  update public.game_content set content = jsonb_set(content, '{data}', p_data), data_revision = revision + 1
    where game_key = p_game_key and stage = 'live' returning version into live_version;
  insert into public.game_checks (game_key, fingerprint, passed, reasons, checked_by) values (p_game_key, p_fingerprint, true, '[]', p_checked_by);
  -- A draft that still has the old content follows; a changed draft is left alone and falls behind.
  update public.game_content set content = jsonb_set(content, '{data}', p_data), base_revision = revision + 1
    where game_key = p_game_key and stage = 'draft' and content->'data' is not distinct from old_data;
  return live_version;
end;
$$;
revoke all on function public.publish_live_content(text, jsonb, text, uuid) from public, anon, authenticated;
grant execute on function public.publish_live_content(text, jsonb, text, uuid) to service_role;

/** The creator takes the live content into their draft (their code stays). */
create function public.take_in_live(p_game_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  live_data jsonb;
  revision integer;
begin
  if not (select private.can_edit_game(p_game_key)) then
    raise exception 'Only the game’s creator or a platform admin can do that' using errcode = '42501';
  end if;
  select c.content->'data', c.data_revision into live_data, revision from public.game_content c where c.game_key = p_game_key and c.stage = 'live';
  if revision is null then
    raise exception 'This game isn’t published' using errcode = 'P0002';
  end if;
  update public.game_content set content = jsonb_set(content, '{data}', coalesce(live_data, 'null'::jsonb)), base_revision = revision
    where game_key = p_game_key and stage = 'draft';
end;
$$;
revoke all on function public.take_in_live(text) from public, anon;
grant execute on function public.take_in_live(text) to authenticated;

-- Publishing refuses a draft that is behind live, and records the revision it was built from.
create or replace function public.publish_game(p_game_key text)
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
begin
  if not (select private.has_permission('workflow.publish')) or not (select private.can_edit_game(p_game_key)) then
    raise exception 'You can’t publish this game' using errcode = '42501';
  end if;
  select c.content, c.base_revision into content, base from public.game_content c where c.game_key = p_game_key and c.stage = 'draft' for update;
  if content is null then
    raise exception 'This game has no draft to publish' using errcode = 'P0002';
  end if;
  select c.data_revision into revision from public.game_content c where c.game_key = p_game_key and c.stage = 'live' for update;
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
  return live_version;
end;
$$;
revoke all on function public.publish_game(text) from public, anon;
grant execute on function public.publish_game(text) to authenticated;
