-- game-match asks whether a given person may play a game (the inviter, the invited colleague, the mover).
create function public.can_user_play(p_game_key text, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.can_play_game_as(p_game_key, p_user); $$;
revoke all on function public.can_user_play(text, uuid) from public, anon, authenticated;
grant execute on function public.can_user_play(text, uuid) to service_role;
