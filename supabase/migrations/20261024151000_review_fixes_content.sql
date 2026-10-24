-- Fixes from the final review: live content needs a role again; content added to a live game must be built on
-- the live version it is published over; syncing or taking in live content clears the draft's undo point.

drop policy "Players read live games they may play" on public.game_content;
create policy "Players read live games they may play" on public.game_content
  for select to authenticated
  using (stage = 'live'
    and ((select private.has_permission('games.play')) or (select private.has_permission('games.create')) or (select private.has_permission('results.view')))
    and (select private.can_play_game(game_key)));

drop function public.publish_live_content(text, jsonb, text, uuid);
create function public.publish_live_content(p_game_key text, p_data jsonb, p_fingerprint text, p_checked_by uuid, p_expected_version integer default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_data jsonb;
  revision integer;
  current_version integer;
  live_version integer;
begin
  -- Draft before live, the same lock order as publish_game.
  perform 1 from public.game_content c where c.game_key = p_game_key and c.stage = 'draft' for update;
  select c.content->'data', c.data_revision, c.version into old_data, revision, current_version
    from public.game_content c where c.game_key = p_game_key and c.stage = 'live' for update;
  if revision is null then
    raise exception 'This game isn’t published' using errcode = 'P0002';
  end if;
  if p_expected_version is not null and current_version <> p_expected_version then
    raise exception 'The game changed while the new content was being written or checked. Generate again.' using errcode = 'P0001';
  end if;
  update public.game_content set content = jsonb_set(content, '{data}', p_data), data_revision = revision + 1
    where game_key = p_game_key and stage = 'live' returning version into live_version;
  insert into public.game_checks (game_key, fingerprint, passed, reasons, checked_by) values (p_game_key, p_fingerprint, true, '[]', p_checked_by);
  -- A draft that still has the old content follows (without its undo point, which would bring the old content
  -- back); a changed draft is left alone and falls behind.
  update public.game_content set content = jsonb_set(content - 'previous', '{data}', p_data), base_revision = revision + 1
    where game_key = p_game_key and stage = 'draft' and content->'data' is not distinct from old_data;
  return live_version;
end;
$$;
revoke all on function public.publish_live_content(text, jsonb, text, uuid, integer) from public, anon, authenticated;
grant execute on function public.publish_live_content(text, jsonb, text, uuid, integer) to service_role;

create or replace function public.take_in_live(p_game_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  live_data jsonb;
  revision integer;
begin
  if not (select private.can_edit_game(p_game_key)) then
    raise exception 'Only the game’s creator or a platform admin can do that' using errcode = '42501';
  end if;
  select c.content->'data', c.data_revision into live_data, revision from public.game_content c where c.game_key = p_game_key and c.stage = 'live';
  if revision is null then
    raise exception 'This game isn’t published' using errcode = 'P0002';
  end if;
  update public.game_content set content = jsonb_set(content - 'previous', '{data}', coalesce(live_data, 'null'::jsonb)), base_revision = revision
    where game_key = p_game_key and stage = 'draft';
end;
$$;
revoke all on function public.take_in_live(text) from public, anon;
grant execute on function public.take_in_live(text) to authenticated;
