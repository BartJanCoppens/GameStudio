-- The 50-per-run cap on contributions held only for one request at a time: concurrent inserts each counted
-- the committed rows before any of them committed. Locking the run first makes them count one after another.
create or replace function private.game_contribution_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.user_id := (select auth.uid());
  perform 1 from public.game_runs r where r.id = new.run_id for update;
  if not exists (
    select 1 from public.game_runs r
    where r.id = new.run_id and r.user_id = new.user_id and r.game_key = new.game_key and r.finished_at is null and not r.test
  ) then
    raise exception 'Contributions need your own unfinished run of this game' using errcode = '42501';
  end if;
  if (select count(*) from public.game_contributions c where c.run_id = new.run_id) >= 50 then
    raise exception 'At most 50 contributions per run' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke all on function private.game_contribution_before_insert() from public, anon, authenticated;
