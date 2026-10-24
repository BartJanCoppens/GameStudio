-- Game content in the database, a draft for creators and a live version for players,
-- and a log of Studio AI calls so the studio-chat function can rate-limit per user.
--
-- The content is the game's invoices and planted errors (JSON). The rules and the source
-- document stay in the app: the AI can only plant errors against rules that cite the document.

create table public.game_content (
  game_key   text not null default 'invoice-errors' check (game_key = 'invoice-errors'),
  stage      text not null check (stage in ('draft', 'live')),
  -- { invoices: [...], errors: [...] }; capped so one save can't bloat the table.
  content    jsonb not null check (jsonb_typeof(content) = 'object' and pg_column_size(content) < 262144),
  version    integer not null default 1,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (game_key, stage)
);

create function private.game_content_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  new.version := case when tg_op = 'UPDATE' then old.version + 1 else 1 end;
  return new;
end;
$$;

create trigger game_content_stamp
  before insert or update on public.game_content
  for each row execute function private.game_content_stamp();

revoke all on function private.game_content_stamp() from public, anon, authenticated;

alter table public.game_content enable row level security;
revoke all on public.game_content from anon, authenticated;
grant select on public.game_content to authenticated;
grant insert (game_key, stage, content) on public.game_content to authenticated;
grant update (content) on public.game_content to authenticated;
grant all on public.game_content to service_role;

-- Live: everyone who plays, creates or views results reads it. Draft: creators only.
create policy "Players, creators and result viewers read the live game" on public.game_content
  for select to authenticated
  using (stage = 'live' and ((select private.has_permission('games.play')) or (select private.has_permission('games.create')) or (select private.has_permission('results.view'))));
create policy "Creators read the draft" on public.game_content
  for select to authenticated
  using (stage = 'draft' and (select private.has_permission('games.create')));

-- Writing the draft needs "Create a game in the Studio"; publishing to live needs "Approve and publish a version".
create policy "Creators save the draft" on public.game_content
  for insert to authenticated
  with check (stage = 'draft' and (select private.has_permission('games.create')));
create policy "Creators update the draft" on public.game_content
  for update to authenticated
  using (stage = 'draft' and (select private.has_permission('games.create')))
  with check (stage = 'draft' and (select private.has_permission('games.create')));
create policy "Publishers create the live game" on public.game_content
  for insert to authenticated
  with check (stage = 'live' and (select private.has_permission('workflow.publish')));
create policy "Publishers update the live game" on public.game_content
  for update to authenticated
  using (stage = 'live' and (select private.has_permission('workflow.publish')))
  with check (stage = 'live' and (select private.has_permission('workflow.publish')));

-- Runs remember which live version they were played on; the game can now have any number
-- of invoices and errors, so the fixed upper bounds go.
alter table public.game_runs add column content_version integer not null default 0 check (content_version >= 0);
grant insert (game_key, content_version) on public.game_runs to authenticated;
alter table public.game_runs drop constraint game_runs_invoices_correct_check;
alter table public.game_runs drop constraint game_runs_errors_found_check;
alter table public.game_runs drop constraint game_runs_points_check;
alter table public.game_runs add constraint game_runs_invoices_correct_check check (invoices_correct >= 0);
alter table public.game_runs add constraint game_runs_errors_found_check check (errors_found >= 0);

-- One row per call to the studio-chat function. Written only by the function (service role);
-- no client access.
create table public.studio_ai_calls (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  status     text not null,
  created_at timestamptz not null default now()
);
create index studio_ai_calls_user_time_idx on public.studio_ai_calls (user_id, created_at desc);
alter table public.studio_ai_calls enable row level security;
revoke all on public.studio_ai_calls from anon, authenticated;
grant all on public.studio_ai_calls to service_role;
