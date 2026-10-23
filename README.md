# Game Studio

Gamified learning platform for Meridian Tax Advisors: players play games grounded in a Content Domain (OKF bundles + background documents), game creators design them in an AI-assisted Studio and move them through Dev → Test → Review → Published, game administrators add live content per game, and platform admins manage users, roles and domains.

Implemented from the Claude Design prototype `Game Studio.dc.html` (project "Game Studio Platform Design") with the TaxConnect design system. Sign-in, users, roles and permissions run on Supabase; the games themselves still use in-memory sample data.

## Run

```sh
npm install
cp .env.example .env.local   # then fill in the Supabase URL and publishable key
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm run lint
```

Deep links (the prototype's `defaultRole` / `defaultScreen`): `?role=player|creator|gameadmin|admin` (only roles you hold), `?screen=blank|studio|workflow`.

## Accounts and roles

| Login | Role | Opens on |
|---|---|---|
| `player@deloitte.com` | Player | Player · Library |
| `creator@deloitte.com` | Game creator | Creator · My games |
| `gameadmin@deloitte.com` | Game administrator | Game administration |
| `admin@deloitte.com` | Platform admin | Admin · Overview, Users, Roles & permissions |

All four share the password you choose as `SEED_PASSWORD` when seeding; it is never stored in this repository. Public sign-up is off: platform admins create accounts under **Users → + Invite user** (no email is sent; they share the temporary password).

- **Users** (needs *Manage users and invitations*): invite, edit name, cohort and roles, deactivate (blocks sign-in) or reactivate, reset a password.
- **Roles & permissions** (needs *Edit roles and permissions*): click a cell to step it not granted → granted → partial; add, rename or delete custom roles. Custom roles carry permissions; screens still come from the four built-in roles.
- The database enforces this, not just the screens: row level security checks the permission matrix on every write. Platform admin can never lose *Manage users* or *Edit roles*, the last active platform admin cannot be removed, and built-in roles cannot be deleted.

### Connect a hosted Supabase project

1. Create a project (EU region). Under **Authentication → Sign In / Providers**, turn off *Allow new users to sign up*; set the minimum password length to 10.
2. Apply the schema and deploy the function, either with the CLI:
   ```sh
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   supabase functions deploy admin-users
   ```
   or in the dashboard: run `supabase/migrations/*_user_and_role_management.sql` in the SQL editor, and create an Edge Function named `admin-users` from `supabase/functions/admin-users/index.ts`.
3. Seed the four accounts: copy `.env.seed.example` to `.env.seed`, fill in the URL, the **secret** key and a password, then `npm run seed:users`. Re-running resets their passwords.
4. Point the app at the project: `.env.local` with the URL and the **publishable** key.

### Local Supabase

`supabase start` runs the stack in Docker on ports 55421–55429 (moved off the defaults so it can run beside other projects). It applies the migration and serves the Edge Function; `supabase status` prints the local URL and keys for `.env.local` and `.env.seed`.

## Layout

| Path | What |
|---|---|
| `src/ds/` | TaxConnect design system: tokens (copied verbatim) and the components Game Studio uses, ported from `_ds_bundle.js` with values unchanged |
| `src/auth/` | Supabase sign-in, the signed-in user's profile, roles and permissions, the login screen |
| `src/lib/` | Supabase client and table row types |
| `src/data/` | Sample game data lifted from the prototype, typed |
| `src/app/` | App state (`AppProvider`) and the `useApp()` hook — one state object, as in the prototype |
| `src/shell/` | Sidebar, header with the "View as" switcher (shown only when you hold several roles), shared layout bits |
| `src/screens/{player,creator,gameadmin,admin}/` | One file per prototype screen; `admin/Users` and `admin/Roles` read and write Supabase |
| `supabase/migrations/` | Tables, row level security, guard triggers and seed data for roles and permissions |
| `supabase/functions/admin-users/` | Account operations that need the secret key: create, deactivate/reactivate, reset password |
| `scripts/seed-users.mjs` | Creates or resets the four demo accounts |
