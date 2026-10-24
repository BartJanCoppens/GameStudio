-- Checks for 20261024100000_generic_games.sql. Run against the linked project:
--   supabase db query --linked -f supabase/tests/generic_games.sql
-- Everything runs in one DO block that always ends by raising its results, so every change rolls back.
do $$
declare
  creator uuid := gen_random_uuid();
  other   uuid := gen_random_uuid();
  player  uuid := gen_random_uuid();
  results text[] := '{}';
  run_id  uuid;
  ok      boolean;
  procedure_note text;
begin
  insert into auth.users (id, email, aud, role) values
    (creator, 'sqltest-creator@example.com', 'authenticated', 'authenticated'),
    (other, 'sqltest-other@example.com', 'authenticated', 'authenticated'),
    (player, 'sqltest-player@example.com', 'authenticated', 'authenticated');
  insert into public.user_roles (user_id, role_key) values (creator, 'creator'), (other, 'creator'), (player, 'player');
  insert into public.games (key, title) values ('sqltest-game', 'SQL test game'), ('sqltest-other', 'Other');
  -- The insert trigger stamps the signed-in user (none here) as creator.
  update public.games set created_by = creator where key = 'sqltest-game';
  update public.games set created_by = other where key = 'sqltest-other';
  insert into public.game_content (game_key, stage, content) values ('sqltest-game', 'draft', '{"phase":"ready"}'), ('sqltest-other', 'draft', '{"phase":"ready"}');
  insert into public.game_secrets (game_key, stage, ai) values ('sqltest-game', 'draft', '{"secret":"x"}'), ('sqltest-other', 'draft', '{"secret":"y"}');

  -- (a) no check yet: publishing is refused
  perform set_config('request.jwt.claims', json_build_object('sub', creator, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    perform public.publish_game('sqltest-game');
    results := array_append(results, 'FAIL a: published without a check');
  exception when others then
    results := array_append(results, case when sqlerrm like '%house-rules check%' then 'ok a' else 'FAIL a: ' || sqlerrm end);
  end;
  execute 'reset role';

  -- (b) a passing check for the current fingerprint: publishing works and copies content and secret
  insert into public.game_checks (game_key, fingerprint, passed, reasons) values ('sqltest-game', public.draft_fingerprint('sqltest-game'), true, '[]');
  execute 'set local role authenticated';
  begin
    perform public.publish_game('sqltest-game');
    results := array_append(results, 'ok b');
  exception when others then
    results := array_append(results, ('FAIL b: ' || sqlerrm));
  end;
  execute 'reset role';
  select exists (select 1 from public.game_content where game_key = 'sqltest-game' and stage = 'live')
     and exists (select 1 from public.game_secrets where game_key = 'sqltest-game' and stage = 'live' and ai->>'secret' = 'x') into ok;
  results := array_append(results, case when ok then 'ok b2' else 'FAIL b2: live content or secret missing' end);

  -- (c) the draft changes after the check: publishing is refused again
  update public.game_content set content = '{"phase":"ready","changed":true}' where game_key = 'sqltest-game' and stage = 'draft';
  execute 'set local role authenticated';
  begin
    perform public.publish_game('sqltest-game');
    results := array_append(results, 'FAIL c: published a changed draft');
  exception when others then
    results := array_append(results, case when sqlerrm like '%house-rules check%' then 'ok c' else 'FAIL c: ' || sqlerrm end);
  end;

  -- (d) a creator can't read another creator's secrets, nor write live content directly
  select count(*) = 0 from public.game_secrets where game_key = 'sqltest-other' into ok;
  results := array_append(results, case when ok then 'ok d' else 'FAIL d: read another creator''s secret' end);
  begin
    update public.game_content set content = '{"phase":"ready","hacked":true}' where game_key = 'sqltest-game' and stage = 'live';
    get diagnostics procedure_note = row_count;
    results := array_append(results, case when procedure_note = '0' then 'ok d2' else 'FAIL d2: wrote live content directly' end);
  exception when others then
    results := array_append(results, 'ok d2');
  end;
  execute 'reset role';

  -- (e) a player's 51st contribution to one run is refused
  perform set_config('request.jwt.claims', json_build_object('sub', player, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  insert into public.game_runs (game_key, content_version) values ('sqltest-game', 1) returning id into run_id;
  for i in 1..50 loop
    insert into public.game_contributions (game_key, run_id, amount) values ('sqltest-game', run_id, 1);
  end loop;
  begin
    insert into public.game_contributions (game_key, run_id, amount) values ('sqltest-game', run_id, 1);
    results := array_append(results, 'FAIL e: 51st contribution accepted');
  exception when others then
    results := array_append(results, 'ok e');
  end;

  -- (f) a player can't start a test run
  begin
    insert into public.game_runs (game_key, test) values ('sqltest-game', true);
    results := array_append(results, 'FAIL f: player started a test run');
  exception when others then
    results := array_append(results, 'ok f');
  end;

  -- (g) a finished run needs a score, and takes one
  begin
    update public.game_runs set finished_at = now(), score = 42 where id = run_id;
    select score = 42 from public.game_runs where id = run_id into ok;
    results := array_append(results, case when ok then 'ok g' else 'FAIL g: score not saved' end);
  exception when others then
    results := array_append(results, ('FAIL g: ' || sqlerrm));
  end;
  execute 'reset role';

  -- (h) the demo game is gone
  select not exists (select 1 from public.games where key = 'invoice-errors') into ok;
  results := array_append(results, case when ok then 'ok h' else 'FAIL h: demo game still there' end);

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;
