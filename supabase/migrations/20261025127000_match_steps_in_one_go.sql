-- Final review: the steps of a match are single statements in the database, so they can't overwrite each other
-- or half-happen. Called only by game-match (service role).

/** A live match's player is present; the match starts when both are (each call sets only its own flag). */
create function public.match_ready(p_match_id uuid, p_side text, p_turn_seconds integer)
returns text
language sql
security definer
set search_path = ''
as $$
  update public.matches set
    a_ready = a_ready or p_side = 'a',
    b_ready = b_ready or p_side = 'b',
    status = case when (a_ready or p_side = 'a') and (b_ready or p_side = 'b') then 'active' else status end,
    turn_ends_at = case when (a_ready or p_side = 'a') and (b_ready or p_side = 'b') then now() + make_interval(secs => p_turn_seconds) else turn_ends_at end,
    last_activity_at = case when (a_ready or p_side = 'a') and (b_ready or p_side = 'b') then now() else last_activity_at end
  where id = p_match_id and status = 'waiting'
  returning status;
$$;

/** A move: the match, the move log and the mover's own secrets together, or nothing ("The game moved on"). */
create function public.match_move(p_match_id uuid, p_side text, p_move_no integer, p_move jsonb, p_state jsonb, p_mine jsonb,
  p_set_mine boolean, p_finish boolean, p_winner text, p_turn_seconds integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_no integer;
begin
  update public.matches m set
    move_no = m.move_no + 1, turn = case when p_side = 'a' then 'b' else 'a' end, state = p_state, last_move = p_move, last_activity_at = now(),
    turn_ends_at = case when m.way = 'live' and not p_finish then now() + make_interval(secs => p_turn_seconds) end,
    status = case when p_finish then 'finished' else m.status end,
    winner = case when p_finish then p_winner else m.winner end,
    finished_at = case when p_finish then now() else m.finished_at end
  where m.id = p_match_id and m.status = 'active' and m.turn = p_side and m.move_no = p_move_no
  returning m.move_no into next_no;
  if next_no is null then
    raise exception 'The game moved on. It has been reloaded.' using errcode = 'P0001';
  end if;
  insert into public.match_moves (match_id, move_no, side, move) values (p_match_id, p_move_no, p_side, p_move);
  if p_set_mine then
    insert into public.match_private (match_id, side, state) values (p_match_id, p_side, p_mine)
      on conflict (match_id, side) do update set state = excluded.state;
  end if;
  return next_no;
end;
$$;

/** The waiting player passes on a live turn whose time is up. The passer's own last move is no news to them. */
create function public.match_pass(p_match_id uuid, p_side text, p_move_no integer, p_turn_seconds integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_turn text;
begin
  update public.matches m set turn = p_side, move_no = m.move_no + 1, last_move = null, turn_ends_at = now() + make_interval(secs => p_turn_seconds)
  where m.id = p_match_id and m.status = 'active' and m.way = 'live' and m.turn <> p_side and m.move_no = p_move_no and m.turn_ends_at <= now()
  returning m.turn into next_turn;
  if next_turn is null then
    raise exception 'There is no turn to pass yet' using errcode = 'P0001';
  end if;
  return next_turn;
end;
$$;

revoke all on function public.match_ready(uuid, text, integer), public.match_move(uuid, text, integer, jsonb, jsonb, jsonb, boolean, boolean, text, integer), public.match_pass(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.match_ready(uuid, text, integer), public.match_move(uuid, text, integer, jsonb, jsonb, jsonb, boolean, boolean, text, integer), public.match_pass(uuid, text, integer, integer) to service_role;
