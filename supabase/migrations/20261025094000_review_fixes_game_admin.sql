-- Fixes from the final review of the assigned game admin.

-- Unpublished drafts are the creator's: a new game starts closed (publish_game keeps it closed until the game
-- admin opens it), so can_play_game no longer lets everyone see drafts.
alter table public.games alter column access set default 'restricted';
update public.games g set access = 'restricted'
  where not exists (select 1 from public.game_content c where c.game_key = g.key and c.stage = 'live');

-- Per-game AI settings, player limits and in-game AI usage belong to the game's own game admin too.
drop policy "Player limit managers set player limits" on public.usage_limits;
drop policy "Player limit managers change player limits" on public.usage_limits;
drop policy "Player limit managers remove player limits" on public.usage_limits;
create policy "Player limit managers set player limits" on public.usage_limits
  for insert to authenticated
  with check (audience = 'players' and (select private.has_permission('players.limits')) and (select private.is_game_admin(game_key)));
create policy "Player limit managers change player limits" on public.usage_limits
  for update to authenticated
  using (audience = 'players' and (select private.has_permission('players.limits')) and (select private.is_game_admin(game_key)))
  with check (audience = 'players' and (select private.has_permission('players.limits')) and (select private.is_game_admin(game_key)));
create policy "Player limit managers remove player limits" on public.usage_limits
  for delete to authenticated
  using (audience = 'players' and (select private.has_permission('players.limits')) and (select private.is_game_admin(game_key)));

drop policy "Player limit managers read the game's AI calls" on public.studio_ai_calls;
create policy "Player limit managers read the game's AI calls" on public.studio_ai_calls
  for select to authenticated
  using (kind = 'game' and (select private.has_permission('players.limits')) and (select private.is_game_admin(game_key)));

drop policy "Game AI managers read game and platform services" on public.ai_services;
-- Game admins see the platform rows too, to know what their game falls back to.
create policy "Game AI managers read game and platform services" on public.ai_services
  for select to authenticated
  using ((select private.has_permission('ai.game')) and (scope = 'platform' or (select private.is_game_admin(game_key))));
