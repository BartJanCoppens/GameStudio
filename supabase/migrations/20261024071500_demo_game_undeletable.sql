-- The demo game has no stored live version (players get its built-in content), so the "unpublished"
-- check alone let any creator delete it, with its runs and chats. It can't be deleted at all now.
drop policy "Creators delete their unpublished games" on public.games;
create policy "Creators delete their unpublished games" on public.games
  for delete to authenticated
  using (
    key <> 'invoice-errors'
    and (select private.can_edit_game(key))
    and not exists (select 1 from public.game_content c where c.game_key = games.key and c.stage = 'live')
  );
