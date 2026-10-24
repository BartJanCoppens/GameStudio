# Game admin section · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every game gets an admin section where game admins control who may play it (everyone, groups, people) and add content with AI, behind the house-rules check, with platform-admin-managed groups.

**Architecture:**
- **Access:** groups and per-game access live in Postgres. `private.can_play_game` is enforced by RLS on live content and runs, and by `game-ai`.
- **Adding content:** `game-builder` gains an `extend` step (streamed). A new `game-content` Edge Function reviews the candidate and publishes it through a service-role-only SQL function that writes live content, the check row and the draft sync atomically.
- **Republishing:** a `data_revision` on live content lets `publish_game` refuse a draft that is behind live.

**Tech Stack:** as in `docs/superpowers/plans/2026-10-24-any-game-studio.md` (React 19 / Vite / TS, Supabase, Deno Edge Functions, Vitest, Playwright).

**Spec:** `docs/superpowers/specs/2026-10-24-game-admin-section-design.md`

## Global Constraints

- **Permissions:**
  - managing groups needs `users.manage`;
  - managing access needs `allocation.manage` and (`can_edit_game(key)` or `live.edit`);
  - adding content needs `live.edit`.
- **Who may play:** `can_play_game` is true for access `everyone` (and not archived), a direct listing, a listed group, `can_edit_game`, or `live.edit`.
- The AI role's hidden knowledge never reaches the browser and is not changed by additions.
- Extended data keeps every top-level key with the same JSON type, and no list gets shorter.
- **Refusal copy:** "A game admin added content to the live game. Take it into your draft first."
- **Workflow:** commit on `feature/any-game` after each task; run e2e suites one at a time, never concurrently.

## Review Focus

1. **A player outside a restricted game opens it by link or through the API:** no live content, no run, no AI. Tests in Task 1 (SQL) and Task 4 (e2e).
2. **The extend output drops items or changes the content's shape:** refused with a readable reason, and live stays unchanged. Tests in Task 2.
3. **Data posted to publish that differs from what was previewed** (tampered, or with forbidden text): the house-rules review runs on exactly what is published. Tests in Task 2.
4. **A creator republishes a draft that is behind live:** refused with the exact copy above. The Studio's **Take in the live content** fixes it. Tests in Task 1 (SQL) and Task 5 (e2e).
5. **A group is deleted:** its access rows go too, and a restricted game stays restricted (it does not fall back to everyone). Test in Task 1.

---

### Task 1: Database: groups, access, can_play_game, live content publishing, draft revision

**Files:**
- **Create:** `supabase/migrations/20261024140000_groups_access_content.sql`, `supabase/tests/access_content.sql`

**Interfaces (produces):**
- **Tables:**
  - `user_groups(id uuid pk, name text unique 1–60, description text ≤300, created_at)`;
  - `group_members(group_id fk cascade, user_id fk profiles cascade, pk(group_id,user_id))`;
  - `game_access(id, game_key fk cascade, group_id fk cascade null, user_id fk cascade null, check exactly one, unique nulls not distinct (game_key, group_id, user_id))`.
- **`games.access text not null default 'everyone' check in ('everyone','restricted')`**, with `grant update (access)` to authenticated.
- **`private.can_play_game(p_game_key text) returns boolean`**: stable; granted to authenticated.
- **`private.can_manage_access(p_game_key text) returns boolean`**: `allocation.manage` and (`can_edit_game` or `live.edit`).
- **RLS:**
  - groups and members are written with `users.manage`;
  - group names are read by authenticated users;
  - members are read with `users.manage` or `allocation.manage`;
  - `game_access` is read and written with `can_manage_access`;
  - updating `games.access` also requires `can_manage_access`, through a new update policy *"Access managers set access"* with `using/with check (can_manage_access(key))`.
- **Policies:**
  - the live `game_content` select policy for players becomes `stage='live' and can_play_game(game_key)`, with editors and result viewers kept as separate policies;
  - the `game_runs` insert policy becomes `games.play and (test → (can_edit_game or live.edit)) and not archived and (test or can_play_game(game_key))`.
- **`game_content.data_revision int not null default 0`**, and `game_content.base_revision int` (on the draft: the live data revision it was built from).
- **`public.publish_live_content(p_game_key text, p_data jsonb, p_fingerprint text, p_checked_by uuid) returns integer`** (the new live version): service role only. In one transaction it:
  - locks the live row;
  - sets `content = jsonb_set(content, '{data}', p_data)` and `data_revision = data_revision + 1`;
  - inserts `game_checks(passed=true, fingerprint=p_fingerprint, checked_by)`;
  - updates the draft too (`content.data = p_data`, `base_revision = new revision`) when the draft's data equals the old live data;
  - returns the new live version.
- **`publish_game`:** refuses with the exact refusal copy when `draft.base_revision < live.data_revision`, and sets the draft's `base_revision = live.data_revision` on success.

- [ ] **Step 1:** Write `supabase/tests/access_content.sql`, in the same rolled-back DO-block style as `generic_games.sql`. It asserts:
  - (a) a player can't read restricted live content and can't insert a run;
  - (b) a player in a listed group can;
  - (c) a directly listed player can;
  - (d) deleting the group removes their access, and the game stays restricted;
  - (e) a game admin (`live.edit`) can read and run it;
  - (f) a creator who isn't the owner can't manage access, and the owner can;
  - (g) `publish_live_content` bumps `data_revision`, syncs an untouched draft, leaves a changed draft alone, and `publish_game` on that changed draft raises the refusal copy;
  - (h) a player can't call `publish_live_content`.
- [ ] **Step 2:** `npm run test:sql`. Expected: `access_content.sql: no results` (the objects don't exist).
- [ ] **Step 3:** Write the migration. Dry run, then push.
- [ ] **Step 4:** `npm run test:sql`. Expected: every line `ok`, and `generic_games.sql` / `archive_delete.sql` still all `ok`.
- [ ] **Step 5:** Commit.

### Task 2: Server: extend step, game-content publish, shared review, game-ai for game admins

**Files:**
- **Create:** `supabase/functions/_shared/review.ts`, `supabase/functions/game-content/index.ts`, `src/game/dataShape.test.ts`.
- **Modify:**
  - `supabase/functions/game-check/index.ts` (use `review.ts`);
  - `supabase/functions/game-builder/index.ts` (`step: 'extend'`);
  - `supabase/functions/game-ai/index.ts`;
  - `supabase/functions/_shared/gameModel.ts` (`dataShapeProblems`).

**Interfaces (produces):**
- **`dataShapeProblems(before: unknown, after: unknown): string[]`** in `gameModel.ts`. Top-level keys equal, same JSON types; every top-level array (and every array directly inside a top-level object) is the same length or longer. Messages: "The new content dropped <key>", "<key> changed type", "<key> lost items".
- **`reviewGame(admin, gameKey, candidate: { content: GameContent; secret: unknown }): Promise<{ passed: boolean; reasons: string[] }>`** in `review.ts`: `filesProblems`, `scanGameFiles`, `conceptProblems`, then the house-rules model review. This is what game-check does today; game-check now calls it.
- **`game-builder` `step: 'extend'`:**
  - body `{ game_key, instruction }`, `live.edit` required;
  - reads live content and secret plus `dataNotes` on the server;
  - streams JSON `{ data, reply }`;
  - `done` carries `{ data, reply }` only after `dataShapeProblems` passes, else an `error` event with the first problem.
- **`game-content` (`POST { game_key, data }`):**
  - `live.edit` required;
  - candidate = live content with `data` replaced, plus the live secret;
  - `reviewGame`, and on pass `rpc publish_live_content(fingerprint = md5(candidate content || secret))`;
  - returns `{ passed, reasons, version }`;
  - quota kind `'studio'`.
- **`game-ai`:** for a test run whose caller can't edit the game but holds `live.edit`, use the live stage. For non-test runs, require `can_play_game` (rpc) and answer 403 "You don't have access to this game" otherwise.
- **The data step keeps its notes:** `useBuilder` saves `dataNotes` into the content (`GameContent.dataNotes?: string`).

- [ ] **Step 1:** Write `src/game/dataShape.test.ts`:
  - `accepts added items`;
  - `refuses a dropped key`;
  - `refuses a changed type`;
  - `refuses a shorter list`;
  - `refuses a shorter nested list`.

  Run: FAIL.
- [ ] **Step 2:** Implement `dataShapeProblems`. Run: PASS.
- [ ] **Step 3:** Add e2e API tests to `e2e/functions.spec.ts` (free, refused before the model):
  - `game-content refuses a player` (403);
  - `game-content refuses data that drops content` (400 with "dropped");
  - `game-content fails the check for code-breaking data`: data containing a `</script>`-style web address in a string is still reviewed. Use the static scan path: data with "https://x.y" must fail with "contains a web address", because `reviewGame` scans `JSON.stringify(data)` too. Add that to `review.ts`.
- [ ] **Step 4:** Implement `review.ts`, `game-content`, the extend step and the `game-ai` change. `npm run check:functions`, deploy `game-check`, `game-builder`, `game-content` and `game-ai`.
- [ ] **Step 5:** Run the new e2e tests. Expected: PASS. Run the opt-in live test `a game admin extends a game with AI` (E2E_LIVE_AI): extend the tiny quiz with "add two questions about reverse charge" and expect at least 12 questions in `done.data.questions`. Commit.

### Task 3: Admin › Groups

**Files:**
- **Create:** `src/screens/admin/Groups.tsx`.
- **Modify:** `src/data/shared.ts` (screen `groups`, admin nav "Groups" after "Users"), `src/App.tsx`.

**Interfaces:** reads and writes `user_groups` / `group_members` through supabase-js; users come from `useDirectory()` (existing).

- [ ] **Step 1:** e2e `a platform admin creates a group and adds a member`: Groups, then **New group** "E2E Analysts", then **Add member** (search "E2E player") shows 1 member; then rename it, then delete it.
- [ ] **Step 2:** Run: FAIL. Implement: a groups list (name, member count), a detail panel (members with **Remove**, an add-member select over active users, **Rename**, **Delete** with confirmation). Run: PASS. Commit.

### Task 4: Game administration: Access and Content tabs

**Files:**
- **Create:** `src/screens/gameadmin/AccessTab.tsx`, `src/screens/gameadmin/ContentTab.tsx`.
- **Modify:** `src/screens/gameadmin/Console.tsx` (tabs `access | content | players | ai`; Players & results merged into one tab with two sections), `src/app/useApp.ts` (`consoleTab` type).

**Interfaces:**
- **AccessTab:** radio *Everyone* / *Selected groups and people*; group checkboxes; an add-person select over players; listed people with **Remove**; the line "N players can play this game" (members of listed groups plus listed people, de-duplicated). Saves immediately: `games.access`, then inserts and deletes on `game_access`.
- **ContentTab:**
  - an overview of the content (each top-level list with its item count);
  - a textarea "What should be added?" and **Generate** (streamFunction `game-builder` `extend`, with the code streaming in a small panel);
  - a preview: the AI reply, counts before and after, and a GameFrame test play of `{ ...live.content, data: proposed }` (test run);
  - **Check and publish** (callFunction `game-content`), showing the reasons on failure or "Published · players get the new content in their next game".

- [ ] **Step 1:** e2e `a game admin restricts a game to a group`:
  - seed a published tiny quiz and a group containing the e2e player (service role);
  - the game admin sets Access to the group;
  - a second e2e account (the creator has `games.play`, but test with a fresh e2e player-2 account added in `accounts.ts` ROLES as `player2`) doesn't see the game, and gets no live content by direct link (`#/play?game=key` shows "This game isn't published yet." or a no-access message);
  - player 1 sees it.
- [ ] **Step 2:** e2e (free) `a game admin previews and publishes added content`: mock `game-builder` (`page.route`) returning data with 12 questions, then **Check and publish** against the real `game-content`. The tiny quiz passes the static scan; the model review is real, so this test is opt-in with E2E_LIVE_AI. A free variant mocks `game-content` and asserts the UI flow only.
- [ ] **Step 3:** Run: FAIL. Implement both tabs. Run: PASS. Commit.

### Task 5: Studio: a draft that is behind live

**Files:**
- **Modify:**
  - `src/screens/creator/studio/TestPublish.tsx` (when `draft.content` base is behind: show a banner and **Take in the live content**);
  - `src/game/GameContentProvider.tsx` (expose `liveRevision` and `draftBaseRevision`; `takeInLive()` saves the draft with `data = live.data` and `base_revision = live revision` through an RPC `take_in_live(p_game_key)` added to Task 1's migration as a follow-up migration).

- [ ] **Step 1:** e2e `a creator takes in content a game admin added`:
  - seed a published game;
  - the creator changes the draft;
  - the service role calls `publish_live_content` with more questions;
  - the creator's **Publish to players** shows the refusal copy;
  - **Take in the live content** makes the banner disappear, and the draft has the new questions.
- [ ] **Step 2:** Run: FAIL. Implement. Run: PASS. Commit.

### Task 6: Release

- [ ] **Step 1:** Run the full suites one at a time: `npx tsc -b`, `npm run lint`, `npx vitest run`, `npm run test:sql`, `npx playwright test`. Expected: all pass.
- [ ] **Step 2:** Add the access and content steps to `docs/pitch-demo.md`, and the Groups and admin section to the README.
- [ ] **Step 3:** Commit, fast-forward `main`, push, deploy production (the user asked to deploy and release everything), and smoke-test the bundle.
