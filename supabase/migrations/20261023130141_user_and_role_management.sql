-- User and role management.
--
-- Accounts live in auth.users; public.profiles mirrors each one (trigger below).
-- Roles are rows, so platform admins can add their own. What a role may do is the
-- role_permissions matrix; every write policy below checks it through
-- private.has_permission(), so editing the matrix changes access, not just the screen.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.roles (
  key         text primary key check (key ~ '^[a-z][a-z0-9_-]{1,39}$'),
  name        text not null check (length(name) between 1 and 60),
  short_name  text not null check (length(short_name) between 1 and 20),
  description text not null default '',
  -- The four roles the app has screens for; they cannot be renamed away or deleted.
  is_system   boolean not null default false,
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now()
);

create table public.permissions (
  key        text primary key,
  name       text not null,
  category   text not null,
  sort_order integer not null
);

-- level 1 = granted, 2 = partial (shown as "–"; not enough to pass a check). No row = not granted.
create table public.role_permissions (
  role_key       text not null references public.roles (key) on delete cascade,
  permission_key text not null references public.permissions (key) on delete cascade,
  level          smallint not null check (level in (1, 2)),
  primary key (role_key, permission_key)
);
create index role_permissions_permission_key_idx on public.role_permissions (permission_key);

create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  full_name      text not null default '',
  cohort         text not null default '',
  status         text not null default 'active' check (status in ('active', 'deactivated')),
  last_sign_in_at timestamptz,
  created_at     timestamptz not null default now()
);

create table public.user_roles (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  role_key   text not null references public.roles (key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_key)
);
create index user_roles_role_key_idx on public.user_roles (role_key);

-- ---------------------------------------------------------------------------
-- Permission check (private schema: not reachable through the Data API)
-- ---------------------------------------------------------------------------

create schema if not exists private;

create function private.has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.role_permissions rp on rp.role_key = ur.role_key
    join public.profiles p on p.id = ur.user_id
    where ur.user_id = (select auth.uid())
      and p.status = 'active'
      and rp.permission_key = p_permission
      and rp.level = 1
  );
$$;

revoke all on function private.has_permission(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.has_permission(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Keep profiles in step with auth.users
-- ---------------------------------------------------------------------------

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- full_name comes from user metadata; it is display text only, never used for access.
  insert into public.profiles (id, email, full_name)
  values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.handle_user_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = coalesce(new.email, email), last_sign_in_at = new.last_sign_in_at
  where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email, last_sign_in_at on auth.users
  for each row execute function private.handle_user_updated();

-- ---------------------------------------------------------------------------
-- Guard rails: nobody can lock the platform out of its own admin screens
-- ---------------------------------------------------------------------------

create function private.protect_admin_permissions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role_key = 'admin' and old.permission_key in ('users.manage', 'roles.manage')
     and (tg_op = 'DELETE' or new.level <> 1 or new.role_key <> 'admin' or new.permission_key <> old.permission_key) then
    raise exception 'Platform admin always keeps "%"', old.permission_key using errcode = 'check_violation';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger protect_admin_permissions
  before update or delete on public.role_permissions
  for each row execute function private.protect_admin_permissions();

create function private.protect_last_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role_key = 'admin' and not exists (
    select 1 from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.role_key = 'admin' and ur.user_id <> old.user_id and p.status = 'active'
  ) then
    raise exception 'At least one active platform admin is required' using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger protect_last_admin
  before delete on public.user_roles
  for each row execute function private.protect_last_admin();

create function private.protect_system_roles()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_system then
    raise exception 'Built-in role "%" cannot be deleted', old.key using errcode = 'check_violation';
  end if;
  return old;
end;
$$;

create trigger protect_system_roles
  before delete on public.roles
  for each row execute function private.protect_system_roles();

-- Trigger functions are not meant to be called directly.
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.handle_user_updated() from public, anon, authenticated;
revoke all on function private.protect_admin_permissions() from public, anon, authenticated;
revoke all on function private.protect_last_admin() from public, anon, authenticated;
revoke all on function private.protect_system_roles() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Data API access + row level security
-- ---------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

-- New tables are not exposed to the Data API automatically: grant exactly what the app uses.
-- Older projects still hand out default grants, so take them back first; nothing here is for signed-out visitors.
revoke all on public.roles, public.permissions, public.role_permissions, public.profiles, public.user_roles from anon, authenticated;
grant select, insert, delete on public.roles to authenticated;
grant update (name, short_name, description) on public.roles to authenticated;
grant select on public.permissions to authenticated;
grant select, insert, update, delete on public.role_permissions to authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, cohort) on public.profiles to authenticated;
grant select, insert, delete on public.user_roles to authenticated;
grant all on public.roles, public.permissions, public.role_permissions, public.profiles, public.user_roles to service_role;

-- Roles and the matrix: every signed-in user reads them (the app derives its menus from them);
-- only "Edit roles and permissions" may change them.
create policy "Signed-in users read roles" on public.roles
  for select to authenticated using (true);
create policy "Role editors add roles" on public.roles
  for insert to authenticated with check ((select private.has_permission('roles.manage')) and not is_system);
create policy "Role editors edit roles" on public.roles
  for update to authenticated
  using ((select private.has_permission('roles.manage')))
  with check ((select private.has_permission('roles.manage')));
create policy "Role editors delete custom roles" on public.roles
  for delete to authenticated using ((select private.has_permission('roles.manage')) and not is_system);

create policy "Signed-in users read permissions" on public.permissions
  for select to authenticated using (true);

create policy "Signed-in users read the matrix" on public.role_permissions
  for select to authenticated using (true);
create policy "Role editors grant permissions" on public.role_permissions
  for insert to authenticated with check ((select private.has_permission('roles.manage')));
create policy "Role editors change grants" on public.role_permissions
  for update to authenticated
  using ((select private.has_permission('roles.manage')))
  with check ((select private.has_permission('roles.manage')));
create policy "Role editors revoke permissions" on public.role_permissions
  for delete to authenticated using ((select private.has_permission('roles.manage')));

-- Profiles: you see yourself; user managers see everyone and edit names and cohorts.
-- Status changes go through the admin-users Edge Function, which also blocks sign-in.
create policy "Users read their own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "User managers read all profiles" on public.profiles
  for select to authenticated using ((select private.has_permission('users.manage')));
create policy "User managers edit profiles" on public.profiles
  for update to authenticated
  using ((select private.has_permission('users.manage')))
  with check ((select private.has_permission('users.manage')));

create policy "Users read their own roles" on public.user_roles
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "User managers read all role assignments" on public.user_roles
  for select to authenticated using ((select private.has_permission('users.manage')));
create policy "User managers assign roles" on public.user_roles
  for insert to authenticated with check ((select private.has_permission('users.manage')));
create policy "User managers remove roles" on public.user_roles
  for delete to authenticated using ((select private.has_permission('users.manage')));

-- ---------------------------------------------------------------------------
-- Seed: the four built-in roles, the permission list and the matrix from the design
-- ---------------------------------------------------------------------------

insert into public.roles (key, name, short_name, description, is_system, sort_order) values
  ('admin',     'Platform admin',     'Admin',      'Runs the platform: users, roles, content domains, every game.', true, 1),
  ('creator',   'Game creator',       'Creator',    'Designs games in the Studio, grounds them in a domain, moves them through the workflow.', true, 2),
  ('gameadmin', 'Game administrator', 'Game admin', 'Per game: adds content, manages players and cohorts, publishes additions without the workflow.', true, 3),
  ('player',    'Player',             'Player',     'Plays allocated games, earns badges and certificates.', true, 4);

insert into public.permissions (key, name, category, sort_order) values
  ('users.manage',     'Manage users and invitations',            'Platform',   1),
  ('roles.manage',     'Edit roles and permissions',              'Platform',   2),
  ('domains.manage',   'Create and index Content Domains',        'Content',    3),
  ('content.upload',   'Upload OKF bundles and documents',        'Content',    4),
  ('games.create',     'Create a game in the Studio',             'Games',      5),
  ('workflow.advance', 'Move a game Dev → Test → Review',         'Workflow',   6),
  ('workflow.publish', 'Approve and publish a version',           'Workflow',   7),
  ('allocation.manage','Allocate to cohorts and players',         'Workflow',   8),
  ('live.edit',        'Add content to a live game, no workflow', 'Game admin', 9),
  ('results.view',     'View results and leaderboards',           'Game admin', 10),
  ('games.play',       'Play allocated games',                    'Play',       11);

insert into public.role_permissions (role_key, permission_key, level) values
  ('admin', 'users.manage', 1), ('admin', 'roles.manage', 1), ('admin', 'domains.manage', 1), ('admin', 'content.upload', 1),
  ('admin', 'games.create', 1), ('admin', 'workflow.advance', 1), ('admin', 'workflow.publish', 1), ('admin', 'allocation.manage', 1),
  ('admin', 'live.edit', 1), ('admin', 'results.view', 1), ('admin', 'games.play', 1),
  ('creator', 'content.upload', 1), ('creator', 'games.create', 1), ('creator', 'workflow.advance', 1), ('creator', 'workflow.publish', 2),
  ('creator', 'allocation.manage', 1), ('creator', 'results.view', 1), ('creator', 'games.play', 1),
  ('gameadmin', 'allocation.manage', 1), ('gameadmin', 'live.edit', 1), ('gameadmin', 'results.view', 1), ('gameadmin', 'games.play', 1),
  ('player', 'results.view', 2), ('player', 'games.play', 1);
