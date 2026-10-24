-- Checks for 20261024130000_archive_and_delete.sql. Run with npm run test:sql; rolls back by raising its results.
do $$
declare
  creator uuid := gen_random_uuid();
  other   uuid := gen_random_uuid();
  admin_  uuid := gen_random_uuid();
  player  uuid := gen_random_uuid();
  results text[] := '{}';
  n int;
  ok boolean;
begin
  insert into auth.users (id, email, aud, role) values
    (creator, 'sqltest2-creator@example.com', 'authenticated', 'authenticated'),
    (other, 'sqltest2-other@example.com', 'authenticated', 'authenticated'),
    (admin_, 'sqltest2-admin@example.com', 'authenticated', 'authenticated'),
    (player, 'sqltest2-player@example.com', 'authenticated', 'authenticated');
  insert into public.user_roles (user_id, role_key) values (creator, 'creator'), (other, 'creator'), (admin_, 'admin'), (player, 'player');
  insert into public.games (key, title) values ('sqltest2-a', 'A'), ('sqltest2-b', 'B'), ('sqltest2-c', 'C');
  update public.games set created_by = creator where key in ('sqltest2-a', 'sqltest2-b');
  update public.games set created_by = other where key = 'sqltest2-c';
  insert into public.game_content (game_key, stage, content) values ('sqltest2-a', 'live', '{"phase":"ready"}'), ('sqltest2-b', 'live', '{"phase":"ready"}'), ('sqltest2-c', 'live', '{"phase":"ready"}');

  -- (a) the creator archives their published game; players can't start it any more
  perform set_config('request.jwt.claims', json_build_object('sub', creator, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  update public.games set archived_at = now() where key = 'sqltest2-a';
  get diagnostics n = row_count;
  results := array_append(results, case when n = 1 then 'ok a' else 'FAIL a: creator could not archive' end);
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', player, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    insert into public.game_runs (game_key, content_version) values ('sqltest2-a', 1);
    results := array_append(results, 'FAIL a2: player started an archived game');
  exception when others then
    results := array_append(results, 'ok a2');
  end;
  -- (b) a player can't archive or delete
  update public.games set archived_at = now() where key = 'sqltest2-b';
  get diagnostics n = row_count;
  delete from public.games where key = 'sqltest2-b';
  select count(*) = 1 from public.games where key = 'sqltest2-b' into ok;
  results := array_append(results, case when n = 0 and ok then 'ok b' else 'FAIL b: player changed a game' end);
  execute 'reset role';

  -- (c) the creator deletes their own published game, but not someone else's
  perform set_config('request.jwt.claims', json_build_object('sub', creator, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  delete from public.games where key = 'sqltest2-b';
  get diagnostics n = row_count;
  results := array_append(results, case when n = 1 then 'ok c' else 'FAIL c: creator could not delete a published game' end);
  delete from public.games where key = 'sqltest2-c';
  get diagnostics n = row_count;
  results := array_append(results, case when n = 0 then 'ok c2' else 'FAIL c2: creator deleted someone else''s game' end);
  execute 'reset role';

  -- (d) a platform admin deletes any game
  perform set_config('request.jwt.claims', json_build_object('sub', admin_, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  delete from public.games where key = 'sqltest2-c';
  get diagnostics n = row_count;
  results := array_append(results, case when n = 1 then 'ok d' else 'FAIL d: admin could not delete' end);
  execute 'reset role';

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;
