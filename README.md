# Game Studio

Gamified learning platform for Deloitte: a creator describes a game, answers the AI's questions, approves a design shown on screen and watches the AI build it; after a check against the admin's house rules, players play it in a sealed-off frame.

Implemented from the Claude Design prototype `Game Studio.dc.html` with the TaxConnect design system. Any kind of game can be made: the AI proposes the game's shape, writes its content, screens and logic, and can play a role in it (a game master or an opponent). Games can be grounded in the Belgian VAT source document (*Invoice mandatory mentions.md*). Sign-in, users, roles, games, runs and AI keys are on Supabase. See [docs/pitch-demo.md](docs/pitch-demo.md) for the pitch walkthrough and [the design](docs/superpowers/specs/2026-10-24-any-game-studio-design.md) for how it works.

## How a game is made

1. **Questions** (`game-architect`, fast model): up to six questions with clickable choices.
2. **Design** (`game-architect`): a concept card and a static mock-up of the main screen; revise by chatting, change the look, approve.
3. **Code** (`game-builder`, streamed): the content and the screens are written side by side, then the logic. Each step is scanned before it is accepted; a failed step can be retried on its own.
4. **Test & publish**: play-test (never counted), **Check house rules** (`game-check`), **Publish to players** (the database's `publish_game` refuses any version whose fingerprint didn't pass the check), **Export code** for platform admins.

**Looking after a game** (Game administration, for game admins):
- **Access:** everyone, or selected groups and people. The database enforces it on live content, runs, leaderboards and the in-game AI. Groups are kept by platform admins under **Admin › Groups**.
- **Content:** describe what to add; the AI writes it in the game's own shape (nothing existing may be dropped or retyped). It then gets the same house-rules review, and goes live with `publish_live_content`. A creator whose draft has fallen behind takes the live content in before republishing.
- **Players & results** and **AI services** as before.

Players play in an `<iframe sandbox="allow-scripts">` with a strict content security policy: no network, storage, forms or outside resources. A game reaches the platform only through `window.GameStudio` (data, score, leaderboard, common goal, AI role), and the app validates every message. A game that navigates away is stopped. Known limits: a game can still send data out by navigating (the frame is then closed), and WebRTC isn't covered by the content security policy (the bridge removes it before game code runs, best effort), so games only get first names with an initial.

## Run

```sh
npm install
cp .env.example .env.local   # then fill in the Supabase URL and publishable key
npm run dev      # http://localhost:5173
npm run build    # typecheck + production build
npm run lint
npm test         # unit tests: bridge protocol, page builder, code scan, concept checks, export, leaderboard
npm run test:sql # database checks (publish gate, secrets, contributions) in a rolled-back block
npm run check:functions   # type-checks the Edge Functions with Deno
npm run e2e      # Playwright, against the Supabase project in .env.local; uses throwaway e2e-* accounts
E2E_LIVE_AI=1 npm run e2e # also the tests that call the real model (a few dollars)
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

**Admin › AI services** connects language models (Claude, OpenAI, Gemini, OpenRouter, Mistral, Groq, DeepSeek, Ollama, LM Studio, any OpenAI-compatible server), avatars (HeyGen, LiveAvatar) and voices (ElevenLabs). Per provider: add or change a key, pick a default model, test it. The **Studio assistant** card chooses which provider and model designs and builds games.

A game administrator gets the same list under **Game administration › AI services**: a key set there is used for that game instead of the platform’s (billing goes to the account behind it).

- Keys are stored encrypted in Supabase Vault. The browser can set or test a key but never read it back; it sees only the last four characters. Only the Edge Functions read keys, after checking the caller’s permission (*Manage AI services and keys* for the platform, *Set AI services for a game* for a game).
- Tests are cheap read-only calls to each provider (list models, or the account endpoint). Ollama and LM Studio run on your computer, so they are tested from the browser.
- A custom OpenAI-compatible address must be public https: the server won’t call this machine or a private network.
- The Studio assistant runs on the server, so it can use any cloud provider but not Ollama or LM Studio. Every model gets the same restrictions: the admin's house rules, fixed answer shapes, and every result checked before it reaches the draft.
- **Admin › House rules**: the rules and context every AI step follows and every game is checked against before publishing.

### Hosted project

The app runs on the Supabase project **game-studio** (`izdjzxrsebssxzcmudxp`, West EU · Paris). All migrations are applied, `admin-users` is deployed, auth settings come from `supabase/config.toml` (`supabase config push`), and the four demo accounts are seeded. Local, git-ignored files hold what's needed to work on it:

| File | Holds |
|---|---|
| `.env.local` | URL + publishable key for `npm run dev` |
| `.env.seed` | URL, admin key and `SEED_PASSWORD` for `npm run seed:users` — the demo password is here |
| `.env.supabase` | `SUPABASE_DB_PASSWORD`, for `supabase db push` |

Schema changes: `supabase migration new <name>`, then `set -a; . ./.env.supabase; set +a; supabase db push`. Function changes: `supabase functions deploy <name> --use-api`.

To set up a different project: create it with sign-ups off, then `supabase link --project-ref <ref>`, `supabase db push`, `supabase config push`, `supabase functions deploy admin-users`, fill `.env.seed` and `.env.local` from `.env.seed.example` / `.env.example`, and `npm run seed:users`.

### Local Supabase

`supabase start` runs the stack in Docker on ports 55421–55429 (moved off the defaults so it can run beside other projects), applying the migrations and serving the Edge Function. Put the keys from `supabase status` in `.env.localstack.local` (app) and `.env.seed.local` (seed), then `npm run seed:users:local` and `npm run dev:local`.

## Layout

| Path | What |
|---|---|
| `src/ds/` | TaxConnect design system: tokens (copied verbatim) and the components Game Studio uses, ported from `_ds_bundle.js` with values unchanged |
| `src/auth/` | Supabase sign-in, the signed-in user's profile, roles and permissions, the login screen |
| `src/lib/` | Supabase client and table row types |
| `src/game/` | The game model, the sealed-off frame and its bridge (`bridge/`), the Studio's orchestration (`studio/`), runs, goals, looks, export |
| `src/data/` | Navigation and screen titles |
| `src/app/` | App state (`AppProvider`) and the `useApp()` hook — one state object, as in the prototype |
| `src/shell/` | Sidebar, header with the "View as" switcher (shown only when you hold several roles), shared layout bits |
| `src/screens/{player,creator,gameadmin,admin}/` | One file per prototype screen; `admin/Users` and `admin/Roles` read and write Supabase |
| `supabase/migrations/` | Users, roles and permissions; the no-escalation rules; games, runs, secrets, checks, contributions, the publish gate |
| `e2e/` | Playwright tests; `global-setup` creates and `global-teardown` deletes the e2e-* accounts |
| `supabase/functions/` | `admin-users`, `ai-services`, `design-ai`, `game-architect`, `game-builder`, `game-check`, `game-ai`; shared code in `_shared/` |
| `scripts/seed-users.mjs` | Creates or resets the four demo accounts |
| `scripts/demo-reset.mjs` | `npm run demo:reset`: removes all games; `-- --plan-b [--publish]` restores the prepared game |
