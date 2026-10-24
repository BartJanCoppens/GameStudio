-- game-check reads the draft, its secret and their fingerprint in one statement, so the version reviewed
-- is exactly the version the passed check is recorded for.
create function public.draft_for_check(p_game_key text)
returns table (content jsonb, ai jsonb, fingerprint text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.content, s.ai, md5(c.content::text || coalesce(s.ai::text, ''))
  from public.game_content c
  left join public.game_secrets s on s.game_key = c.game_key and s.stage = 'draft'
  where c.game_key = p_game_key and c.stage = 'draft';
$$;
revoke all on function public.draft_for_check(text) from public, anon, authenticated;
grant execute on function public.draft_for_check(text) to service_role;
