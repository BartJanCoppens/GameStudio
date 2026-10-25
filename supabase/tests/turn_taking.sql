-- Checks for 20261025120000_turn_taking.sql. Run with npm run test:sql; rolls back by raising its results.
do $$
declare
  owner_ uuid := gen_random_uuid();
  pa     uuid := gen_random_uuid();
  pb     uuid := gen_random_uuid();
  pc     uuid := gen_random_uuid();
  ga     uuid := gen_random_uuid();
  ga2    uuid := gen_random_uuid();
  k      text := 'sqltest5-duel';
  k2     text := 'sqltest5-closed';
  m      uuid;
  results text[] := '{}';
  n int;
  ok boolean;
  as_user text := 'set local role authenticated';
begin
  insert into auth.users (id, email, aud, role) values
    (owner_, 'sqltest5-owner@example.com', 'authenticated', 'authenticated'), (pa, 'sqltest5-a@example.com', 'authenticated', 'authenticated'),
    (pb, 'sqltest5-b@example.com', 'authenticated', 'authenticated'), (pc, 'sqltest5-c@example.com', 'authenticated', 'authenticated'),
    (ga, 'sqltest5-ga@example.com', 'authenticated', 'authenticated'), (ga2, 'sqltest5-ga2@example.com', 'authenticated', 'authenticated');
  insert into public.user_roles (user_id, role_key) values (owner_, 'creator'), (pa, 'player'), (pb, 'player'), (pc, 'player'), (ga, 'gameadmin'), (ga2, 'gameadmin');
  insert into public.games (key, title) values (k, 'Duel'), (k2, 'Closed duel');
  update public.games set created_by = owner_ where key in (k, k2);
  insert into public.game_content (game_key, stage, content) values (k, 'draft', '{"phase":"ready","data":{"q":[1]}}'), (k2, 'draft', '{"phase":"ready","data":{"q":[1]}}');
  insert into public.game_checks (game_key, fingerprint, passed, reasons) values (k, public.draft_fingerprint(k), true, '[]'), (k2, public.draft_fingerprint(k2), true, '[]');

  -- (v1) publishing keeps a snapshot of the version
  perform set_config('request.jwt.claims', json_build_object('sub', owner_, 'role', 'authenticated')::text, true);
  execute as_user;
  perform public.publish_game(k, ga);
  perform public.publish_game(k2, ga);
  execute 'reset role';
  update public.games set access = 'everyone' where key = k;
  insert into public.game_access (game_key, user_id) values (k2, pa), (k2, pb);
  select count(*) from public.game_versions where game_key = k into n;
  results := array_append(results, case when n = 1 then 'ok v1' else format('FAIL v1: %s versions after the first publish', n) end);

  -- (v2) a republish keeps the earlier version too
  update public.game_content set content = '{"phase":"ready","data":{"q":[1,2]}}' where game_key = k and stage = 'draft';
  insert into public.game_checks (game_key, fingerprint, passed, reasons) values (k, public.draft_fingerprint(k), true, '[]');
  perform set_config('request.jwt.claims', json_build_object('sub', owner_, 'role', 'authenticated')::text, true);
  execute as_user;
  perform public.publish_game(k);
  execute 'reset role';
  select count(*) = 2 and bool_or(content->'data' = '{"q":[1]}') and bool_or(content->'data' = '{"q":[1,2]}') from public.game_versions where game_key = k into ok;
  results := array_append(results, case when ok then 'ok v2' else 'FAIL v2: the first version was not kept' end);

  -- (v3) content a game admin adds is a version too
  perform public.publish_live_content(k, '{"q":[1,2,3]}', 'fp', ga);
  select count(*) from public.game_versions where game_key = k into n;
  results := array_append(results, case when n = 3 then 'ok v3' else format('FAIL v3: %s versions after added content', n) end);

  insert into public.matches (game_key, version, way, status, player_a, player_b, a_name, b_name, turn, last_activity_at)
    values (k, 1, 'async', 'active', pa, pb, 'A', 'B', 'b', now()) returning id into m;
  insert into public.match_private (match_id, side, state) values (m, 'a', '{"ships":"C3"}'), (m, 'b', '{"ships":"A1"}');

  -- (m1) players can't write matches directly
  perform set_config('request.jwt.claims', json_build_object('sub', pa, 'role', 'authenticated')::text, true);
  execute as_user;
  begin
    insert into public.matches (game_key, version, way, status, player_a, player_b, a_name, b_name, turn) values (k, 1, 'async', 'active', pa, pc, 'A', 'C', 'b');
    ok := false;
  exception when others then ok := true; end;
  begin
    update public.matches set turn = 'a' where id = m;
    get diagnostics n = row_count;
    ok := ok and n = 0;
  exception when others then null; end;
  results := array_append(results, case when ok then 'ok m1' else 'FAIL m1: a player wrote a match directly' end);
  -- (p1) a player reads their own secrets
  select count(*) = 1 from public.match_private where match_id = m into ok;
  results := array_append(results, case when ok then 'ok p1' else 'FAIL p1: player a can''t read their own private state (or reads more)' end);
  select count(*) = 1 from public.matches where id = m into ok;
  execute 'reset role';

  -- (p2) the other player never reads them
  perform set_config('request.jwt.claims', json_build_object('sub', pb, 'role', 'authenticated')::text, true);
  execute as_user;
  select not exists (select 1 from public.match_private where match_id = m and side = 'a') into ok;
  results := array_append(results, case when ok then 'ok p2' else 'FAIL p2: player b read player a''s secrets' end);
  execute 'reset role';

  -- (m2) someone else doesn't see the match; the game's game admin does
  perform set_config('request.jwt.claims', json_build_object('sub', pc, 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) = 0 from public.matches where id = m into ok;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ga, 'role', 'authenticated')::text, true);
  execute as_user;
  select ok and count(*) = 1 from public.matches where id = m into ok;
  execute 'reset role';
  results := array_append(results, case when ok then 'ok m2' else 'FAIL m2: match visibility wrong' end);

  -- (c1) colleagues to invite: those who may play, not the caller, not outsiders
  perform set_config('request.jwt.claims', json_build_object('sub', pa, 'role', 'authenticated')::text, true);
  execute as_user;
  select exists (select 1 from public.match_candidates(k2) c where c.id = pb)
     and not exists (select 1 from public.match_candidates(k2) c where c.id in (pa, pc)) into ok;
  execute 'reset role';
  results := array_append(results, case when ok then 'ok c1' else 'FAIL c1: wrong colleagues to invite' end);

  -- (x1–x3) invitations expire, quiet matches are cancelled
  update public.matches set status = 'invited', way = 'live', created_at = now() - interval '2 hours', last_activity_at = now() - interval '2 hours' where id = m;
  insert into public.matches (id, game_key, version, way, status, player_a, player_b, a_name, b_name, turn, created_at, last_activity_at) values
    ('00000000-0000-4000-8000-000000000a01', k, 1, 'async', 'invited', pa, pb, 'A', 'B', 'b', now() - interval '2 hours', now() - interval '2 hours'),
    ('00000000-0000-4000-8000-000000000a02', k, 1, 'async', 'active', pa, pb, 'A', 'B', 'b', now() - interval '5 days', now() - interval '4 days'),
    ('00000000-0000-4000-8000-000000000a03', k, 1, 'live', 'waiting', pa, pb, 'A', 'B', 'b', now() - interval '20 minutes', now() - interval '11 minutes'),
    ('00000000-0000-4000-8000-000000000a04', k, 1, 'live', 'active', pa, pb, 'A', 'B', 'b', now() - interval '20 minutes', now() - interval '5 minutes');
  perform private.expire_matches();
  select status = 'expired' from public.matches where id = m into ok;
  select ok and status = 'invited' from public.matches where id = '00000000-0000-4000-8000-000000000a01' into ok;
  results := array_append(results, case when ok then 'ok x1' else 'FAIL x1: invitation expiry wrong' end);
  select status = 'cancelled' from public.matches where id = '00000000-0000-4000-8000-000000000a02' into ok;
  results := array_append(results, case when ok then 'ok x2' else 'FAIL x2: a quiet turn-by-turn match was not cancelled' end);
  select (select status from public.matches where id = '00000000-0000-4000-8000-000000000a03') = 'cancelled'
     and (select status from public.matches where id = '00000000-0000-4000-8000-000000000a04') = 'active' into ok;
  results := array_append(results, case when ok then 'ok x3' else 'FAIL x3: live inactivity wrong' end);

  -- (l1) only the game's own game admin sets the limits
  perform set_config('request.jwt.claims', json_build_object('sub', ga2, 'role', 'authenticated')::text, true);
  execute as_user;
  begin
    perform public.set_turn_limits(k, interval '1 day', interval '5 minutes');
    ok := false;
  exception when others then ok := true; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', ga, 'role', 'authenticated')::text, true);
  execute as_user;
  perform public.set_turn_limits(k, interval '1 day', interval '5 minutes');
  execute 'reset role';
  select ok and turn_limit_async = interval '1 day' and turn_limit_live = interval '5 minutes' from public.games where key = k into ok;
  results := array_append(results, case when ok then 'ok l1' else 'FAIL l1: turn limits rules wrong' end);

  -- (v4) someone without a role reads no versions, even of an open game; (c2) nor lists colleagues
  insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000000c1', 'sqltest5-norole@example.com', 'authenticated', 'authenticated');
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000c1', 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) = 0 from public.game_versions where game_key = k into ok;
  results := array_append(results, case when ok then 'ok v4' else 'FAIL v4: a user without a role read game versions' end);
  begin
    perform * from public.match_candidates(k);
    results := array_append(results, 'FAIL c2: a user without a role listed colleagues');
  exception when others then results := array_append(results, 'ok c2'); end;
  execute 'reset role';

  -- (s1) a device subscription must point at a browser push service
  perform set_config('request.jwt.claims', json_build_object('sub', pa, 'role', 'authenticated')::text, true);
  execute as_user;
  begin
    insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://169.254.169.254/latest', 'k', 'a');
    results := array_append(results, 'FAIL s1: stored a push endpoint outside the push services');
  exception when others then results := array_append(results, 'ok s1'); end;
  insert into public.push_subscriptions (endpoint, p256dh, auth) values ('https://fcm.googleapis.com/fcm/send/sqltest5', 'k', 'a');
  execute 'reset role';

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;
