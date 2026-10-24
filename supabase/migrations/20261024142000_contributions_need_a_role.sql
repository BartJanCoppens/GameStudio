-- Contributions: the access rule and a role that plays, views results or edits the game.
drop policy "People who may play the game read its contributions" on public.game_contributions;
create policy "People who may play the game read its contributions" on public.game_contributions
  for select to authenticated
  using (((select private.has_permission('games.play')) or (select private.has_permission('results.view')) or (select private.can_edit_game(game_key)))
    and (select private.can_play_game(game_key)));
