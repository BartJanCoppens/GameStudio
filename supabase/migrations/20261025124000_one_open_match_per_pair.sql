-- Security review: one open invitation or game per pair and game, enforced by the database (two crossing
-- invitations can't both pass the function's check).
create unique index matches_one_open_per_pair on public.matches (game_key, least(player_a, player_b), greatest(player_a, player_b))
  where status in ('invited', 'waiting', 'active');
