-- The players' leaderboard for turn-taking games (wins, draws, losses over finished games), and devices that
-- change hands: signing in on a shared device takes its notifications over from the previous person.

create function public.turn_leaderboard(p_game_key text)
returns table (name text, wins integer, draws integer, losses integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not ((select private.has_permission('games.play')) or (select private.has_permission('results.view'))) or not (select private.can_play_game(p_game_key)) then
    raise exception 'This game isn’t available' using errcode = '42501';
  end if;
  return query
    with sides as (
      select m.player_a as player, m.a_name as who, case when m.winner is null then 'draw' when m.winner = 'a' then 'win' else 'loss' end as outcome
        from public.matches m where m.game_key = p_game_key and m.status = 'finished'
      union all
      select m.player_b, m.b_name, case when m.winner is null then 'draw' when m.winner = 'b' then 'win' else 'loss' end
        from public.matches m where m.game_key = p_game_key and m.status = 'finished'
    )
    select max(s.who), count(*) filter (where s.outcome = 'win')::integer, count(*) filter (where s.outcome = 'draw')::integer, count(*) filter (where s.outcome = 'loss')::integer
      from sides s group by s.player order by 2 desc, 3 desc, 4 asc, 1 limit 50;
end;
$$;
revoke all on function public.turn_leaderboard(text) from public, anon;
grant execute on function public.turn_leaderboard(text) to authenticated;

create function public.claim_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ((select auth.uid()), p_endpoint, p_p256dh, p_auth)
    on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, created_at = now();
$$;
revoke all on function public.claim_push_subscription(text, text, text) from public, anon;
grant execute on function public.claim_push_subscription(text, text, text) to authenticated;
