# Game Studio

Gamified learning platform for Deloitte: players play games grounded in a Content Domain (OKF bundles + background documents), game creators design them in an AI-assisted Studio and move them through Dev → Test → Review → Published, game administrators add live content per game, and platform admins manage users, roles and domains.

Implemented from the Claude Design prototype `Game Studio.dc.html` (project "Game Studio Platform Design") with the TaxConnect design system, as a proof of concept around **one working game, Spot the invoice errors**: 12 invoices, 7 planted errors against the Belgian mandatory invoice mentions, a 15-minute clock, feedback citing the source passage, and runs stored per player. Sign-in, users, roles, permissions and runs are on Supabase; the workflow, allocation and content-domain screens still show sample data. See [docs/demo-script.md](docs/demo-script.md) for a 5-minute walkthrough.

## Run

```sh
npm install
cp .env.example .env.local   # then fill in the Supabase URL and publishable key
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm run lint
npm test         # unit tests: content integrity and scoring
npm run e2e      # Playwright, against the Supabase project in .env.local; uses throwaway e2e-* accounts
```

Every screen has its own URL (`#/library`, `#/console`, …); the back button works, and a screen outside your roles opens your home instead.

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

### AI services

**Admin › AI services** connects language models (Claude, OpenAI, Gemini, OpenRouter, Mistral, Groq, DeepSeek, Ollama, LM Studio, any OpenAI-compatible server), avatars (HeyGen, LiveAvatar) and voices (ElevenLabs). Per provider: add or change a key, pick a default model, test it. The **Studio assistant** card chooses which provider and model drives “Draft with AI”.

A game administrator gets the same list under **Game administration › AI services**: a key set there is used for that game instead of the platform’s (billing goes to the account behind it).

- Keys are stored encrypted in Supabase Vault. The browser can set or test a key but never read it back; it sees only the last four characters. Only the `ai-services` and `studio-chat` Edge Functions read keys, after checking the caller’s permission (*Manage AI services and keys* for the platform, *Set AI services for a game* for a game).
- Tests are cheap read-only calls to each provider (list models, or the account endpoint). Ollama and LM Studio run on your computer, so they are tested from the browser.
- A custom OpenAI-compatible address must be public https: the server won’t call this machine or a private network.
- The Studio assistant runs on the server, so it can use any cloud provider but not Ollama or LM Studio. Every model gets the same restrictions: this game only, a fixed answer shape, edits validated before they touch the draft.
- Studio chats are saved per creator (`studio_chats`, `studio_chat_messages`) and can be reopened from the chat panel.

### Hosted project

The app runs on the Supabase project **game-studio** (`izdjzxrsebssxzcmudxp`, West EU · Paris). All migrations are applied, `admin-users` is deployed, auth settings come from `supabase/config.toml` (`supabase config push`), and the four demo accounts are seeded. Local, git-ignored files hold what's needed to work on it:

| File | Holds |
|---|---|
| `.env.local` | URL + publishable key for `npm run dev` |
| `.env.seed` | URL, admin key and `SEED_PASSWORD` for `npm run seed:users` — the demo password is here |
| `.env.supabase` | `SUPABASE_DB_PASSWORD`, for `supabase db push` |

Schema changes: `supabase migration new <name>`, then `set -a; . ./.env.supabase; set +a; supabase db push`. Function changes: `supabase functions deploy admin-users`.

To set up a different project: create it with sign-ups off, then `supabase link --project-ref <ref>`, `supabase db push`, `supabase config push`, `supabase functions deploy admin-users`, fill `.env.seed` and `.env.local` from `.env.seed.example` / `.env.example`, and `npm run seed:users`.

### Local Supabase

`supabase start` runs the stack in Docker on ports 55421–55429 (moved off the defaults so it can run beside other projects), applying the migrations and serving the Edge Function. Put the keys from `supabase status` in `.env.localstack.local` (app) and `.env.seed.local` (seed), then `npm run seed:users:local` and `npm run dev:local`.

## Layout

| Path | What |
|---|---|
| `src/ds/` | TaxConnect design system: tokens (copied verbatim) and the components Game Studio uses, ported from `_ds_bundle.js` with values unchanged |
| `src/auth/` | Supabase sign-in, the signed-in user's profile, roles and permissions, the login screen |
| `src/lib/` | Supabase client and table row types |
| `src/game/` | The demo game: content (invoices, errors, rules, source passages), scoring, the invoice renderer, runs in Supabase |
| `src/data/` | Navigation and the sample workflow/allocation data |
| `src/app/` | App state (`AppProvider`) and the `useApp()` hook — one state object, as in the prototype |
| `src/shell/` | Sidebar, header with the "View as" switcher (shown only when you hold several roles), shared layout bits |
| `src/screens/{player,creator,gameadmin,admin}/` | One file per prototype screen; `admin/Users` and `admin/Roles` read and write Supabase |
| `supabase/migrations/` | Users, roles and permissions; the no-escalation rules; `game_runs` |
| `e2e/` | Playwright tests; `global-setup` creates and `global-teardown` deletes the e2e-* accounts |
| `supabase/functions/admin-users/` | Account operations that need the secret key: create, deactivate/reactivate, reset password |
| `scripts/seed-users.mjs` | Creates or resets the four demo accounts |
