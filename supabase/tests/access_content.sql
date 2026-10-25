-- Checks for 20261024140000_groups_access_content.sql. Run with npm run test:sql; rolls back by raising its results.
do $$
declare
  owner_  uuid := gen_random_uuid();
  other   uuid := gen_random_uuid();
  gadmin  uuid := gen_random_uuid();
  inside  uuid := gen_random_uuid();
  listed  uuid := gen_random_uuid();
  outside uuid := gen_random_uuid();
  grp     uuid;
  results text[] := '{}';
  n int;
  ok boolean;
  as_user text := 'set local role authenticated';
begin
  insert into auth.users (id, email, aud, role) values
    (owner_, 'sqltest3-owner@example.com', 'authenticated', 'authenticated'), (other, 'sqltest3-other@example.com', 'authenticated', 'authenticated'),
    (gadmin, 'sqltest3-gadmin@example.com', 'authenticated', 'authenticated'), (inside, 'sqltest3-inside@example.com', 'authenticated', 'authenticated'),
    (listed, 'sqltest3-listed@example.com', 'authenticated', 'authenticated'), (outside, 'sqltest3-outside@example.com', 'authenticated', 'authenticated');
  insert into public.user_roles (user_id, role_key) values (owner_, 'creator'), (other, 'creator'), (gadmin, 'gameadmin'), (inside, 'player'), (listed, 'player'), (outside, 'player');
  insert into public.games (key, title) values ('sqltest3-game', 'G');
  update public.games set created_by = owner_, game_admin = gadmin where key = 'sqltest3-game';
  insert into public.game_content (game_key, stage, content) values
    ('sqltest3-game', 'live', '{"phase":"ready","data":{"q":[1,2]}}'), ('sqltest3-game', 'draft', '{"phase":"ready","data":{"q":[1,2]}}');
  insert into public.user_groups (name) values ('SQL test analysts') returning id into grp;
  insert into public.group_members (group_id, user_id) values (grp, inside);

  -- (f) a creator who doesn't own the game can't manage its access; the owner can
  perform set_config('request.jwt.claims', json_build_object('sub', other, 'role', 'authenticated')::text, true);
  execute as_user;
  begin perform public.set_game_access('sqltest3-game', 'restricted'); n := 1; exception when others then n := 0; end;

  results := array_append(results, case when n = 0 then 'ok f' else 'FAIL f: non-owner creator restricted the game' end);
  execute 'reset role';
  -- (f2) since the assigned game admin: the owner doesn't decide who plays either; the game's game admin does
  perform set_config('request.jwt.claims', json_build_object('sub', owner_, 'role', 'authenticated')::text, true);
  execute as_user;
  begin
    perform public.set_game_access('sqltest3-game', 'restricted');
    ok := false;
  exception when others then ok := true; end;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin, 'role', 'authenticated')::text, true);
  execute as_user;
  perform public.set_game_access('sqltest3-game', 'restricted');
  n := 1;
  insert into public.game_access (game_key, group_id) values ('sqltest3-game', grp);
  insert into public.game_access (game_key, user_id) values ('sqltest3-game', listed);
  results := array_append(results, case when n = 1 and ok then 'ok f2' else 'FAIL f2: owner restricted, or game admin could not' end);
  execute 'reset role';

  -- (a) outside: no live content, no run
  perform set_config('request.jwt.claims', json_build_object('sub', outside, 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) = 0 from public.game_content where game_key = 'sqltest3-game' and stage = 'live' into ok;
  results := array_append(results, case when ok then 'ok a' else 'FAIL a: outsider read restricted content' end);
  begin
    insert into public.game_runs (game_key, content_version) values ('sqltest3-game', 1);
    results := array_append(results, 'FAIL a2: outsider started a run');
  exception when others then results := array_append(results, 'ok a2'); end;
  execute 'reset role';

  -- (b) in a listed group; (c) listed directly
  foreach n in array array[1, 2] loop
    perform set_config('request.jwt.claims', json_build_object('sub', case when n = 1 then inside else listed end, 'role', 'authenticated')::text, true);
    execute as_user;
    select count(*) = 1 from public.game_content where game_key = 'sqltest3-game' and stage = 'live' into ok;
    begin
      insert into public.game_runs (game_key, content_version) values ('sqltest3-game', 1);
    exception when others then ok := false; end;
    results := array_append(results, case when ok then (case when n = 1 then 'ok b' else 'ok c' end) else (case when n = 1 then 'FAIL b: group member blocked' else 'FAIL c: listed player blocked' end) end);
    execute 'reset role';
  end loop;

  -- (j) a game admin sets access but can't rename or archive someone else's game
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin, 'role', 'authenticated')::text, true);
  execute as_user;
  perform public.set_game_access('sqltest3-game', 'restricted');
  n := 1;
  begin
    update public.games set title = 'Hijacked' where key = 'sqltest3-game';
    select title = 'G' from public.games where key = 'sqltest3-game' into ok;
  exception when others then ok := true; end;
  results := array_append(results, case when n = 1 and ok then 'ok j' else 'FAIL j: game admin access/rename rules wrong' end);
  execute 'reset role';

  -- (e) a game admin reads and runs it
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin, 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) = 1 from public.game_content where game_key = 'sqltest3-game' and stage = 'live' into ok;
  results := array_append(results, case when ok then 'ok e' else 'FAIL e: game admin blocked' end);
  execute 'reset role';

  -- (d) deleting the group removes its members' access; the game stays restricted
  delete from public.user_groups where id = grp;
  perform set_config('request.jwt.claims', json_build_object('sub', inside, 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) = 0 from public.game_content where game_key = 'sqltest3-game' and stage = 'live' into ok;
  execute 'reset role';
  select ok and (select access = 'restricted' from public.games where key = 'sqltest3-game') into ok;
  results := array_append(results, case when ok then 'ok d' else 'FAIL d: group deletion opened the game' end);

  -- (g) publish_live_content: bumps the revision, syncs an untouched draft
  perform public.publish_live_content('sqltest3-game', '{"q":[1,2,3]}', 'fp1', gadmin);
  select (select (content->'data') = '{"q":[1,2,3]}' and data_revision = 1 from public.game_content where game_key = 'sqltest3-game' and stage = 'live')
     and (select (content->'data') = '{"q":[1,2,3]}' and base_revision = 1 from public.game_content where game_key = 'sqltest3-game' and stage = 'draft')
     and exists (select 1 from public.game_checks where game_key = 'sqltest3-game' and fingerprint = 'fp1' and passed) into ok;
  results := array_append(results, case when ok then 'ok g' else 'FAIL g: publish_live_content didn''t update live, draft and check' end);
  -- a changed draft is left alone, and publishing it is refused
  update public.game_content set content = '{"phase":"ready","data":{"q":[9]}}' where game_key = 'sqltest3-game' and stage = 'draft';
  perform public.publish_live_content('sqltest3-game', '{"q":[1,2,3,4]}', 'fp2', gadmin);
  select (content->'data') = '{"q":[9]}' from public.game_content where game_key = 'sqltest3-game' and stage = 'draft' into ok;
  results := array_append(results, case when ok then 'ok g2' else 'FAIL g2: changed draft was overwritten' end);
  insert into public.game_checks (game_key, fingerprint, passed) values ('sqltest3-game', public.draft_fingerprint('sqltest3-game'), true);
  perform set_config('request.jwt.claims', json_build_object('sub', owner_, 'role', 'authenticated')::text, true);
  execute as_user;
  begin
    perform public.publish_game('sqltest3-game');
    results := array_append(results, 'FAIL g3: published a draft behind live');
  exception when others then
    results := array_append(results, case when sqlerrm like 'A game admin added content to the live game. Take it into your draft first.%' then 'ok g3' else 'FAIL g3: ' || sqlerrm end);
  end;
  -- (i) take_in_live brings the live content into the draft
  perform public.take_in_live('sqltest3-game');
  execute 'reset role';
  select (content->'data') = '{"q":[1,2,3,4]}' and base_revision = 2 from public.game_content where game_key = 'sqltest3-game' and stage = 'draft' into ok;
  results := array_append(results, case when ok then 'ok i' else 'FAIL i: take_in_live didn''t sync the draft' end);

  -- (k) an outsider can't read a restricted game's finished runs or its contributions
  -- The listed player plays: contributes during the run, then finishes it.
  perform set_config('request.jwt.claims', json_build_object('sub', listed, 'role', 'authenticated')::text, true);
  insert into public.game_contributions (game_key, run_id, amount)
    select 'sqltest3-game', r.id, 5 from public.game_runs r where r.game_key = 'sqltest3-game' and r.user_id = listed and r.finished_at is null limit 1;
  update public.game_runs set finished_at = now(), score = 42 where game_key = 'sqltest3-game' and user_id = listed and finished_at is null;
  perform set_config('request.jwt.claims', json_build_object('sub', outside, 'role', 'authenticated')::text, true);
  execute as_user;
  select (select count(*) from public.game_runs where game_key = 'sqltest3-game') = 0
     and (select count(*) from public.game_contributions where game_key = 'sqltest3-game') = 0 into ok;
  results := array_append(results, case when ok then 'ok k' else 'FAIL k: outsider read runs or contributions of a restricted game' end);
  execute 'reset role';
  -- (k2) the listed player still sees the leaderboard
  perform set_config('request.jwt.claims', json_build_object('sub', inside, 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) >= 0 from public.game_runs where game_key = 'sqltest3-game' into ok;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', listed, 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) >= 1 from public.game_runs where game_key = 'sqltest3-game' and finished_at is not null into ok;
  results := array_append(results, case when ok then 'ok k2' else 'FAIL k2: a player with access lost the leaderboard' end);
  -- (l) the public can_play check answers for the caller
  select public.can_play('sqltest3-game') into ok;
  results := array_append(results, case when ok then 'ok l' else 'FAIL l: can_play wrong for a listed player' end);
  execute 'reset role';

  -- (m) someone with no role at all reads no contributions, even of an open game
  update public.games set access = 'everyone' where key = 'sqltest3-game';
  insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-0000000000aa', 'sqltest3-norole@example.com', 'authenticated', 'authenticated');
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000aa', 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) = 0 from public.game_contributions where game_key = 'sqltest3-game' into ok;
  results := array_append(results, case when ok then 'ok m' else 'FAIL m: a user without a role read contributions' end);
  execute 'reset role';
  update public.games set access = 'restricted' where key = 'sqltest3-game';

  -- (n) people who manage access get the list of players; players don't
  perform set_config('request.jwt.claims', json_build_object('sub', gadmin, 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) >= 3 from public.players_for_access() into ok;
  execute 'reset role';
  perform set_config('request.jwt.claims', json_build_object('sub', listed, 'role', 'authenticated')::text, true);
  execute as_user;
  begin
    perform * from public.players_for_access();
    ok := false;
  exception when others then null; end;
  execute 'reset role';
  results := array_append(results, case when ok then 'ok n' else 'FAIL n: players_for_access wrong' end);

  -- (o) someone with no role reads no live content, even of an open game
  update public.games set access = 'everyone' where key = 'sqltest3-game';
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000000aa', 'role', 'authenticated')::text, true);
  execute as_user;
  select count(*) = 0 from public.game_content where game_key = 'sqltest3-game' into ok;
  results := array_append(results, case when ok then 'ok o' else 'FAIL o: a user without a role read live content' end);
  execute 'reset role';
  update public.games set access = 'restricted' where key = 'sqltest3-game';

  -- (p) syncing or taking in live content clears the draft's undo point (undo would bring the old content back)
  update public.game_content set content = jsonb_set(jsonb_set(content, '{data}', '{"q":[1,2,3,4]}'), '{previous}', '{"files":null,"data":{"q":[1]}}') where game_key = 'sqltest3-game' and stage = 'draft';
  perform public.publish_live_content('sqltest3-game', '{"q":[1,2,3,4,5]}', 'fp3', gadmin);
  select not (content ? 'previous') from public.game_content where game_key = 'sqltest3-game' and stage = 'draft' into ok;
  results := array_append(results, case when ok then 'ok p' else 'FAIL p: draft kept its undo point after the sync' end);

  -- (q) a publish built on an older live version is refused
  begin
    perform public.publish_live_content('sqltest3-game', '{"q":[1,2,3,4,5,6]}', 'fp4', gadmin, 1);
    results := array_append(results, 'FAIL q: published content built on an old version');
  exception when others then
    results := array_append(results, case when sqlerrm like 'The game changed while%' then 'ok q' else 'FAIL q: ' || sqlerrm end);
  end;

  -- (h) a player can't call publish_live_content
  perform set_config('request.jwt.claims', json_build_object('sub', listed, 'role', 'authenticated')::text, true);
  execute as_user;
  begin
    perform public.publish_live_content('sqltest3-game', '{"q":[]}', 'x', listed);
    results := array_append(results, 'FAIL h: player published content');
  exception when others then results := array_append(results, 'ok h'); end;
  execute 'reset role';

  raise exception 'RESULTS: %', array_to_string(results, ', ');
end $$;
