-- AI-built games of any kind replace the hand-built invoice game.
--
-- Removes the demo game and everything only it needed; runs get a generic score; the AI role's hidden
-- knowledge lives apart from the content players read; every publish needs a passed house-rules check
-- on exactly the content being published; common-goal games collect contributions; the admin's house
-- rules live in ai_settings.

-- ---------------------------------------------------------------------------
-- The invoice game goes
-- ---------------------------------------------------------------------------

delete from public.games where key = 'invoice-errors';
drop table public.studio_chat_messages;
drop table public.studio_chats;

create or replace function private.can_edit_game(p_game_key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select private.has_permission('games.create')) and exists (
    select 1 from public.games g
    where g.key = p_game_key
      and (g.created_by = (select auth.uid()) or (select private.has_permission('users.manage')))
  );
$$;

drop policy "Creators delete their unpublished games" on public.games;
create policy "Creators delete their unpublished games" on public.games
  for delete to authenticated
  using ((select private.can_edit_game(key)) and not exists (select 1 from public.game_content c where c.game_key = games.key and c.stage = 'live'));

-- ---------------------------------------------------------------------------
-- Runs: a score instead of invoice counts
-- ---------------------------------------------------------------------------

alter table public.game_runs
  drop constraint game_runs_check,
  drop column answers,
  drop column invoices_correct,
  drop column errors_found,
  drop column false_flags,
  drop column points,
  add column score numeric check (score is null or (score > -1e9 and score < 1e9)),
  add column details jsonb not null default '{}'::jsonb check (pg_column_size(details) < 16384),
  add column test boolean not null default false,
  add constraint game_runs_finished_has_score check (finished_at is null or score is not null);

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
    -- The clock is the server's.
    new.finished_at := now();
    new.duration_seconds := least(86400, greatest(0, extract(epoch from (now() - old.started_at))::integer));
  end if;
  return new;
end;
$$;

revoke insert, update on public.game_runs from authenticated;
grant insert (game_key, content_version, test) on public.game_runs to authenticated;
grant update (finished_at, score, details) on public.game_runs to authenticated;

drop policy "Players start their own runs" on public.game_runs;
-- A test run is a creator trying their own draft.
create policy "Players start their own runs" on public.game_runs
  for insert to authenticated
  with check ((select private.has_permission('games.play')) and (not test or (select private.can_edit_game(game_key))));

-- ---------------------------------------------------------------------------
-- Content: larger games; live is written only by publish_game
-- ---------------------------------------------------------------------------

alter table public.game_content drop constraint game_content_content_check;
alter table public.game_content add constraint game_content_content_check check (jsonb_typeof(content) = 'object' and pg_column_size(content) < 1048576);
revoke insert, update on public.game_content from authenticated;
grant insert (game_key, stage, content) on public.game_content to authenticated;
grant update (content) on public.game_content to authenticated;
drop policy "Publishers create the live version of games they edit" on public.game_content;
drop policy "Publishers update the live version of games they edit" on public.game_content;

-- ---------------------------------------------------------------------------
-- The AI role's hidden knowledge: editors read and write the draft; nobody reads live but the server
-- ---------------------------------------------------------------------------

create table public.game_secrets (
  game_key text not null references public.games (key) on delete cascade,
  stage    text not null check (stage in ('draft', 'live')),
  ai       jsonb not null default '{}'::jsonb check (jsonb_typeof(ai) = 'object' and pg_column_size(ai) < 65536),
  primary key (game_key, stage)
);
alter table public.game_secrets enable row level security;
revoke all on public.game_secrets from anon, authenticated;
grant select, insert (game_key, stage, ai), update (ai) on public.game_secrets to authenticated;
grant all on public.game_secrets to service_role;
create policy "Editors read the draft secret" on public.game_secrets
  for select to authenticated using (stage = 'draft' and (select private.can_edit_game(game_key)));
create policy "Editors add the draft secret" on public.game_secrets
  for insert to authenticated with check (stage = 'draft' and (select private.can_edit_game(game_key)));
create policy "Editors change the draft secret" on public.game_secrets
  for update to authenticated
  using (stage = 'draft' and (select private.can_edit_game(game_key)))
  with check (stage = 'draft' and (select private.can_edit_game(game_key)));

-- ---------------------------------------------------------------------------
-- House-rules checks, written by the game-check function; fingerprinted on exactly what was checked
-- ---------------------------------------------------------------------------

create table public.game_checks (
  id          bigint generated always as identity primary key,
  game_key    text not null references public.games (key) on delete cascade,
  fingerprint text not null,
  passed      boolean not null,
  reasons     jsonb not null default '[]'::jsonb check (jsonb_typeof(reasons) = 'array'),
  checked_by  uuid references public.profiles (id) on delete set null,
  checked_at  timestamptz not null default now()
);
create index game_checks_game_idx on public.game_checks (game_key, id desc);
alter table public.game_checks enable row level security;
revoke all on public.game_checks from anon, authenticated;
grant select on public.game_checks to authenticated;
grant all on public.game_checks to service_role;
create policy "Editors read their game's checks" on public.game_checks
  for select to authenticated using ((select private.can_edit_game(game_key)));

create function public.draft_fingerprint(p_game_key text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select md5(c.content::text || coalesce((select s.ai::text from public.game_secrets s where s.game_key = p_game_key and s.stage = 'draft'), ''))
  from public.game_content c
  where c.game_key = p_game_key and c.stage = 'draft';
$$;
revoke all on function public.draft_fingerprint(text) from public, anon, authenticated;
grant execute on function public.draft_fingerprint(text) to service_role;

-- ---------------------------------------------------------------------------
-- Publishing: permission, the right to edit the game, and a passed check on this exact draft
-- ---------------------------------------------------------------------------

create function public.publish_game(p_game_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest public.game_checks;
  draft  public.game_content;
  live_version integer;
begin
  if not (select private.has_permission('workflow.publish')) or not (select private.can_edit_game(p_game_key)) then
    raise exception 'You can’t publish this game' using errcode = '42501';
  end if;
  select * into draft from public.game_content where game_key = p_game_key and stage = 'draft';
  if draft is null then
    raise exception 'This game has no draft to publish' using errcode = 'P0002';
  end if;
  select * into latest from public.game_checks where game_key = p_game_key order by id desc limit 1;
  if latest is null or not latest.passed or latest.fingerprint is distinct from public.draft_fingerprint(p_game_key) then
    raise exception 'A passed house-rules check is required for this exact version. The game changed since the house-rules check, or it hasn’t been checked. Check again.' using errcode = 'P0001';
  end if;

  insert into public.game_content (game_key, stage, content) values (p_game_key, 'live', draft.content)
    on conflict (game_key, stage) do update set content = excluded.content
    returning version into live_version;
  insert into public.game_secrets (game_key, stage, ai)
    select p_game_key, 'live', s.ai from public.game_secrets s where s.game_key = p_game_key and s.stage = 'draft'
    on conflict (game_key, stage) do update set ai = excluded.ai;
  return live_version;
end;
$$;
revoke all on function public.publish_game(text) from public, anon;
grant execute on function public.publish_game(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Common goal: each player's contributions add up per game
-- ---------------------------------------------------------------------------

create table public.game_contributions (
  id         bigint generated always as identity primary key,
  game_key   text not null references public.games (key) on delete cascade,
  run_id     uuid not null references public.game_runs (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  amount     numeric not null check (amount > 0 and amount <= 1000),
  note       text not null default '' check (length(note) <= 140),
  created_at timestamptz not null default now()
);
create index game_contributions_game_idx on public.game_contributions (game_key);
create index game_contributions_run_idx on public.game_contributions (run_id);

create function private.game_contribution_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := (select auth.uid());
  if not exists (
    select 1 from public.game_runs r
    where r.id = new.run_id and r.user_id = new.user_id and r.game_key = new.game_key and r.finished_at is null and not r.test
  ) then
    raise exception 'Contributions need your own unfinished run of this game' using errcode = '42501';
  end if;
  if (select count(*) from public.game_contributions c where c.run_id = new.run_id) >= 50 then
    raise exception 'At most 50 contributions per run' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger game_contribution_before_insert before insert on public.game_contributions
  for each row execute function private.game_contribution_before_insert();
revoke all on function private.game_contribution_before_insert() from public, anon, authenticated;

alter table public.game_contributions enable row level security;
revoke all on public.game_contributions from anon, authenticated;
grant select, insert (game_key, run_id, amount, note) on public.game_contributions to authenticated;
grant all on public.game_contributions to service_role;
create policy "Players add to their own runs" on public.game_contributions
  for insert to authenticated with check ((select private.has_permission('games.play')));
create policy "Players and editors read contributions" on public.game_contributions
  for select to authenticated
  using ((select private.has_permission('games.play')) or (select private.has_permission('results.view')) or (select private.can_edit_game(game_key)));

-- ---------------------------------------------------------------------------
-- House rules, set by the platform admin through the ai-services function
-- ---------------------------------------------------------------------------

alter table public.ai_settings drop constraint ai_settings_key_check;
alter table public.ai_settings add constraint ai_settings_key_check check (key in ('studio_assistant', 'house_rules'));
insert into public.ai_settings (key, value) values ('house_rules', jsonb_build_object(
  'rules', jsonb_build_array('Non-violent', 'Professional and respectful tone', 'No real people or companies unless they are in the linked source material', 'No gambling with real money'),
  'context', 'Players are Deloitte professionals'
)) on conflict (key) do nothing;
