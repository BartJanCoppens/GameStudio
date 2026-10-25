# Turn-taking games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Creators can make turn-taking games for two colleagues (live with a turn timer, or turn by turn with email/phone notifications), with real secrets per player, run by the platform between turns.

**Architecture:** A new concept mode `turns`. A match lives in the database (`matches` shared row + `match_private` per player + `match_moves` log), written only by a new Edge Function `game-match` that checks access, turn order and expected move number, and sends notifications (Web Push and, when configured, email). Each match plays the game version it started on (`game_versions` snapshots written by both publish paths). The bridge gains `getMatch`, `makeMove` and match-change events; the Studio and Content previews use an in-memory stand-in match. A pg_cron job expires invitations and cancels inactive matches.

**Tech Stack:** React 19 + Vite + TS, Supabase (Postgres RLS, Realtime, pg_cron, Deno Edge Functions), `npm:web-push` in Deno, Resend HTTP API (optional), Vitest, `npm run test:sql`, Playwright against the hosted project.

**Spec:** `docs/superpowers/specs/2026-10-25-turn-taking-design.md`

## Global Constraints

- Two players per match: `a` = inviter, `b` = invited; **b moves first**.
- Ways: `live` (turn timer, creator sets `turnSeconds` 15–600) and `async` (turn by turn).
- Invitations expire: live after **1 hour**, async after **7 days** without an answer.
- Game admin inactivity limit per game: defaults **3 days** (async) and **10 minutes** (live); a timer-passed turn is not activity; a cancelled match counts for nothing.
- Live match starts when both players have it open ("Waiting for <name>" until then).
- Notification text, never game content: "<Name> made a move in <Game> · your turn", "<Name> invites you to play <Game>", "<Name> accepted your invitation · <Game> has started", "<Name> declined your invitation to <Game>".
- Games only ever get first name + initial (`firstNameInitial`).
- No AI role with `mode: 'turns'` (concept check refuses it).
- A match keeps the version it started on; republish / added content never touch it.
- Private state: a player's `match_private` row never reaches the other player (database, Edge Function and bridge host).
- Email needs `RESEND_API_KEY` and `EMAIL_FROM` function secrets; without them email is skipped and logged, phone notifications still work.
- Migrations via `supabase db push --linked`; Edge Functions via `supabase functions deploy <name> --use-api --project-ref izdjzxrsebssxzcmudxp`; never run e2e suites concurrently.

## Review Focus

1. Two moves for the same turn (double click, two tabs) → exactly one applies; the other gets 409 "The game moved on". Test: e2e `game-match refuses a second move for the same turn` (Task 3).
2. A player who lost access (or the game went offline) mid-match can't move or accept. Test: e2e `game-match refuses a move after access is withdrawn` (Task 3).
3. The other player's private state never reaches a player: not by select, not in `game-match` responses, not through Realtime. Test: SQL (p2) and e2e `getMatch never contains the other side's secrets` (Tasks 2, 3).
4. A live invitation nobody opens, and a match nobody moves in, end by themselves. Test: SQL (x1–x3) calling `private.expire_matches()` with backdated rows (Task 2).
5. Republishing during a match: the match keeps playing its own version. Test: SQL (v2) and e2e `a match keeps its version after a republish` (Tasks 2, 5).

---

### Task 1: Concept mode `turns` and the Studio prompts

**Files:**
- Modify: `supabase/functions/_shared/gameModel.ts` (types, `conceptProblems`, concept JSON schema, `BRIDGE_API_TURNS`), `supabase/functions/game-architect/index.ts` (ASK/PROPOSE prompts), `supabase/functions/game-builder/index.ts` (LOGIC prompt for turn games), `src/screens/creator/Studio.tsx` or the concept card component (show the turn choices)
- Test: `src/game/gameModel.test.ts`

**Interfaces:**
- Produces: `GameConcept.mode: 'solo' | 'common_goal' | 'turns'`; `GameConcept.turns: TurnsConfig | null` with `interface TurnsConfig { ways: ('live' | 'async')[]; turnSeconds: number; notify: ('email' | 'push')[]; results: boolean }` (the leaderboard choice is `concept.leaderboard`); `BRIDGE_API_TURNS: string`.

- [ ] **Step 1: Failing unit tests** in `src/game/gameModel.test.ts`: `accepts a turn-taking concept` (mode turns, turns `{ ways: ['live','async'], turnSeconds: 60, notify: ['push'], results: true }`, aiRole null → `conceptProblems` = []); `refuses a turn-taking concept with an AI role` (→ contains "Turn-taking games can’t have an AI role yet"); `refuses turns without ways or notify, or turnSeconds outside 15–600` (→ contains "turn-taking settings"); `normalizes turns to null for solo games`.
- [ ] **Step 2: Run** `npx vitest run src/game/gameModel.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** in `gameModel.ts`; concept schema adds `turns` (nullable object) and `mode` enum `turns`. Architect ASK: question 3 becomes "play mode: solo, a common goal, or turn-taking between two colleagues"; for turn-taking also ask live / turn by turn / both, and how players hear it's their turn (email, phone notification, both); PROPOSE explains `turns` and that turn-taking games have no AI role. Builder LOGIC: for `mode === 'turns'` append `BRIDGE_API_TURNS` and the rules: render from `getMatch()`, only allow input on your turn, `makeMove(move, state, { mine, over })`, resolve the opponent's last move with your own private state at the start of your turn (Battleship example), never put secrets in `state`, `over: { winner: 'a'|'b'|null }` ends the game, no `submitScore`. Design card: shows "Turn-taking · live (60 s per turn) / turn by turn · notified by phone/email".
- [ ] **Step 4: Run** the unit tests and `npm run check:functions`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: turn-taking concept mode and Studio prompts`.

### Task 2: Database: versions, matches, private state, expiry

**Files:**
- Create: `supabase/migrations/20261025120000_turn_taking.sql`, `supabase/tests/turn_taking.sql`

**Interfaces:**
- Produces:
  - `game_versions (game_key, version, content jsonb, created_at)` PK (game_key, version); written inside `publish_game` and `publish_live_content` with the new live version; backfilled from current live rows. Select: `can_play_game(game_key)`.
  - `matches (id uuid, game_key, version int, way 'live'|'async', status 'invited'|'waiting'|'active'|'finished'|'declined'|'withdrawn'|'expired'|'cancelled', player_a uuid, player_b uuid, a_name text, b_name text, turn 'a'|'b', move_no int default 0, state jsonb, last_move jsonb, a_ready bool, b_ready bool, turn_ends_at timestamptz, last_activity_at timestamptz, created_at, finished_at, winner 'a'|'b'|null)`; select: the two players, plus `is_game_admin(game_key)`; no insert/update/delete grants for `authenticated`. In `supabase_realtime` publication.
  - `match_private (match_id, side 'a'|'b', state jsonb)` PK (match_id, side); select only where the caller is that side's player. Not in the publication.
  - `match_moves (match_id, move_no, side, move jsonb, created_at)`; select: the two players.
  - `games.turn_limit_async interval default '3 days'`, `games.turn_limit_live interval default '10 minutes'`, set through `public.set_turn_limits(p_game_key, p_async interval, p_live interval)` (`is_game_admin` only; 1 minute–30 days).
  - `public.match_candidates(p_game_key text) returns table(id uuid, full_name text)`: active users holding `games.play` who may play the game by its access rules (not offline/archived), excluding the caller; caller must `can_play_game`.
  - `private.can_play_game_as(p_game_key text, p_user uuid) returns boolean` (the access branch of `can_play_game` for another user).
  - `private.expire_matches() returns void`: invited live > 1 h / async > 7 days → `expired`; waiting/active with `now() - last_activity_at` over the game's limit for its way → `cancelled`. Scheduled with pg_cron every 5 minutes (`create extension if not exists pg_cron`).
  - `push_subscriptions (id, user_id, endpoint unique, p256dh, auth, created_at)` own rows only (insert/select/delete); `profiles.notify_email bool default true`, `profiles.notify_push bool default true` (own update via column grants).

- [ ] **Step 1: Failing SQL checks** in `supabase/tests/turn_taking.sql` (style of `game_admin.sql`): (v1) after `publish_game` a `game_versions` row exists for the live version; (v2) after a second publish both versions remain; (v3) `publish_live_content` adds a version; (m1) a player can't insert or update `matches`; (m2) a third player can't select a match; (p1) player a selects their own `match_private`; (p2) player b can't select a's private row; (c1) `match_candidates` lists an allowed colleague and not someone outside a restricted game nor the caller; (x1) a live invitation 2 hours old becomes `expired`; (x2) an async active match with `last_activity_at` 4 days old becomes `cancelled`; (x3) a live waiting match 11 minutes idle becomes `cancelled`, a 5-minute one stays; (l1) `set_turn_limits` by a non-assigned game admin raises 42501.
- [ ] **Step 2: Run** `npm run test:sql < /dev/null`. Expected: turn_taking checks fail.
- [ ] **Step 3: Write the migration** (re-create `publish_game` and `publish_live_content` from their latest definitions with the `game_versions` insert added; keep every existing check).
- [ ] **Step 4: Apply and run** `supabase db push --linked --yes`, then `npm run test:sql < /dev/null`. Expected: all files ok.
- [ ] **Step 5: Commit** `feat: matches, private state, versions and expiry (database)`.

### Task 3: `game-match` Edge Function and notifications

**Files:**
- Create: `supabase/functions/game-match/index.ts`, `supabase/functions/_shared/notify.ts`, `src/game/notifyText.test.ts` (imports the shared text builder)
- Modify: `e2e/functions.spec.ts`, `e2e/games.ts` (helper `seedTurnGame`)

**Interfaces:**
- Consumes: Task 2 tables and `match_candidates`, `can_play_game_as`.
- Produces: POST `game-match` with `{ action, ... }`:
  - `invite { game_key, invitee, way }` → `{ match_id }` (invitee must be in `match_candidates`; way allowed by the concept; game turns mode, online, not archived)
  - `accept | decline | withdraw { match_id }` → `{ status }`
  - `ready { match_id }` (live) → `{ status }`; when both ready: `active`, `turn_ends_at = now() + turnSeconds`
  - `move { match_id, move_no, move, state, mine?, over? }` → `{ move_no }`; refuses 409 "The game moved on" if `move_no` ≠ current, 403 "It isn’t your turn", sizes: move ≤ 4 KB, state ≤ 32 KB, mine ≤ 16 KB
  - `pass { match_id }` (live, waiting side, after `turn_ends_at`) → `{ turn }`
  - `get { match_id }` → `{ match, mine, content }` (`content` = the match's version from `game_versions`; `mine` only the caller's side)
  - Every action rechecks `can_play_game_as` for the caller and refuses offline/archived games (403 "This game isn’t available").
- `notify.ts`: `notificationText(kind: 'turn'|'invite'|'accepted'|'declined', from: string, game: string): string` (the exact copy in Global Constraints) and `notify(admin, userId, kind, from, game, url, channels)`; push via `npm:web-push` with `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` secrets (dead subscriptions — 404/410 — deleted); email via Resend when `RESEND_API_KEY` and `EMAIL_FROM` are set; both respect `profiles.notify_*` and the concept's `turns.notify`.

- [ ] **Step 1: Failing tests:** unit `notifyText.test.ts` (each kind's exact text; no extra content). e2e in `functions.spec.ts` (a turn game seeded with `seedTurnGame`, published with access everyone): `game-match: invite, accept and alternate moves` (player invites player2 async → player2 accepts → player2 moves first with move_no 0 → player moves with move_no 1); `game-match refuses a second move for the same turn`; `game-match refuses a move out of turn`; `getMatch never contains the other side's secrets` (player2 moves with `mine: { ships: 'B5' }`; `get` as player has no `B5` anywhere in the response); `game-match refuses a move after access is withdrawn` (game set restricted without player2 → 403); `game-match refuses inviting someone outside the game`.
- [ ] **Step 2: Run** `npx vitest run src/game/notifyText.test.ts` and `npx playwright test e2e/functions.spec.ts -g "game-match|getMatch"`. Expected: FAIL.
- [ ] **Step 3: Implement**; generate VAPID keys once (`npx web-push generate-vapid-keys`), set them with `supabase secrets set` (never printed or committed), put the public key in `.env.local` as `VITE_VAPID_PUBLIC_KEY` and in the Vercel build env at release.
- [ ] **Step 4: Deploy** `game-match` and rerun. Expected: PASS.
- [ ] **Step 5: Commit** `feat: game-match function and notifications`.

### Task 4: The bridge for matches

**Files:**
- Modify: `src/game/bridge/protocol.ts`, `src/game/bridge/bridgeScript.ts`, `src/game/bridge/useBridgeHost.ts`, `src/game/GameFrame.tsx`
- Create: `src/game/bridge/standInMatch.ts`, `src/game/bridge/standInMatch.test.ts`
- Test: `src/game/bridge/protocol.test.ts`, `src/game/bridge/bridgeScript.test.ts`

**Interfaces:**
- Produces:
  - Requests `{ type: 'getMatch' }` and `{ type: 'makeMove'; move: unknown; state: unknown; mine?: unknown; over?: { winner: 'a' | 'b' | null } }` (sizes as Task 3).
  - Host → game event `{ source: 'gamestudio-host', event: 'match', value: MatchView }`; script exposes `GameStudio.getMatch()`, `GameStudio.makeMove(move, state, { mine, over })`, `GameStudio.onMatchChange(cb)`.
  - `interface MatchView { you: 'a' | 'b'; players: { a: { name: string }; b: { name: string } }; turn: 'a' | 'b'; moveNo: number; state: unknown; lastMove: unknown; mine: unknown; way: 'live' | 'async'; turnEndsAt: string | null; status: string; over: { winner: 'a' | 'b' | null } | null }`
  - `BridgeContext.match?: { view: MatchView; move: (m: MakeMove) => Promise<void> }` (real match from Task 5) — when absent and the concept is turns, the host uses `standInMatch`.
  - `standInMatch(names?: { a: string; b: string })` → `{ view(): MatchView; move(m): MatchView }`: in memory, `you` follows `turn` (one person plays both sides), keeps a private state per side and returns only the side to move's `mine`.

- [ ] **Step 1: Failing tests:** protocol parses `getMatch`/`makeMove` and rejects oversize state (> 32 KB) or bad `over`; `standInMatch` alternates turns starting with b, keeps each side's `mine` apart (a's `mine` absent from b's view), ends on `over`; bridge script exposes the three methods and delivers `match` events to `onMatchChange` callbacks.
- [ ] **Step 2: Run** `npx vitest run src/game/bridge`. Expected: FAIL.
- [ ] **Step 3: Implement**; the host posts a `match` event after every change; the Studio and Content previews show "Playing as <A|B>" above the frame for turn games.
- [ ] **Step 4: Run** `npx vitest run src/game/bridge`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: bridge calls for turn-taking games`.

### Task 5: Player screens: invite, list, match

**Files:**
- Create: `src/game/matches.ts` (data + Realtime hooks), `src/screens/player/Matches.tsx` (list), `src/screens/player/InviteDialog.tsx`, `src/screens/player/MatchScreen.tsx`
- Modify: `src/screens/player/Library.tsx`, `src/screens/player/Play.tsx`, `src/data/shared.ts` (screen `match`), `src/app/state.tsx` (`matchId`)
- Test: `e2e/turns.spec.ts`

**Interfaces:**
- Consumes: Task 3 actions, Task 4 `BridgeContext.match`.
- Produces: `useMyMatches(): { rows: MatchRow[] | null; reload }` with Realtime on `matches`; `callMatch(action, body)`.

- [ ] **Step 1: Failing e2e** in `e2e/turns.spec.ts` (two browser pages, tiny turn game fixture `e2e/fixtures/tiny-turns.json`: a counter both players increase; first to 3 wins): `two colleagues play a turn-by-turn game` (player opens the game → **Invite a colleague** → picks "E2E player2" → Turn by turn → **Send invitation** → row "Invited · waiting for an answer"; player2's list shows "Invites you" → **Accept** → player sees toast "E2E player2 accepted…"; player2 **Play** → moves; player's row turns "Your turn" without reload; … until "Finished · you won"); `a live game waits for both players` ("Waiting for E2E player" until both open; then a turn timer shows); `a match keeps its version after a republish` (republish the game with changed content mid-match; the match frame still shows the old content's marker); `the Studio test plays both sides` ("Playing as B" then "Playing as A" after a move).
- [ ] **Step 2: Run** `npx playwright test e2e/turns.spec.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**: list on Library above "Your games" ("Your games with colleagues", statuses and actions as in the sketch); invite dialog from the Play page of a turn game (search over `match_candidates`, way choice only when both allowed); `MatchScreen` loads `get`, renders `GameFrame` with `match`, subscribes to its row, shows "Waiting for <name>", the turn timer (live) and passes an expired turn via `pass`; toasts for invite / accepted / your turn from Realtime.
- [ ] **Step 4: Run** `npx playwright test e2e/turns.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: invite colleagues and play turn-taking games`.

### Task 6: Phone notifications on the player's device

**Files:**
- Create: `public/sw.js`, `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`, `src/game/push.ts`, `src/game/push.test.ts`
- Modify: `index.html` (manifest link), `src/shell/Shell.tsx` (Profile details: "Notify me on this device", "Email me about my games" toggles; iPhone hint "Add Game Studio to your home screen first")

**Interfaces:**
- Produces: `enablePush(): Promise<'on' | 'denied' | 'unsupported' | 'needs-install'>`, `disablePush()`; saves/removes the `push_subscriptions` row; the service worker shows the notification and opens its URL on click.

- [ ] **Step 1: Failing unit tests** `push.test.ts` (with stubbed `navigator`/`Notification`): unsupported browser → 'unsupported'; iOS not installed → 'needs-install'; permission denied → 'denied'; granted → subscription saved with endpoint and keys.
- [ ] **Step 2: Run** `npx vitest run src/game/push.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement**; the service worker handles only `push` and `notificationclick` (no caching).
- [ ] **Step 4: Run** it, then `npm run build`. Expected: PASS, `dist/sw.js` present.
- [ ] **Step 5: Commit** `feat: phone notifications for turn-taking games`.

### Task 7: Game admin: inactivity limits, results, leaderboard

**Files:**
- Modify: `src/screens/gameadmin/Console.tsx`, `src/screens/gameadmin/GameStatus.tsx` (or a new `TurnSettings.tsx`), `src/game/Leaderboard.tsx` / `src/screens/player/Results.tsx`
- Test: `e2e/turns.spec.ts`

- [ ] **Step 1: Failing e2e:** `a game admin sets the longest time without a move` (turn game console → "Longest time without a move" 2 days / 5 minutes → Save → saved values shown after reload); `a game admin sees who played whom` (after a finished seeded match, Players & results shows "E2E player – E2E player2 · E2E player won"); the player's Results for a turn game with a leaderboard shows wins/draws/losses.
- [ ] **Step 2: Run** them. Expected: FAIL.
- [ ] **Step 3: Implement** (results section only when `turns.results`; leaderboard only when `concept.leaderboard`).
- [ ] **Step 4: Run** `npx playwright test e2e/turns.spec.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: game admin settings and results for turn-taking games`.

### Task 8: Docs, full suites, release

- [ ] **Step 1:** README (turn-taking, notifications, the email secrets the user must provide), `docs/pitch-demo.md` (optional turn-taking segment).
- [ ] **Step 2:** Full suites one at a time: `npx tsc -b`, `npm run lint`, `npx vitest run`, `npm run test:sql < /dev/null`, `npm run check:functions`, `npx playwright test`. Expected: all green.
- [ ] **Step 3:** Commit `docs: turn-taking games`.
- [ ] **Step 4 (after the final review and fix pass):** deploy changed Edge Functions, fast-forward `main` (includes the clean-up commits), push, `vercel deploy --prod` with `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_VAPID_PUBLIC_KEY`; smoke test 200 and `/sw.js`; tell the user how to enable email (Resend key + sender) and to rerun `demo:reset`.
