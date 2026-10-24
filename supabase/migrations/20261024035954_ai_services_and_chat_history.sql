-- AI services (model, avatar and voice providers) with their keys, and saved Studio chats.
--
-- Keys live encrypted in Supabase Vault. The browser never reads one: it sees whether a key is set and
-- its last four characters. Keys are written, tested and used only by Edge Functions (service role),
-- which check the caller's permission first. A game can carry its own key per provider, which then
-- takes precedence over the platform's.

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------

insert into public.permissions (key, name, category, sort_order) values
  ('ai.manage', 'Manage AI services and keys', 'Platform', 12),
  ('ai.game', 'Set AI services for a game', 'Game admin', 13);

insert into public.role_permissions (role_key, permission_key, level) values
  ('admin', 'ai.manage', 1), ('admin', 'ai.game', 1), ('gameadmin', 'ai.game', 1);

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------

create table public.ai_services (
  id           uuid primary key default gen_random_uuid(),
  scope        text not null check (scope in ('platform', 'game')),
  game_key     text check ((scope = 'platform' and game_key is null) or (scope = 'game' and game_key = 'invoice-errors')),
  provider     text not null check (provider ~ '^[a-z0-9-]{2,30}$'),
  enabled      boolean not null default true,
  address      text check (length(address) <= 300),
  model        text check (length(model) <= 200),
  -- Model ids the provider listed at the last successful test.
  models       jsonb not null default '[]'::jsonb check (jsonb_typeof(models) = 'array' and pg_column_size(models) < 65536),
  key_hint     text check (length(key_hint) <= 8),
  -- vault.secrets.id; never exposed to the browser.
  secret_id    uuid,
  test_status  text check (test_status in ('ok', 'failed')),
  test_message text check (length(test_message) <= 300),
  tested_at    timestamptz,
  updated_by   uuid references public.profiles (id) on delete set null,
  updated_at   timestamptz not null default now(),
  unique nulls not distinct (scope, game_key, provider)
);

-- Which provider and model each AI feature uses. key: 'studio_assistant'.
create table public.ai_settings (
  key        text primary key check (key in ('studio_assistant')),
  value      jsonb not null check (jsonb_typeof(value) = 'object'),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.ai_services enable row level security;
alter table public.ai_settings enable row level security;
revoke all on public.ai_services, public.ai_settings from anon, authenticated;
-- Everything except the Vault reference; all writes go through the ai-services function.
grant select (id, scope, game_key, provider, enabled, address, model, models, key_hint, test_status, test_message, tested_at, updated_at) on public.ai_services to authenticated;
grant select on public.ai_settings to authenticated;
grant all on public.ai_services, public.ai_settings to service_role;

create policy "AI managers read platform services" on public.ai_services
  for select to authenticated
  using (scope = 'platform' and (select private.has_permission('ai.manage')));
-- Game admins see the platform rows too, to know what their game falls back to.
create policy "Game AI managers read game and platform services" on public.ai_services
  for select to authenticated
  using ((select private.has_permission('ai.game')));
create policy "AI managers and creators read AI settings" on public.ai_settings
  for select to authenticated
  using ((select private.has_permission('ai.manage')) or (select private.has_permission('games.create')));

-- Vault access for the Edge Functions only: callable by the service role, nobody else.
create function public.ai_secret_set(p_service uuid, p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  select secret_id into sid from public.ai_services where id = p_service;
  if not found then
    raise exception 'Unknown AI service %', p_service;
  end if;
  if sid is null then
    sid := vault.create_secret(p_secret, 'ai_service_' || p_service::text, 'Game Studio AI service key');
    update public.ai_services set secret_id = sid where id = p_service;
  else
    perform vault.update_secret(sid, p_secret);
  end if;
end;
$$;

create function public.ai_secret_get(p_service uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select ds.decrypted_secret
  from public.ai_services s
  join vault.decrypted_secrets ds on ds.id = s.secret_id
  where s.id = p_service;
$$;

create function private.ai_service_drop_secret()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.secret_id is not null then
    delete from vault.secrets where id = old.secret_id;
  end if;
  return old;
end;
$$;

create trigger ai_service_drop_secret
  after delete on public.ai_services
  for each row execute function private.ai_service_drop_secret();

revoke all on function public.ai_secret_set(uuid, text) from public, anon, authenticated;
revoke all on function public.ai_secret_get(uuid) from public, anon, authenticated;
revoke all on function private.ai_service_drop_secret() from public, anon, authenticated;
grant execute on function public.ai_secret_set(uuid, text), public.ai_secret_get(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- Studio chats
-- ---------------------------------------------------------------------------

create table public.studio_chats (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_key   text not null default 'invoice-errors' check (game_key = 'invoice-errors'),
  title      text not null default '' check (length(title) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index studio_chats_user_idx on public.studio_chats (user_id, updated_at desc);

create table public.studio_chat_messages (
  id         bigint generated always as identity primary key,
  chat_id    uuid not null references public.studio_chats (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  text       text not null check (length(text) <= 8000),
  status     text check (status in ('changes', 'answer', 'out_of_scope', 'error')),
  -- What the browser applied from the proposal, and what it skipped.
  changes    jsonb not null default '[]'::jsonb check (jsonb_typeof(changes) = 'array' and pg_column_size(changes) < 32768),
  skipped    jsonb not null default '[]'::jsonb check (jsonb_typeof(skipped) = 'array' and pg_column_size(skipped) < 32768),
  provider   text,
  created_at timestamptz not null default now()
);
create index studio_chat_messages_chat_idx on public.studio_chat_messages (chat_id, id);

alter table public.studio_chats enable row level security;
alter table public.studio_chat_messages enable row level security;
revoke all on public.studio_chats, public.studio_chat_messages from anon, authenticated;
-- The studio-chat function writes chats and messages; the owner reads them, deletes a chat, and
-- records which proposed changes were applied.
grant select, delete on public.studio_chats to authenticated;
grant select on public.studio_chat_messages to authenticated;
grant update (changes, skipped) on public.studio_chat_messages to authenticated;
grant all on public.studio_chats, public.studio_chat_messages to service_role;

create policy "Creators read their own chats" on public.studio_chats
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Creators delete their own chats" on public.studio_chats
  for delete to authenticated using ((select auth.uid()) = user_id);
create policy "Creators read their own chat messages" on public.studio_chat_messages
  for select to authenticated
  using (exists (select 1 from public.studio_chats c where c.id = chat_id and c.user_id = (select auth.uid())));
create policy "Creators record applied changes on their own messages" on public.studio_chat_messages
  for update to authenticated
  using (exists (select 1 from public.studio_chats c where c.id = chat_id and c.user_id = (select auth.uid())))
  with check (exists (select 1 from public.studio_chats c where c.id = chat_id and c.user_id = (select auth.uid())));
