-- More than one game. Every game is an "invoice errors" game (same engine, rules and source document)
-- with its own title, draft and live content, runs, chats and AI keys. The demo game keeps its key.
--
-- Creators edit the games they created; the demo game (no creator) is editable by every creator,
-- and platform admins (users.manage) can edit any game. (Narrowed in 20261024070000.) Publishing still needs workflow.publish.

create table public.games (
  key         text primary key check (key ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
  title       text not null check (length(title) between 1 and 80),
  description text not null default '' check (length(description) <= 300),
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index games_created_by_idx on public.games (created_by);

insert into public.games (key, title, description) values
  ('invoice-errors', 'Spot the invoice errors', 'Twelve invoices, seven planted errors. Flag what breaks the Belgian invoice rules.');

create function private.game_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then new.created_by := (select auth.uid()); end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger game_stamp before insert or update on public.games
  for each row execute function private.game_stamp();
revoke all on function private.game_stamp() from public, anon, authenticated;

create function private.can_edit_game(p_game_key text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select (select private.has_permission('games.create')) and exists (
    select 1 from public.games g
    where g.key = p_game_key
      and (g.created_by is null or g.created_by = (select auth.uid()) or (select private.has_permission('users.manage')))
  );
$$;
revoke all on function private.can_edit_game(text) from public, anon;
grant execute on function private.can_edit_game(text) to authenticated;

alter table public.games enable row level security;
revoke all on public.games from anon, authenticated;
-- Titles aren't secret; what a game contains is protected on game_content.
grant select, delete on public.games to authenticated;
grant insert (key, title, description) on public.games to authenticated;
grant update (title, description) on public.games to authenticated;
grant all on public.games to service_role;

create policy "Signed-in users read the games list" on public.games
  for select to authenticated using (true);
create policy "Creators add games" on public.games
  for insert to authenticated with check ((select private.has_permission('games.create')));
create policy "Creators rename their games" on public.games
  for update to authenticated
  using ((select private.can_edit_game(key)))
  with check ((select private.can_edit_game(key)));
-- Only a game nobody can play yet; a published game has runs and a leaderboard.
create policy "Creators delete their unpublished games" on public.games
  for delete to authenticated
  using ((select private.can_edit_game(key)) and not exists (select 1 from public.game_content c where c.game_key = games.key and c.stage = 'live'));

-- ---------------------------------------------------------------------------
-- Every table that was tied to the one demo game now points at a game
-- ---------------------------------------------------------------------------

alter table public.game_content drop constraint game_content_game_key_check, alter column game_key drop default,
  add constraint game_content_game_key_fkey foreign key (game_key) references public.games (key) on delete cascade;
alter table public.game_runs drop constraint game_runs_game_key_check, alter column game_key drop default,
  add constraint game_runs_game_key_fkey foreign key (game_key) references public.games (key) on delete cascade;
alter table public.studio_chats drop constraint studio_chats_game_key_check, alter column game_key drop default,
  add constraint studio_chats_game_key_fkey foreign key (game_key) references public.games (key) on delete cascade;
create index studio_chats_game_idx on public.studio_chats (game_key);
alter table public.ai_services drop constraint ai_services_check,
  add constraint ai_services_game_key_check check ((scope = 'platform' and game_key is null) or (scope = 'game' and game_key is not null)),
  add constraint ai_services_game_key_fkey foreign key (game_key) references public.games (key) on delete cascade;
create index ai_services_game_idx on public.ai_services (game_key);

-- Drafts: only creators who may edit that game.
drop policy "Creators read the draft" on public.game_content;
drop policy "Creators save the draft" on public.game_content;
drop policy "Creators update the draft" on public.game_content;
create policy "Creators read the drafts of games they edit" on public.game_content
  for select to authenticated
  using (stage = 'draft' and (select private.can_edit_game(game_key)));
create policy "Creators save the drafts of games they edit" on public.game_content
  for insert to authenticated
  with check (stage = 'draft' and (select private.can_edit_game(game_key)));
create policy "Creators update the drafts of games they edit" on public.game_content
  for update to authenticated
  using (stage = 'draft' and (select private.can_edit_game(game_key)))
  with check (stage = 'draft' and (select private.can_edit_game(game_key)));
