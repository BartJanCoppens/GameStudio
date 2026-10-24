-- Archive and delete games.
-- Archive: the game leaves players' libraries and can't be started; its runs and leaderboard stay, and it can be
-- restored. Delete: the game and everything with it (content, runs, checks, contributions) go for good; its
-- creator or a platform admin may delete it, published or not.

alter table public.games add column archived_at timestamptz;
grant update (archived_at) on public.games to authenticated;

drop policy "Creators delete their unpublished games" on public.games;
create policy "Creators and platform admins delete games" on public.games
  for delete to authenticated using ((select private.can_edit_game(key)));

drop policy "Players start their own runs" on public.game_runs;
create policy "Players start their own runs" on public.game_runs
  for insert to authenticated
  with check (
    (select private.has_permission('games.play'))
    and (not test or (select private.can_edit_game(game_key)))
    and not exists (select 1 from public.games g where g.key = game_key and g.archived_at is not null)
  );
