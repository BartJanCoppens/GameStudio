-- Design systems (an admin library plus creators' own) and AI usage limits with cost tracking.

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

insert into public.permissions (key, name, category, sort_order) values
  ('design.manage', 'Manage the design system library', 'Platform', 14),
  ('players.limits', 'Set AI limits for a game’s players', 'Game admin', 15);

insert into public.role_permissions (role_key, permission_key, level) values
  ('admin', 'design.manage', 1), ('admin', 'players.limits', 1), ('gameadmin', 'players.limits', 1);

-- ---------------------------------------------------------------------------
-- Design systems
-- ---------------------------------------------------------------------------

-- library = the admin's default list; otherwise a creator's own. Players never read this table:
-- the chosen design is copied into the game's content and published with it.
create table public.design_systems (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(name) between 1 and 60),
  description text not null default '' check (length(description) <= 300),
  tokens      jsonb not null check (jsonb_typeof(tokens) = 'object' and pg_column_size(tokens) < 8192),
  library     boolean not null default false,
  owner_id    uuid references public.profiles (id) on delete cascade,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check ((library and owner_id is null) or (not library and owner_id is not null))
);
create index design_systems_owner_idx on public.design_systems (owner_id);

create function private.design_system_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then new.created_by := (select auth.uid()); end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger design_system_stamp before insert or update on public.design_systems
  for each row execute function private.design_system_stamp();
revoke all on function private.design_system_stamp() from public, anon, authenticated;

alter table public.design_systems enable row level security;
revoke all on public.design_systems from anon, authenticated;
grant select, delete on public.design_systems to authenticated;
grant insert (name, description, tokens, library, owner_id) on public.design_systems to authenticated;
grant update (name, description, tokens) on public.design_systems to authenticated;
grant all on public.design_systems to service_role;

create policy "Creators and library managers read the library" on public.design_systems
  for select to authenticated
  using (library and ((select private.has_permission('games.create')) or (select private.has_permission('design.manage'))));
create policy "Creators read their own designs" on public.design_systems
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "Library managers add to the library" on public.design_systems
  for insert to authenticated with check (library and owner_id is null and (select private.has_permission('design.manage')));
create policy "Creators add their own designs" on public.design_systems
  for insert to authenticated with check (not library and owner_id = (select auth.uid()) and (select private.has_permission('games.create')));

create policy "Library managers edit the library" on public.design_systems
  for update to authenticated
  using (library and (select private.has_permission('design.manage')))
  with check (library and (select private.has_permission('design.manage')));
create policy "Creators edit their own designs" on public.design_systems
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Library managers remove from the library" on public.design_systems
  for delete to authenticated using (library and (select private.has_permission('design.manage')));
create policy "Creators remove their own designs" on public.design_systems
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- AI usage: what each call cost, and the limits
-- ---------------------------------------------------------------------------

alter table public.studio_ai_calls
  add column kind text not null default 'studio' check (kind in ('studio', 'design', 'game')),
  add column game_key text references public.games (key) on delete set null,
  add column model text,
  add column input_tokens integer,
  add column output_tokens integer,
  -- Estimated from the model's list price; null when the provider's price isn't known.
  add column cost_usd numeric(10, 4);

grant select on public.studio_ai_calls to authenticated;
create policy "Users read their own AI calls" on public.studio_ai_calls
  for select to authenticated using (user_id = (select auth.uid()));
create policy "AI managers read all AI calls" on public.studio_ai_calls
  for select to authenticated using ((select private.has_permission('ai.manage')));
create policy "Player limit managers read the game's AI calls" on public.studio_ai_calls
  for select to authenticated using (kind = 'game' and (select private.has_permission('players.limits')));

-- audience 'creators': Studio and design AI, set by platform admins. audience 'players': AI a game uses
-- while it is played, set per game by game admins. user_id null = the default for everyone in the audience.
create table public.usage_limits (
  id                  uuid primary key default gen_random_uuid(),
  audience            text not null check (audience in ('creators', 'players')),
  game_key            text references public.games (key) on delete cascade
                      check ((audience = 'creators' and game_key is null) or (audience = 'players' and game_key is not null)),
  user_id             uuid references public.profiles (id) on delete cascade,
  calls_per_day       integer check (calls_per_day >= 0),
  spend_per_month_usd numeric(10, 2) check (spend_per_month_usd >= 0),
  updated_by          uuid references public.profiles (id) on delete set null,
  updated_at          timestamptz not null default now(),
  unique nulls not distinct (audience, game_key, user_id)
);

create function private.usage_limit_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_by := (select auth.uid());
  new.updated_at := now();
  return new;
end;
$$;
create trigger usage_limit_stamp before insert or update on public.usage_limits
  for each row execute function private.usage_limit_stamp();
revoke all on function private.usage_limit_stamp() from public, anon, authenticated;

alter table public.usage_limits enable row level security;
revoke all on public.usage_limits from anon, authenticated;
grant select, delete on public.usage_limits to authenticated;
grant insert (audience, game_key, user_id, calls_per_day, spend_per_month_usd) on public.usage_limits to authenticated;
grant update (calls_per_day, spend_per_month_usd) on public.usage_limits to authenticated;
grant all on public.usage_limits to service_role;

-- Everyone may see the limits that apply to them (their own row and the default).
create policy "Users read the limits that apply to them" on public.usage_limits
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "AI managers read creator limits" on public.usage_limits
  for select to authenticated using (audience = 'creators' and (select private.has_permission('ai.manage')));
create policy "Player limit managers read player limits" on public.usage_limits
  for select to authenticated using (audience = 'players' and (select private.has_permission('players.limits')));

create policy "AI managers set creator limits" on public.usage_limits
  for insert to authenticated with check (audience = 'creators' and (select private.has_permission('ai.manage')));
create policy "AI managers change creator limits" on public.usage_limits
  for update to authenticated
  using (audience = 'creators' and (select private.has_permission('ai.manage')))
  with check (audience = 'creators' and (select private.has_permission('ai.manage')));
create policy "AI managers remove creator limits" on public.usage_limits
  for delete to authenticated using (audience = 'creators' and (select private.has_permission('ai.manage')));

create policy "Player limit managers set player limits" on public.usage_limits
  for insert to authenticated with check (audience = 'players' and (select private.has_permission('players.limits')));
create policy "Player limit managers change player limits" on public.usage_limits
  for update to authenticated
  using (audience = 'players' and (select private.has_permission('players.limits')))
  with check (audience = 'players' and (select private.has_permission('players.limits')));
create policy "Player limit managers remove player limits" on public.usage_limits
  for delete to authenticated using (audience = 'players' and (select private.has_permission('players.limits')));

create index studio_ai_calls_game_idx on public.studio_ai_calls (game_key, created_at desc) where game_key is not null;
