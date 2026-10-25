-- Checks for 20261025090000_assigned_game_admin.sql. Run with npm run test:sql; rolls back by raising its results.
do $$
declare
  owner_  uuid := gen_random_uuid();
  gadmin  uuid := gen_random_uuid();
  gadmin2 uuid := gen_random_uuid();
  padmin  uuid := gen_random_uuid();
  player  uuid := gen_random_uuid();
  gone    uuid := gen_random_uuid();
  k       text := 'sqltest4-game';
  results text[] := '{}';
  n int;
  ok boolean;
  run_id uuid;
  msg text;
  as_user text := 'set local role authenticated';
begin
  insert into auth.users (id, email, aud, role) values
    (owner_, 'sqltest4-owner@example.com', 'authenticated', 'authenticated'), (gadmin, 'sqltest4-gadmin@example.com', 'authenticated', 'authenticated'),
    (gadmin2, 'sqltest4-gadmin2@example.com', 'authenticated', 'authenticated'), (padmin, 'sqltest4-padmin@example.com', 'authenticated', 'authenticated'),
    (player, 'sqltest4-player@example.com', 'authenticated', 'authenticated'), (gone, 'sqltest4-gone@example.com', 'authenticated', 'authenticated');
  insert into public.user_roles (user_id, role_key) values
    (owner_, 'creator'), (gadmin, 'gameadmin'), (gadmin2, 'gameadmin'), (padmin, 'admin'), (player, 'player'), (gone, 'gameadmin');
  update public.profiles set status = 'deactivated' where id = gone;
  insert into public.games (key, title) values (k, 'G');
  update public.games set created_by = owner_ where key = k;
  insert into public.game_content (game_key, stage, content) values (k, 'draft', '{"phase":"ready","data":{"q":[1,2]}}');
  insert into public.game_checks (game_key, fingerprint, passed, reasons) values (k, public.draft_fingerprint(k), true, '[]');

  -- (a) first publish needs a game admin who can look after games; (u) not a deactivated one
  perform set_config('request.jwt.claims', json_build_object('sub', owner_, 'role', 'authenticated')::text, true);
  execute as_user;
  foreach msg in array array['none', 'player', 'gone'] loop
    begin
      perform public.publish_game(k, case msg when 'player' then player when 'gone' then gone else null end);
      results := array_append(results, format('FAIL %s: published with game admin %s', case msg when 'gone' then 'u' else 'a' end, msg));
    exception when others then
      results := array_append(results, case when sqlerrm like 'Choose a game admin who can look after games%' then 'ok ' || msg else format('FAIL a: wrong error %s', sqlerrm) end);
    end;
  end loop;
  select not exists (select 1 from public.game_admins_to_choose() c where c.id in (gone, player)) and exists (select 1 from public.game_admins_to_choose() c where c.id = gadmin) into ok;
  results := array_append(results, case when ok then 'ok u2' else 'FAIL u2: wrong people to choose from' end);
  select bool_and(c.email is null) from public.game_admins_to_choose() c into ok;
  results := array_append(results, case when ok then 'ok u3' else 'FAIL u3: a creator saw game admins'' email addresses' end);

  -- (b) publishing with a game admin assigns it and starts closed
  perform public.publish_game(k, gadmin);
  execute 'reset role';
  select game_admin = gadmin and access = 'restricted' and offline_at is null from public.games where key = k into ok;
  select count(*) from public.game_access where game_key = k into n;
  results := array_append(results, case when ok and n = 0 then 'ok b' else 'FAIL b: not assigned or not closed' end);

  -- (c) the player sees nothing until the game admin lets them in
  perform set_config('request.jwt.claims', json_build_object('sub', player, 'role', 'authenticated')::text, true);
  execute as_user;
  select (select count(*) from public.games where key = k) = 0 and (select count(*) from public.game_content where game_key = k) = 0 into ok;
  begin
    insert into public.game_runs (game_key, content_version) values (k, 1);
    ok := false;
  exception when others then null; end;
  results := array_append(results, case when ok then 'ok c' else 'FAIL c: player reached a closed game' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin, 'role', 'authenticated')::text, true);
  execute as_user;
  insert into public.game_access (game_key, user_id) values (k, player);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', player, 'role', 'authenticated')::text, true);
  execute as_user;
  select (select count(*) from public.games where key = k) = 1 and (select count(*) from public.game_content where game_key = k and stage = 'live') = 1 into ok;
  begin
    insert into public.game_runs (game_key, content_version) values (k, 1) returning id into run_id;
  exception when others then ok := false; end;
  results := array_append(results, case when ok then 'ok c2' else 'FAIL c2: listed player blocked' end);
  execute 'reset role';

  -- (d) another game admin doesn't see or manage it
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin2, 'role', 'authenticated')::text, true);
  execute as_user;
  select (select count(*) from public.games where key = k) = 0 and not public.is_game_admin(k) into ok;
  begin
    insert into public.game_access (game_key, user_id) values (k, gadmin2);
    ok := false;
  exception when others then null; end;
  begin
    perform public.set_game_offline(k, true);
    ok := false;
  exception when others then null; end;
  begin
    update public.games set game_admin = gadmin2 where key = k;
    ok := false;
  exception when others then null; end;
  results := array_append(results, case when ok then 'ok d' else 'FAIL d: another game admin reached the game' end);
  execute 'reset role';

  -- (e) the creator still sees it but no longer decides who plays
  perform set_config('request.jwt.claims', json_build_object('sub', owner_, 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) = 1 from public.games where key = k into ok;
  begin
    perform public.set_game_access(k, 'everyone');
    ok := false;
  exception when others then null; end;
  begin
    insert into public.game_access (game_key, user_id) values (k, owner_);
    ok := false;
  exception when others then null; end;
  begin
    update public.games set offline_at = now() where key = k;
    ok := false;
  exception when others then null; end;
  results := array_append(results, case when ok then 'ok e' else 'FAIL e: creator changed access' end);
  execute 'reset role';

  -- (f) offline: players lose it, the game admin can still test; online again restores it
  -- (t) a run in progress can't finish while offline
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin, 'role', 'authenticated')::text, true);
  execute as_user;
  perform public.set_game_offline(k, true);
  begin
    insert into public.game_runs (game_key, content_version, test) values (k, 1, true);
    ok := true;
  exception when others then ok := false; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', player, 'role', 'authenticated')::text, true);
  execute as_user;
  ok := ok and (select count(*) from public.game_content where game_key = k) = 0 and (select count(*) from public.games where key = k) = 0;
  begin
    insert into public.game_runs (game_key, content_version) values (k, 1);
    ok := false;
  exception when others then null; end;
  results := array_append(results, case when ok then 'ok f' else 'FAIL f: offline rules wrong' end);
  begin
    update public.game_runs set finished_at = now(), score = 1, details = '{}' where id = run_id;
    results := array_append(results, 'FAIL t: finished a run of an offline game');
  exception when others then
    results := array_append(results, case when sqlerrm like 'This game is offline%' then 'ok t' else 'FAIL t: wrong error ' || sqlerrm end);
  end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin, 'role', 'authenticated')::text, true);
  execute as_user;
  perform public.set_game_offline(k, false);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', player, 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) = 1 from public.game_content where game_key = k and stage = 'live' into ok;
  results := array_append(results, case when ok then 'ok f2' else 'FAIL f2: back online but still hidden' end);
  execute 'reset role';

  -- (s) a republish keeps the game admin, the access and offline
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin, 'role', 'authenticated')::text, true);
  execute as_user;
  perform public.set_game_offline(k, true);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', owner_, 'role', 'authenticated')::text, true);
  execute as_user;
  perform public.publish_game(k, gadmin2);
  execute 'reset role';
  select game_admin = gadmin and access = 'restricted' and offline_at is not null from public.games where key = k into ok;
  results := array_append(results, case when ok then 'ok s' else 'FAIL s: republish changed the game admin, access or offline' end);
  update public.games set offline_at = null where key = k;

  -- (g) only a platform admin hands a game to another game admin
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin, 'role', 'authenticated')::text, true);
  execute as_user;
  begin
    perform public.set_game_admin(k, gadmin2);
    results := array_append(results, 'FAIL g: a game admin reassigned the game');
  exception when others then results := array_append(results, 'ok g'); end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', padmin, 'role', 'authenticated')::text, true);
  execute as_user;
  perform public.set_game_admin(k, gadmin2);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin2, 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) = 1 and public.is_game_admin(k) from public.games where key = k into ok;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin, 'role', 'authenticated')::text, true);
  execute as_user;
  ok := ok and (select count(*) from public.games where key = k) = 0;
  results := array_append(results, case when ok then 'ok g2' else 'FAIL g2: reassignment did not move the game' end);
  execute 'reset role';

  -- (r) losing the game admin role loses the game
  delete from public.user_roles where user_id = gadmin2;
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin2, 'role', 'authenticated')::text, true);
  execute as_user;
  select not public.is_game_admin(k) into ok;
  results := array_append(results, case when ok then 'ok r' else 'FAIL r: kept the game without the role' end);
  execute 'reset role';

  -- (v) a creator still creates a game and gets it back (the new row isn't visible to lookups by key yet)
  perform set_config('request.jwt.claims', json_build_object('sub', owner_, 'role', 'authenticated')::text, true);
  execute as_user;
  begin
    insert into public.games (key, title) values ('sqltest4-new', 'N') returning key into msg;
    results := array_append(results, 'ok v');
  exception when others then results := array_append(results, 'FAIL v: ' || sqlerrm); end;
  execute 'reset role';

  -- (w) a never-published draft is seen by its creator only, not by players or other creators
  insert into public.games (key, title) values ('sqltest4-draft', 'D');
  update public.games set created_by = owner_ where key = 'sqltest4-draft';
  perform set_config('request.jwt.claims', json_build_object('sub', player, 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) = 0 from public.games where key = 'sqltest4-draft' into ok;
  results := array_append(results, case when ok then 'ok w' else 'FAIL w: a player saw an unpublished draft' end);
  execute 'reset role';

  -- (x) another game admin can't set the game's player limits nor read its AI services
  insert into public.ai_services (scope, game_key, provider) values ('game', k, 'claude');
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin, 'role', 'authenticated')::text, true);
  execute as_user;
  begin
    insert into public.usage_limits (audience, game_key, calls_per_day) values ('players', k, 0);
    ok := false;
  exception when others then ok := true; end;
  results := array_append(results, case when ok then 'ok x' else 'FAIL x: a game admin who isn''t this game''s set its player limits' end);
  execute 'reset role';
  update public.games set game_admin = gadmin where key = k;
  delete from public.usage_limits where game_key = k;
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin, 'role', 'authenticated')::text, true);
  execute as_user;
  begin
    insert into public.usage_limits (audience, game_key, calls_per_day) values ('players', k, 0);
  exception when others then results := array_append(results, 'FAIL x2: the game admin could not set limits ' || sqlerrm); end;
  execute 'reset role';
  insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000000bb', 'sqltest4-ga3@example.com', 'authenticated', 'authenticated');
  insert into public.user_roles (user_id, role_key) values ('00000000-0000-4000-8000-0000000000bb', 'gameadmin');
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000bb', 'role', 'authenticated')::text, true);
  execute as_user;
  select (select count(*) from public.ai_services where game_key = k) = 0 and (select count(*) from public.usage_limits where game_key = k and user_id is not null) = 0 into ok;
  begin
    update public.usage_limits set calls_per_day = 5 where game_key = k;
    get diagnostics n = row_count;
    ok := ok and n = 0;
  exception when others then null; end;
  begin
    insert into public.usage_limits (audience, game_key, user_id, calls_per_day) values ('players', k, player, 0);
    ok := false;
  exception when others then null; end;
  results := array_append(results, case when ok then 'ok x3' else 'FAIL x3: another game admin reached the game''s AI services or limits' end);
  execute 'reset role';

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;
