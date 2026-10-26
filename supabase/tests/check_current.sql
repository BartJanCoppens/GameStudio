-- Checks for 20261026090000_draft_check_current.sql. Run with npm run test:sql; rolls back by raising its results.
do $$
declare
  owner_ uuid := gen_random_uuid();
  ga     uuid := gen_random_uuid();
  other  uuid := gen_random_uuid();
  k      text := 'sqltest6-game';
  results text[] := '{}';
  ok boolean;
  as_user text := 'set local role authenticated';
begin
  insert into auth.users (id, email, aud, role) values (owner_, 'sqltest6-owner@example.com', 'authenticated', 'authenticated'),
    (ga, 'sqltest6-ga@example.com', 'authenticated', 'authenticated'), (other, 'sqltest6-other@example.com', 'authenticated', 'authenticated');
  insert into public.user_roles (user_id, role_key) values (owner_, 'creator'), (ga, 'gameadmin'), (other, 'creator');
  insert into public.games (key, title) values (k, 'G');
  update public.games set created_by = owner_ where key = k;
  insert into public.game_content (game_key, stage, content) values (k, 'draft', '{"phase":"ready","data":{"q":[1]}}');
  insert into public.game_checks (game_key, fingerprint, passed, reasons) values (k, public.draft_fingerprint(k), true, '[]');

  perform set_config('request.jwt.claims', json_build_object('sub', owner_, 'role', 'authenticated')::text, true);
  execute as_user;
  -- (a) the latest check is for this exact draft
  select public.draft_check_is_current(k) into ok;
  results := array_append(results, case when ok then 'ok a' else 'FAIL a: a fresh check is not current' end);
  -- (b) publishing (which writes the draft's bookkeeping) keeps it current
  perform public.publish_game(k, ga);
  select public.draft_check_is_current(k) into ok;
  results := array_append(results, case when ok then 'ok b' else 'FAIL b: publishing made the check look stale' end);
  execute 'reset role';
  -- (c) a changed draft is no longer current
  update public.game_content set content = '{"phase":"ready","data":{"q":[1,2]}}' where game_key = k and stage = 'draft';
  perform set_config('request.jwt.claims', json_build_object('sub', owner_, 'role', 'authenticated')::text, true);
  execute as_user;
  select not public.draft_check_is_current(k) into ok;
  results := array_append(results, case when ok then 'ok c' else 'FAIL c: a changed draft still counts as checked' end);
  execute 'reset role';
  -- (d) someone who can't edit the game gets no answer
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  execute as_user;
  begin
    perform public.draft_check_is_current(k);
    results := array_append(results, 'FAIL d: another creator asked about the draft');
  exception when others then results := array_append(results, 'ok d'); end;
  execute 'reset role';

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end;
$$;
