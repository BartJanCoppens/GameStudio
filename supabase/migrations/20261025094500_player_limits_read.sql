-- Reading a game's per-player limits is for its own game admin as well (the defaults stay readable by everyone
-- they apply to, through "Users read the limits that apply to them").
drop policy "Player limit managers read player limits" on public.usage_limits;
create policy "Player limit managers read player limits" on public.usage_limits
  for select to authenticated
  using (audience = 'players' and (select private.has_permission('players.limits')) and (select private.is_game_admin(game_key)));
