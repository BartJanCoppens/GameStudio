-- Whether the draft's latest house-rules check was for this exact draft (content and AI knowledge), for the Studio.
-- Comparing times was wrong: publishing writes the draft's bookkeeping, which made a fresh check look out of date.
create function public.draft_check_is_current(p_game_key text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.can_edit_game(p_game_key)) then
    raise exception 'Only the game’s creator or a platform admin can do that' using errcode = '42501';
  end if;
  return coalesce((
    select c.fingerprint = public.draft_fingerprint(p_game_key)
    from public.game_checks c
    where c.game_key = p_game_key and c.fingerprint not like 'sha256:%'
    order by c.id desc limit 1), false);
end;
$$;
revoke all on function public.draft_check_is_current(text) from public, anon;
grant execute on function public.draft_check_is_current(text) to authenticated;
