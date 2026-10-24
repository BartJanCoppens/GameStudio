-- A restricted game's finished runs (its leaderboard) and its common-goal contributions are visible only to
-- people who may play it, the same rule as its live content. can_play exposes that rule to Edge Functions,
-- asked as the signed-in user.

drop policy "Finished runs are visible to players and result viewers" on public.game_runs;
create policy "Finished runs are visible to people who may play the game" on public.game_runs
  for select to authenticated
  using (finished_at is not null
    and ((select private.has_permission('games.play')) or (select private.has_permission('results.view')))
    and (select private.can_play_game(game_key)));

drop policy "Players and editors read contributions" on public.game_contributions;
create policy "People who may play the game read its contributions" on public.game_contributions
  for select to authenticated using ((select private.can_play_game(game_key)));

create function public.can_play(p_game_key text)
returns boolean
language sql
stable
set search_path = ''
as $$ select private.can_play_game(p_game_key); $$;
revoke all on function public.can_play(text) from public, anon;
grant execute on function public.can_play(text) to authenticated;
