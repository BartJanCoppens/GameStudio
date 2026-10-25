-- Security review: versions need a role, as live content does; listing colleagues needs the player role, and a
-- colleague without a name is shown as such rather than by part of their email address.
drop policy "Players read the versions of games they may play" on public.game_versions;
create policy "Players read the versions of games they may play" on public.game_versions
  for select to authenticated
  using (((select private.has_permission('games.play')) or (select private.has_permission('games.create')) or (select private.has_permission('results.view')))
    and (select private.can_play_game(game_key)));

create or replace function public.match_candidates(p_game_key text)
returns table (id uuid, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.has_permission('games.play')) or not (select private.can_play_game(p_game_key)) then
    raise exception 'This game isn’t available' using errcode = '42501';
  end if;
  return query select p.id, coalesce(nullif(p.full_name, ''), 'A colleague without a name') from public.profiles p
    where p.id <> (select auth.uid()) and (select private.can_play_game_as(p_game_key, p.id)) order by 2;
end;
$$;
