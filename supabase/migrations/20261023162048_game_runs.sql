-- One row per play of "Spot the invoice errors".
--
-- The browser saves answers as the player goes and the score when they finish. The database owns
-- who played and when: it stamps the player, the start, the finish and the duration itself, and a
-- finished run can no longer change. Leaderboards and the game admin's results read finished runs.

create table public.game_runs (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  game_key         text not null default 'invoice-errors' check (game_key = 'invoice-errors'),
  -- Name and cohort as they were when the run started, so leaderboards need no access to profiles.
  player_name      text not null default '',
  player_cohort    text not null default '',
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  duration_seconds integer check (duration_seconds >= 0),
  invoices_correct smallint check (invoices_correct between 0 and 12),
  errors_found     smallint check (errors_found between 0 and 7),
  false_flags      smallint check (false_flags >= 0),
  points           integer check (points <= 70),
  -- [{ invoice: 1..12, flags: [{ field, rule }] }]
  answers          jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  created_at       timestamptz not null default now(),
  -- A finished run carries its score.
  check (finished_at is null or (invoices_correct is not null and errors_found is not null and false_flags is not null and points is not null))
);
create index game_runs_user_id_idx on public.game_runs (user_id);
create index game_runs_finished_idx on public.game_runs (game_key, finished_at) where finished_at is not null;

create function private.game_run_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := (select auth.uid());
  new.started_at := now();
  new.finished_at := null;
  new.duration_seconds := null;
  select p.full_name, p.cohort into new.player_name, new.player_cohort from public.profiles p where p.id = new.user_id;
  new.player_name := coalesce(nullif(new.player_name, ''), (select p.email from public.profiles p where p.id = new.user_id), '');
  new.player_cohort := coalesce(new.player_cohort, '');
  return new;
end;
$$;

create trigger game_run_before_insert
  before insert on public.game_runs
  for each row execute function private.game_run_before_insert();

create function private.game_run_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.finished_at is not null then
    raise exception 'A finished run cannot change' using errcode = 'check_violation';
  end if;
  if new.finished_at is not null then
    -- The clock is the server's: the run ends now, and counts at most the 15 minutes the game allows.
    new.finished_at := now();
    new.duration_seconds := least(900, greatest(0, extract(epoch from (now() - old.started_at))::integer));
  end if;
  return new;
end;
$$;

create trigger game_run_before_update
  before update on public.game_runs
  for each row execute function private.game_run_before_update();

revoke all on function private.game_run_before_insert() from public, anon, authenticated;
revoke all on function private.game_run_before_update() from public, anon, authenticated;

alter table public.game_runs enable row level security;
revoke all on public.game_runs from anon, authenticated;
grant select on public.game_runs to authenticated;
grant insert (game_key) on public.game_runs to authenticated;
grant update (answers, finished_at, invoices_correct, errors_found, false_flags, points) on public.game_runs to authenticated;
grant all on public.game_runs to service_role;

create policy "Players start their own runs" on public.game_runs
  for insert to authenticated
  with check ((select private.has_permission('games.play')));

create policy "Players save their unfinished runs" on public.game_runs
  for update to authenticated
  using ((select auth.uid()) = user_id and finished_at is null)
  with check ((select auth.uid()) = user_id);

create policy "Players read their own runs" on public.game_runs
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Leaderboards (players) and results (creators, game admins, admins) read finished runs.
create policy "Finished runs are visible to players and result viewers" on public.game_runs
  for select to authenticated
  using (finished_at is not null and ((select private.has_permission('games.play')) or (select private.has_permission('results.view'))));
