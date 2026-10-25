# Assigned game admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** At first publish the creator names one game admin; only that person (and platform admins) sees and looks after the game, which starts closed and can be taken offline.

**Architecture:** Two columns on `games` (`game_admin`, `offline_at`) and one rule, `private.is_game_admin(key)`, replace every "holds `live.edit`" check in SQL and Edge Functions. `can_play_game` gains the offline rule and the narrower game admin branch; the `games` select policy narrows to who may play, edit or look after a game, so lists follow by themselves. Screens: a game admin picker in the publish step, an offline switch and a reassign control in the game admin console.

**Tech Stack:** React 19 + Vite + TS, Supabase (Postgres RLS, Deno Edge Functions), Vitest, `npm run test:sql`, Playwright against the hosted project.

**Spec:** `docs/superpowers/specs/2026-10-25-assigned-game-admin-design.md`

## Global Constraints

- Platform admin = holder of `users.manage`. `live.edit` alone no longer reaches every game.
- Assigned game admin = `games.game_admin = auth.uid()` **and** still holds `live.edit`.
- First publish requires a game admin who holds `live.edit` and is active; error copy: "Choose a game admin who can look after games".
- First publish sets `access = 'restricted'` with nobody listed. Republish changes neither game admin, access nor offline.
- Offline blocks players only (library, link, new runs, finishing runs, in-game AI, leaderboard); creator, assigned game admin and platform admin can still test. Player-facing copy: "This game isn’t available."; finishing a run: "This game is offline".
- Creators no longer write `games.access` or `game_access` (`can_manage_access` drops the `can_edit_game` branch).
- Existing live games: `game_admin` = oldest active `users.manage` holder; access untouched.
- Migrations are applied with `supabase db push --linked` (hosted project); never run e2e suites concurrently.

## Review Focus

1. A game admin who loses the game admin role while still assigned must lose the game (no `live.edit` → not `is_game_admin`). Test: SQL (r).
2. A republish must not reopen, reassign or bring online a game. Test: SQL (s).
3. A player mid-run when the game goes offline gets "This game is offline" on finish, not a silent loss. Test: SQL (t).
4. Seeded and older published games used by existing e2e tests must stay playable (seed helper assigns `gameadmin` and access everyone). Test: full e2e run.
5. A deactivated user can't be chosen as game admin. Test: SQL (u).

---

### Task 1: Database rules

**Files:**
- Create: `supabase/migrations/20261025090000_assigned_game_admin.sql`
- Create: `supabase/tests/game_admin.sql` (same DO-block/RESULTS style as `supabase/tests/access_content.sql`)

**Interfaces:**
- Produces:
  - `games.game_admin uuid references profiles(id) on delete set null`, `games.offline_at timestamptz` (no column grants: written only through functions).
  - `private.is_game_admin(p_game_key text) returns boolean` (security definer) and `public.is_game_admin(p_game_key text)` wrapper for `authenticated`.
  - `public.publish_game(p_game_key text, p_game_admin uuid default null) returns integer` (old 1-arg version dropped).
  - `public.game_admins_to_choose() returns table(id uuid, full_name text, email text)`: active `live.edit` holders; callable by `workflow.publish` or `users.manage` holders.
  - `public.set_game_offline(p_game_key text, p_offline boolean) returns void`: `is_game_admin` only.
  - `public.set_game_admin(p_game_key text, p_user uuid) returns void`: `users.manage` only; same validity rule as publish.

- [ ] **Step 1: Write the failing SQL checks** in `supabase/tests/game_admin.sql`, each raising `FAIL <letter>: …` on failure:
  - (a) first publish without `p_game_admin` raises "Choose a game admin who can look after games"; with a `player` id, same.
  - (b) first publish with the game admin sets `game_admin`, `access = 'restricted'`, no `game_access` rows.
  - (c) a player can't select the game's `games` row, live content, or insert a run; after the game admin adds the player, all three work.
  - (d) a second game admin (not assigned) can't select the row, can't insert `game_access`, can't call `set_game_offline`; `is_game_admin` false.
  - (e) the creator can still select the row but can't update `access` or insert `game_access`.
  - (f) `set_game_offline(key, true)`: player with access can't read live content or start a run; the assigned game admin can start a test run; `false` restores the player.
  - (g) `set_game_admin` by a non-`users.manage` caller raises 42501; by the platform admin moves visibility from old to new game admin.
  - (r) the assigned game admin with `live.edit` removed (claims without it) is no longer `is_game_admin`.
  - (s) republish (second `publish_game` with a different `p_game_admin`) leaves `game_admin`, `access` and `offline_at` unchanged.
  - (t) a player's unfinished run, game set offline, finishing it raises "This game is offline".
  - (u) `publish_game` with a deactivated `live.edit` holder raises the "Choose a game admin…" error, and `game_admins_to_choose()` doesn't list them.

- [ ] **Step 2: Run** `npm run test:sql < /dev/null`. Expected: game_admin checks fail (column/function missing).

- [ ] **Step 3: Write the migration.** Contents, in order:
  - columns; backfill `game_admin` for games that have a live row (oldest active `users.manage` holder);
  - `private.is_game_admin`: `(g.game_admin = auth.uid() and has_permission('live.edit')) or has_permission('users.manage')`;
  - `can_manage_access` = `has_permission('allocation.manage') and is_game_admin(key)`, plus `users.manage` passes via `is_game_admin`;
  - `can_play_game` = (`offline_at is null` and (everyone / listed user / listed group member)) or `can_edit_game` or `is_game_admin`;
  - replace `"Signed-in users read the games list"` with `using (can_play_game(key))` (covers edit and game admin);
  - runs insert policy test branch: `can_edit_game or is_game_admin`; extend `private.game_run_before_update` so finishing a non-test run of an offline game raises 'This game is offline';
  - `publish_game(p_game_key, p_game_admin)`: on first publish (no live row) validate the game admin (active, holds `live.edit` through a role), set `game_admin`, `access = 'restricted'`; republish ignores `p_game_admin`; rest unchanged (keep the behind-live and fingerprint checks);
  - `game_admins_to_choose`, `set_game_offline`, `set_game_admin`, `public.is_game_admin`, with `revoke … from public, anon` / `grant … to authenticated`;
  - no column grants on `game_admin`/`offline_at`: `authenticated` can't update them directly; only the security-definer functions above write them (check (d)/(e) cover a direct update being refused).

- [ ] **Step 4: Apply and run.** `set -a && . ./.env.supabase && set +a && supabase db push --linked --yes`, then `npm run test:sql < /dev/null`. Expected: all checks ok, including the older `access_content.sql` (update its expectations where `live.edit` used to pass: ledger a ruling per changed expectation).

- [ ] **Step 5: Commit** `feat: assigned game admin, closed by default, offline (database)`.

### Task 2: Edge Functions follow the assignment

**Files:**
- Modify: `supabase/functions/_shared/server.ts` (`gameOf` selects `game_admin`; new `requireGameAdmin`)
- Modify: `supabase/functions/game-content/index.ts`, `supabase/functions/game-builder/index.ts` (extend), `supabase/functions/game-ai/index.ts` (test runs), `supabase/functions/ai-services/index.ts` (game scope)
- Modify: `e2e/accounts.ts`, `e2e/global-setup.ts` (new role `gameadmin2`), `e2e/games.ts` (`seedGame` publishes with `p_game_admin` = gameadmin's id and, unless `opts.closed`, sets access everyone with the service role)
- Test: `e2e/functions.spec.ts`

**Interfaces:**
- Consumes: Task 1's columns and `publish_game(p_game_key, p_game_admin)`.
- Produces: `requireGameAdmin(c: Caller, game: Game): void` — passes when `c.permissions` has `users.manage`, or `game.game_admin === c.id` and `c.permissions` has `live.edit`; else `HttpError(403, 'Only this game’s game admin can do that')`.

- [ ] **Step 1: Failing e2e tests** in `e2e/functions.spec.ts`: `game-content refuses a game admin who isn’t this game’s` (as `gameadmin2` → 403 with that message); `game-builder extend refuses a game admin who isn’t this game’s` (`streamAs('gameadmin2', …)` throws it); `ai-services refuses setting a game’s AI for a game admin who isn’t this game’s`.
- [ ] **Step 2: Run** `npx playwright test e2e/functions.spec.ts`. Expected: the three new tests fail (200/allowed today).
- [ ] **Step 3: Implement** `requireGameAdmin` and call it where `requirePermission(c, 'live.edit', …)` is today, and for `ai-services` game scope after `ai.game`. `game-ai` test runs: editor → draft as today; else `requireGameAdmin`.
- [ ] **Step 4: Deploy** the four functions (`supabase functions deploy <name> --use-api --project-ref izdjzxrsebssxzcmudxp`) and rerun. Expected: all of `functions.spec.ts` passes.
- [ ] **Step 5: Commit** `feat: Edge Functions check the assigned game admin`.

### Task 3: Publish asks for the game admin

**Files:**
- Modify: `src/game/games.ts` (`GameMeta` + `game_admin`, `offline_at`; select them), `src/game/GameContentProvider.tsx` (`publish(gameAdmin?: string)`), `src/game/useGameContent.ts` (type), `src/screens/creator/studio/TestPublish.tsx`
- Test: `e2e/build.spec.ts`

**Interfaces:**
- Consumes: `game_admins_to_choose()`, `publish_game(p_game_key, p_game_admin)`.
- Produces: `GameMeta.game_admin: string | null`, `GameMeta.offline_at: string | null`.

- [ ] **Step 1: Failing e2e test** `a creator names the game admin at publish and the game starts closed`: seed a checked, unpublished game; in the Studio, **Publish to players** is disabled until a game admin is chosen from the select labelled "Game admin"; choose the gameadmin account; publish; expect text `Published · ` and `Game admin: <name>`; as `player`, `games` select for the key returns no row.
- [ ] **Step 2: Run** it. Expected: FAIL (no "Game admin" select).
- [ ] **Step 3: Implement.** In `TestPublish`, when there is no live version: a `Select` (aria-label "Game admin", first option "Choose a game admin…") from `game_admins_to_choose`, passed to `publish`. When live: "Game admin: <name>" (name from the same list; "Not set" if absent). Success copy on first publish: "Published · the game admin decides who may play it". Offline game: a warning banner "Offline · taken offline by the game admin" in the Studio.
- [ ] **Step 4: Run** `npx playwright test e2e/build.spec.ts`. Expected: all pass.
- [ ] **Step 5: Commit** `feat: the creator names the game admin at publish`.

### Task 4: Game admin console: own games, offline, reassign

**Files:**
- Modify: `src/screens/gameadmin/Console.tsx`; Create: `src/screens/gameadmin/GameStatus.tsx` (offline switch + game admin line/reassign)
- Test: `e2e/demo.spec.ts`

**Interfaces:**
- Consumes: `set_game_offline`, `set_game_admin`, `game_admins_to_choose`, `GameMeta.game_admin/offline_at`.

- [ ] **Step 1: Failing e2e tests:** `a game admin sees only the games assigned to them` (gameadmin2's picker lacks a game assigned to gameadmin); `a game admin takes a game offline and players lose it` (button "Take offline" → confirm dialog "Take “<title>” offline?" → player's library lacks it and `/#/play?game=<key>` shows "This game isn’t available."; "Bring online" restores); `a platform admin hands a game to another game admin` (admin console → "Change game admin" → gameadmin2 → gameadmin2 now sees it, gameadmin doesn't).
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement.** Picker: games with `game_admin === profile.id`, all for `users.manage`. `GameStatus` above the tabs: "Online"/"Offline" badge, Take offline / Bring online (confirm on offline), "Game admin: <name>" with "Change game admin" (select + Save) for `users.manage` only. Content tab gate: assigned game admin or `users.manage` (not `permissions.has('live.edit')`). Platform admin nav reaches the console (if it doesn't already).
- [ ] **Step 4: Run** `npx playwright test e2e/demo.spec.ts`. Expected: all pass (update the existing "restricts a game to a group" and "previews and publishes content" tests to seed with the gameadmin assignment; ledger it).
- [ ] **Step 5: Commit** `feat: game admin console shows own games, offline switch, reassignment`.

### Task 5: Demo reset, runbook, release

**Files:**
- Modify: `scripts/demo-reset.mjs`, `docs/pitch-demo.md`, `README.md`

- [ ] **Step 1: Reset script:** Plan B with `--publish` sets `game_admin` = `gameadmin@deloitte.com`'s id, `access = 'restricted'`, and a `game_access` row for group "Analysts" (if the group is missing, print "Group Analysts not found: Plan B is closed until the game admin opens it" and continue). Print the game admin in the summary line.
- [ ] **Step 2: Runbook:** step 5 gains "choose `gameadmin@deloitte.com` as game admin"; a new step between publish and play: game admin signs in, Access → Selected groups → Analysts; the player reloads after that. Set-up section: a third sign-in (the game admin) on stage. README: one paragraph on assigned game admins and offline.
- [ ] **Step 3: Full suites, one at a time:** `npx tsc -b`, `npm run lint`, `npx vitest run`, `npm run test:sql < /dev/null`, `npm run check:functions`, `npx playwright test`. Expected: all green.
- [ ] **Step 4: Commit** `docs: pitch runbook and reset for assigned game admins`.
- [ ] **Step 5: Release** (after the final review and its fix pass): fast-forward `main`, push, `vercel deploy --prod` with the build env from `.env.local`, smoke `curl` 200; tell the user to run `npm run demo:reset -- --plan-b --publish` and rehearse the new step.
