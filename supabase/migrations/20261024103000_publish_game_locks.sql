-- publish_game: lock the draft rows and publish exactly the values whose fingerprint passed the check,
-- so a concurrent edit can't slip between the check and the copy.
create or replace function public.publish_game(p_game_key text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  latest  public.game_checks;
  content jsonb;
  secret  jsonb;
  live_version integer;
begin
  if not (select private.has_permission('workflow.publish')) or not (select private.can_edit_game(p_game_key)) then
    raise exception 'You can’t publish this game' using errcode = '42501';
  end if;
  select c.content into content from public.game_content c where c.game_key = p_game_key and c.stage = 'draft' for update;
  if content is null then
    raise exception 'This game has no draft to publish' using errcode = 'P0002';
  end if;
  select s.ai into secret from public.game_secrets s where s.game_key = p_game_key and s.stage = 'draft' for update;
  select * into latest from public.game_checks where game_key = p_game_key order by id desc limit 1;
  if latest is null or not latest.passed or latest.fingerprint is distinct from md5(content::text || coalesce(secret::text, '')) then
    raise exception 'A passed house-rules check is required for this exact version. The game changed since the house-rules check, or it hasn’t been checked. Check again.' using errcode = 'P0001';
  end if;

  insert into public.game_content (game_key, stage, content) values (p_game_key, 'live', content)
    on conflict (game_key, stage) do update set content = excluded.content
    returning version into live_version;
  if secret is not null then
    insert into public.game_secrets (game_key, stage, ai) values (p_game_key, 'live', secret)
      on conflict (game_key, stage) do update set ai = excluded.ai;
  end if;
  return live_version;
end;
$$;
revoke all on function public.publish_game(text) from public, anon;
grant execute on function public.publish_game(text) to authenticated;
