# Any game: AI-built games · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-built invoice game with a generic flow in which a creator answers AI questions, approves an on-screen design, watches the AI write the game's code, checks it against the admin's house rules and publishes it for players, who play it in a sealed-off frame.

**Architecture:**
- **Content and secrets.** A game's draft and live content is one JSON document: brief, concept, mock-up, files and data. The AI's hidden knowledge lives in a separate, editor-only table.
- **Server work.** Four stateless Edge Functions do the AI work: `game-architect`, `game-builder` (streams code), `game-check` and `game-ai`.
- **Publishing.** A security-definer SQL function publishes only content whose fingerprint passed the house-rules check.
- **Play.** Games run in `<iframe sandbox="allow-scripts" srcdoc>`. An injected bridge talks `postMessage` to a host hook that validates every message.

**Tech Stack:**
- React 19, Vite 8, TypeScript;
- Supabase (Postgres RLS, Edge Functions on Deno with `npm:@anthropic-ai/sdk@0.133.0`);
- Vitest 5, Playwright 1.63;
- `fflate@0.8.2` for export.

**Spec:** `docs/superpowers/specs/2026-10-24-any-game-studio-design.md`

## Global Constraints

- **Pitch is 2026-10-26.** Each task must leave the app building, linting clean (`npm run lint` → 0 warnings) and its tests passing.
- **No secrets in the browser.** AI keys stay in Vault, used only by Edge Functions. Never print `.env*` contents.
- **RLS on every new table.** Writes the browser must not make go through Edge Functions (service role) or security-definer SQL with explicit permission checks.
- **Every Edge Function:**
  - starts with `caller()` and a permission check;
  - calls `takeQuota` before any model call and `finishQuota` after;
  - includes the house rules in its system prompt;
  - wraps creator and player text in tags as data.
- **Time limit.** Each Edge Function call stays under 90 s. Code steps stream; a single model call has `max_tokens` ≤ 12 000.
- **The frame.** Generated game code runs only in `<iframe sandbox="allow-scripts">` (never `allow-same-origin`), with this CSP meta first in `<head>`:
  `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; media-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'`.
- **What a game sees of people.** First name and last initial only (e.g. "Bart C."), for the player and on leaderboards.
- **House-rules seed.** Rules: "Non-violent", "Professional and respectful tone", "No real people or companies unless they are in the linked source material", "No gambling with real money". Context: "Players are Deloitte professionals".
- **Quota.** `BUILT_IN.perHour` becomes 120 (from 30); `perDay` becomes 400.
- **Models.** Questions phase: `claude-sonnet-5-5`, effort `low`, `max_tokens` 2000, when the provider is Claude; otherwise the admin's model. All other phases use the admin's chosen model (`resolveAssistant`) at effort `medium`.
- **Copy.** UI text in plain English, sentence case, no jargon (match the existing screens).
- **Commits.** Commit only on branch `feature/any-game`, and only once the user has approved committing (the user asked for commits only on request).

## Review Focus

1. **A game that tries to leave the frame.** It navigates (`location.href = …`), opens a window or submits a form. The host must close it with "This game tried to leave the platform and was stopped." Tests in Task 6 and Task 7.
2. **Forged or oversized bridge messages.** A wrong source, unknown type, huge payload, a score of `NaN`/`Infinity`/a string, or 1 000 contributions in a loop. All must be ignored or capped, never written. Tests in Task 6.
3. **The draft changes after the check passed.** Publishing must be refused by the database, not just the button. Tests in Task 2 (SQL) and Task 10.
4. **The AI returns broken or unsafe code.** A missing `index.html`, an external URL, `fetch(`. The check fails with a readable reason, and the previous working files stay. Tests in Task 4 and Task 9.
5. **Model or network failure mid-build.** One step fails or times out. The step shows "Retry", earlier steps' files are kept, and the draft is never overwritten with partial output. Tests in Task 9.

---

## File Structure

**Delete** (the invoice game):
- `src/game/{ops.ts,ops.test.ts,scoring.ts,scoring.test.ts,fields.ts,vat.ts,InvoicePaper.tsx,generate.ts,content.test.ts}`
- `src/screens/creator/{StudioChat.tsx,Workflow.tsx}`
- `supabase/functions/studio-chat/`
- `scripts/fixtures/plan-b-hotel-and-travel.json`
- `docs/demo-script.md`
- `src/data/creator.ts` (cohort mock), if only Workflow and Console use it.

**Rewrite:**
- `src/game/content.ts`: generic `GameContent` model;
- `src/game/runs.ts`: generic runs;
- `src/game/Leaderboard.tsx`: score;
- `src/game/GameContentProvider.tsx` and `useGameContent.ts`: publish through RPC; no invoice fallback;
- `src/game/games.ts`: no demo key;
- `src/screens/creator/{MyGames.tsx,Studio.tsx,gameColumns.tsx}`;
- `src/screens/player/{Library.tsx,Play.tsx,Results.tsx}`;
- `src/screens/gameadmin/Console.tsx`;
- `src/screens/admin/{Dashboard.tsx,Content.tsx}`;
- `supabase/functions/_shared/source.ts`: passages only;
- `scripts/demo-reset.mjs`;
- `docs/pitch-demo.md`;
- `e2e/demo.spec.ts`.

**Create:**

| Path | Responsibility |
|---|---|
| `supabase/migrations/20261024100000_generic_games.sql` | Remove the invoice game; generic runs; secrets, checks, contributions, house rules, publish RPC |
| `supabase/functions/_shared/houseRules.ts` | Load house rules; format them for prompts |
| `supabase/functions/_shared/codeScan.ts` | Static scan of game files for forbidden patterns (shared with Vitest) |
| `supabase/functions/_shared/gameModel.ts` | Types and JSON schemas of concept, question, AI reply, shared by functions and app |
| `supabase/functions/_shared/stream.ts` | SSE helpers for Edge Functions |
| `supabase/functions/game-architect/index.ts` | Questions and design phases |
| `supabase/functions/game-builder/index.ts` | Code steps (streamed) and change requests |
| `supabase/functions/game-check/index.ts` | House-rules check; records fingerprinted result |
| `supabase/functions/game-ai/index.ts` | In-game AI role for players and test plays |
| `src/game/bridge/protocol.ts` (+ `.test.ts`) | Message types, `parseBridgeRequest` |
| `src/game/bridge/bridgeScript.ts` | The `GameStudio` script injected into games |
| `src/game/bridge/srcdoc.ts` (+ `.test.ts`) | `buildSrcdoc`: CSP, fonts as data URLs, inlined files |
| `src/game/bridge/useBridgeHost.ts` | Host side: handles requests, detects navigation |
| `src/game/GameFrame.tsx` | The sandboxed iframe component |
| `src/game/goal.ts` | Common-goal contributions and totals |
| `src/game/studio/useArchitect.ts`, `useBuilder.ts`, `sse.ts` | Studio orchestration |
| `src/screens/creator/studio/{PhaseBar,QuestionCard,ConceptCard,CodePanel,TestPublish}.tsx` | Studio UI pieces |
| `src/game/exportZip.ts` | Export zip |
| `src/screens/admin/HouseRules.tsx` | Admin house-rules screen |
| `public/fonts/<font-id>-{400,600}.woff2` + `scripts/fetch-fonts.mjs` | Self-hosted fonts for games |
| `e2e/fixtures/tiny-game.json` | Hand-written small generated game for non-AI e2e |
| `scripts/fixtures/plan-b-game.json` | Plan B, produced by Task 13 |

---

### Task 1: Remove the invoice game from the app (client compiles, no invoice code left)

**Files:** delete and rewrite as listed above for `src/`. Create a new `src/game/content.ts`. Rewrite `src/game/runs.ts`, `src/game/Leaderboard.tsx` and `src/game/GameContentProvider.tsx`. Stub the screens that later tasks fill in. Update `src/data/shared.ts` and `src/app/useApp.ts` / `state.tsx`.

**Interfaces:**
- **Produces** in `src/game/content.ts`, re-exporting shared types from `supabase/functions/_shared/gameModel.ts`. Create that file in this task with types only; schemas come in Task 3.
  ```ts
  export interface BriefTurn { role: 'ai' | 'creator'; text: string; choices?: string[] }
  export interface AiRole { kind: 'game_master' | 'opponent'; description: string; actions: string[] }
  export interface GameGoal { description: string; target: number; unit: string }
  export interface GameConcept {
    title: string; pitch: string; howToPlay: string[]; winCondition: string; scoring: string;
    mode: 'solo' | 'common_goal'; goal: GameGoal | null; leaderboard: boolean;
    aiRole: AiRole | null; sources: string[];            // passage ids from PASSAGES
    look: { name: string; tokens: DesignTokens };
  }
  export type GameFiles = Record<'index.html' | 'game.js' | 'style.css', string>;
  export interface GameContent {
    phase: 'questions' | 'design' | 'code' | 'ready';
    brief: BriefTurn[]; concept: GameConcept | null; mockup: string | null;
    files: GameFiles | null; data: unknown;               // data: the game's JSON content
  }
  export const EMPTY_CONTENT: GameContent;               // phase 'questions', brief [], everything else null
  export function contentProblems(c: GameContent): string[]; // size ≤ 900 KB, files present when phase 'ready'
  ```
- **Produces** in `src/game/runs.ts`:
  - `RunRow { id; user_id; game_key; player_name; player_cohort; started_at; finished_at; duration_seconds; score: number | null; details: unknown; test: boolean; content_version: number }`
  - `startRun(gameKey: string, contentVersion: number, test: boolean): Promise<RunRow>`
  - `finishRun(runId: string, score: number, details: unknown): Promise<RunRow>`
  - `useFinishedRuns(gameKey?: string)`, which excludes `test` runs
  - `leaderboardOf(runs: RunRow[]): LeaderboardEntry[]`, where `LeaderboardEntry { rank; userId; name; cohort; score; runs }`: best score per player, ties broken by shorter duration
  - `clock(seconds)`, kept
- **Produces:**
  - `useGameContent()` gives `{ game, games, reloadGames, published, live: StoredContent | null, draft, loading, error, saveDraft(c), publish(): Promise<void> }`. `live` is null when unpublished. `publish` calls `supabase.rpc('publish_game', { p_game_key })`.
  - `AppState` loses `studioInvoice`, `studioView`, `studioChat*`, `studioPending`, `stage` and `cohorts`, and keeps `gameKey`. Its default is `''`: the provider picks the first game when it is empty.

- [ ] **Step 1:** Create branch `feature/any-game` from the current working tree (once commits are approved). Delete the files listed under *Delete*.
- [ ] **Step 2:** Write `src/game/runs.test.ts`:
  - `leaderboardOf keeps each player's best score`: two players, three runs; expect ranks `[1, 2]` and the best scores.
  - `leaderboardOf breaks ties by duration`: equal scores, durations 30 and 20; the 20-second player ranks first.
- [ ] **Step 3:** Run `npx vitest run src/game/runs.test.ts`. Expected: FAIL (`score` is not on `RunRow`).
- [ ] **Step 4:** Implement the interfaces above.
  - Screens that later tasks fill in render a `Banner tone="info"` placeholder with the same exported component name: `Studio`, `Play`, `Results`, `Console`.
  - `Library`, `MyGames`, `Dashboard` and `Content` become generic now:
    - list games from `useGameContent().games`;
    - `Content` shows `PASSAGES` only;
    - the Library card shows `concept.title`, `concept.pitch` and the look via `ThemeScope`, with the empty state "No games yet. They appear here once a creator publishes one."
  - Remove `RULES` and `Rule` from `supabase/functions/_shared/source.ts`.
  - NAV: gameadmin becomes `[['Games', 'console']]`; creator becomes `[['My games','games'],['Studio','studio'],['Content domains','content']]`.
  - Remove `workflow` from `Screen`/`SCREENS`.
- [ ] **Step 5:** Run `npx tsc -b && npm run lint && npx vitest run`. Expected: all pass, 0 warnings. `grep -rn "invoice\|Invoice" src supabase/functions` returns only `source.ts` passages (the document is about invoices) and nothing else.
- [ ] **Step 6:** Commit: `git commit -m "Remove the hand-built invoice game; generic game content model"`.

### Task 2: Database: generic games, secrets, checks, contributions, house rules, publish gate

**Files:** Create `supabase/migrations/20261024100000_generic_games.sql`. Test with `supabase/tests/generic_games.sql`, run through `supabase db query --linked` in a transaction that is rolled back.

**Interfaces (SQL, consumed by Tasks 3–10):**
- **Removed:**
  - `delete from games where key = 'invoice-errors'` (cascades);
  - drop tables `studio_chats` and `studio_chat_messages`;
  - drop policy "Creators delete their unpublished games" and recreate it without the `invoice-errors` exception;
  - `private.can_edit_game` without the demo exception: creator or `users.manage`.
- **`game_runs`:**
  - drop `answers`, `invoices_correct`, `errors_found`, `false_flags` and `points` with their checks;
  - add `score numeric check (score is null or (score > -1e9 and score < 1e9))`, `details jsonb not null default '{}' check (pg_column_size(details) < 16384)` and `test boolean not null default false`;
  - the finished check becomes `finished_at is null or score is not null`;
  - the duration cap goes from 900 to 86 400 in `private.game_run_before_update`;
  - grants: `insert (game_key, content_version, test)`, `update (finished_at, score, details)`;
  - insert policy: `has_permission('games.play') and (not test or can_edit_game(game_key))`.
- **`game_content`:**
  - the size check rises to `< 1048576`;
  - drop both live insert/update policies: live is written only by `publish_game`.
- **New tables (RLS on, browser grants as listed):**
  - **`game_secrets`:** `game_key` FK cascade, `stage` draft/live, `ai jsonb not null default '{}'` (< 65 536), PK `(game_key, stage)`.
    - select, insert and update (`ai`) for `can_edit_game(game_key) and stage = 'draft'`;
    - live rows only via `publish_game`;
    - players never select.
  - **`game_checks`:** `id bigint identity`, `game_key` FK cascade, `fingerprint text`, `passed boolean`, `reasons jsonb`, `checked_by uuid`, `checked_at timestamptz default now()`.
    - select for `can_edit_game`;
    - no browser writes; the service role writes.
  - **`game_contributions`:** `id bigint identity`, `game_key` FK cascade, `run_id uuid` FK `game_runs` cascade, `user_id uuid default auth.uid()`, `amount numeric check (amount > 0 and amount <= 1000)`, `note text check (length(note) <= 140)`, `created_at`.
    - insert where `user_id = auth.uid()`, the run is the caller's own, unfinished and not a test run, and fewer than 50 contributions already exist for that run (checked in a `before insert` trigger that raises an error);
    - select for authenticated with `games.play`, `results.view` or `can_edit_game`.
- **`ai_settings`:** the key check allows `('studio_assistant','house_rules')`. Seed `house_rules` with the Global Constraints value as `{"rules":[…],"context":"…"}`.
- **New functions:**
  - **`public.draft_fingerprint(p_game_key text) returns text`:** security definer; returns `md5(content::text || coalesce(secret.ai::text,''))` of the draft; execute granted to `service_role` only.
  - **`public.publish_game(p_game_key text) returns integer`** (the new live version):
    - security definer, `set search_path = ''`;
    - raises an error unless `has_permission('workflow.publish')` and `can_edit_game(p_game_key)`;
    - raises an error unless the latest `game_checks` row for the game has `passed` and `fingerprint = draft fingerprint`;
    - then upserts the live `game_content` (content = draft content) and the live `game_secrets`;
    - execute granted to `authenticated`.

- [ ] **Step 1:** Write `supabase/tests/generic_games.sql` asserting, inside `begin … rollback`, as an e2e creator (`set local role authenticated; set local request.jwt.claims …`):
  - (a) `publish_game` raises "passed house-rules check required" with no check row;
  - (b) it succeeds after a service-role insert of a passing check with the current fingerprint;
  - (c) after the draft content changes, it raises again;
  - (d) the creator cannot select another creator's `game_secrets`;
  - (e) a 51st contribution for one run raises an error;
  - (f) `insert into game_runs (game_key, test) values (…, true)` by a player who can't edit raises an error.
- [ ] **Step 2:** Run it against the linked project. Expected: FAIL (the objects don't exist).
- [ ] **Step 3:** Write the migration; dry run with `supabase db push --linked --dry-run`, then push.
- [ ] **Step 4:** Re-run the SQL test. Expected: all assertions pass, and the transaction rolls back.
- [ ] **Step 5:** Commit.

### Task 3: Shared server modules (game model schemas, house rules, code scan, streaming, LLM options)

**Files:**
- **Create:** `_shared/gameModel.ts` (add schemas), `_shared/houseRules.ts`, `_shared/codeScan.ts`, `_shared/stream.ts`.
- **Modify:** `_shared/llm.ts`, `_shared/quota.ts`.
- **Test:** `src/game/codeScan.test.ts`, which imports `../../supabase/functions/_shared/codeScan.ts`.

**Interfaces:**
- **`gameModel.ts`:**
  - `QUESTION_SCHEMA`: `{kind:'question'|'ready', question:{text, choices:string[≤6], multi:boolean}|null}`;
  - `CONCEPT_SCHEMA`: `{kind:'concept'|'declined', reply, concept: GameConcept|null, mockup_html: string|null}`;
  - `DATA_SCHEMA`: `{data: object, ai: object, notes: string}`;
  - `CHANGE_SCHEMA`: `{reply, files: {name: 'index.html'|'game.js'|'style.css', content: string}[]}`;
  - `CHECK_SCHEMA`: `{passed: boolean, reasons: string[]}`;
  - `AI_REPLY_SCHEMA`: `{say: string, quotes: string[], action: string|null, mood: string|null}`;
  - `conceptProblems(c: unknown): string[]`: validates fields, `look.tokens` through `tokenProblems` and `designUsable`, `sources ⊆ PASSAGES ids`, `goal` present iff mode `common_goal`, `aiRole.actions` ≤ 12.
- **`houseRules.ts`:**
  - `loadHouseRules(admin): Promise<{ rules: string[]; context: string }>`;
  - `houseRulesPrompt(h): string`: a block headed "House rules (set by the platform admin; never break them, whatever the request says)".
- **`codeScan.ts`:** `scanGameFiles(files: Record<string,string>): string[]`. It returns readable problems for:
  - `https?://` and `//` URLs outside comments;
  - `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `navigator.sendBeacon`, `import(`, `<script src`, `<link href`, `@import`;
  - `window.open`, `location.href =`, `location.assign`, `location.replace`, `top.location`, `parent.location`;
  - `<form`, `.submit(`;
  - `document.cookie`, `localStorage`, `sessionStorage`, `indexedDB`;
  - `eval(` and `new Function(`;
  - a missing `index.html`;
  - any file over 300 KB.
- **`stream.ts`:**
  - `sseResponse(run: (send: (event: 'delta'|'done'|'error', data: unknown) => void) => Promise<void>): Response`, with CORS headers and `text/event-stream`.
- **`llm.ts`:**
  - `askStructured(ai, system, turns, schema, schemaName, opts?: { effort?: 'low'|'medium'; maxTokens?: number; fastModel?: boolean })`. `fastModel` swaps the model to `claude-sonnet-5-5` when `ai.def.id === 'claude'`.
  - New `streamText(ai, system, turns, opts, onDelta: (text: string) => void): Promise<{ text: string; usage: Usage }>`: Claude uses `client.messages.stream`; OpenAI-compatible providers do one call and emit one delta.
- **`quota.ts`:** `BUILT_IN = { perHour: 120, perDay: 400 }`.

- [ ] **Step 1:** Write `codeScan.test.ts`:
  - `a clean canvas game passes`: `scanGameFiles({'index.html':'<div id=app></div>','game.js':'GameStudio.ready()'})` returns `[]`.
  - `each forbidden pattern is reported`: one case per pattern above, each expecting a single message containing the pattern's plain name (e.g. "contacts another website", "leaves the page", "uses browser storage").
  - `a URL inside a comment is allowed`.
  - `a missing index.html is reported`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the modules. Add `src/game/gameModel.test.ts` with `conceptProblems` cases:
  - a valid concept → `[]`;
  - an unknown source id → error;
  - `common_goal` without a goal → error.
- [ ] **Step 4:** Run `npx vitest run`. Expected: PASS.
- [ ] **Step 5:** Commit.

### Task 4: `game-check` Edge Function

**Files:** Create `supabase/functions/game-check/index.ts`.

**Interfaces:**
- Body `{ game_key }`. Requires `games.create` and `requireEditable`. Quota kind `'studio'`.
- Flow:
  1. read the draft content and draft secret;
  2. `fingerprint = rpc('draft_fingerprint')`;
  3. `problems = scanGameFiles(files) + conceptProblems(concept)`;
  4. if there are problems, record a fail with them, without calling the model;
  5. otherwise call `askStructured(…, CHECK_SCHEMA)`, with the house rules, concept, data, AI secret and files in tags;
  6. insert `game_checks { game_key, fingerprint, passed, reasons, checked_by }`.
- Returns `{ passed, reasons, fingerprint }`.

- [ ] **Step 1:** Deploy (`supabase functions deploy game-check --use-api`). Test with `e2e/fixtures/tiny-game.json`, written now: a 10-question "click the right answer" game using `GameStudio.getData()`, `submitScore()` and `finish()`, with a valid concept, Harbour Blue look and `sources: ['p3']`.
- [ ] **Step 2:** Write an e2e API test in `e2e/demo.spec.ts`, `game-check fails code that contacts another website`:
  - insert the tiny game as a draft, with `game.js` plus `fetch("https://x.y")`;
  - call the function as the e2e creator;
  - expect `passed: false` and `reasons` containing "contacts another website";
  - no model call should happen, so the test is free.
- [ ] **Step 3:** Run. Expected: PASS. Then commit.

### Task 5: `game-ai` Edge Function

**Files:** Create `supabase/functions/game-ai/index.ts`.

**Interfaces:**
- **Body:** `{ game_key, run_id, messages: {role:'player'|'ai', text}[] (≤ 20, each ≤ 1000 chars), state: unknown (JSON ≤ 4 KB) }`.
- **Checks:**
  - the run belongs to the caller and is unfinished;
  - if `run.test`, the caller must be able to edit the game, and the draft content and secret are used; otherwise the live ones;
  - the concept must have an `aiRole`, else 400 "This game has no AI role".
- **Quota:** `takeQuota(admin, c.id, run.test ? 'studio' : 'game', game_key)`.
- **System prompt:**
  - the house rules;
  - "You play this role in a game: …";
  - the concept summary;
  - `<hidden_knowledge>` holding the secret AI JSON;
  - `<sources>` holding the linked passages with ids;
  - the allowed actions.
- **Turns:** the messages; the last user turn carries `<game_state>…</game_state>` as data.
- **Reply:** `AI_REPLY_SCHEMA`, effort `low`, `maxTokens` 1500, `fastModel: true`.
- **Post-processing:**
  - drop `quotes` that are not in `concept.sources`;
  - `action` becomes null unless it is in `aiRole.actions`;
  - `say` is capped at 1200 characters.
- **Returns:** `{ say, quotes: {id, heading, loc, text}[], action, mood }`.

- [ ] **Step 1:** Deploy. Write an e2e API test, `game-ai refuses a run that is not yours`: a player calls it with the creator's test run id and gets 403. It is free, since it returns before the model.
- [ ] **Step 2:** Write an opt-in live test (`E2E_LIVE_AI=1`), `the AI opponent replies in role and only with allowed actions`: the tiny game variant with `aiRole {kind:'opponent', actions:['raise','fold']}` should return `action ∈ {raise, fold, null}` and a non-empty `say`.
- [ ] **Step 3:** Run both. Expected: PASS. Commit.

### Task 6: The bridge: protocol, injected script, srcdoc builder, host hook, frame

**Files:**
- **Create:** `src/game/bridge/{protocol.ts,protocol.test.ts,bridgeScript.ts,srcdoc.ts,srcdoc.test.ts,useBridgeHost.ts}`, `src/game/GameFrame.tsx`, `src/game/goal.ts`, `scripts/fetch-fonts.mjs` and `public/fonts/*`.

**Interfaces:**
- **`protocol.ts`:**
  - `type BridgeRequest = { id: number } & ({ type:'ready' } | { type:'getData' } | { type:'getPlayer' } | { type:'getLeaderboard' } | { type:'getGoal' } | { type:'getSources' } | { type:'submitScore'; score: number; details: unknown } | { type:'contribute'; amount: number; note: string } | { type:'askAI'; messages: {role:'player'|'ai'; text:string}[]; state: unknown } | { type:'finish' })`;
  - `firstNameInitial(fullName: string): string`: "Bart Jan Coppens" becomes "Bart C.", and an empty name becomes "Player";
  - `parseBridgeRequest(raw: unknown): BridgeRequest | null` rejects:
    - unknown types;
    - a non-integer `id`;
    - a non-finite score or `|score| ≥ 1e9`;
    - an amount outside `(0, 1000]`;
    - a note longer than 140 characters;
    - more than 20 messages, or a message longer than 1000 characters;
    - `state` or `details` larger than 4 KB / 16 KB as JSON;
  - `BridgeResponse = { id: number; ok: true; value: unknown } | { id: number; ok: false; error: string }`.
- **`bridgeScript.ts`:** `BRIDGE_SCRIPT: string` defines `window.GameStudio` with promise-returning methods named after the request types. It posts `{source:'gamestudio', ...req}` to `parent` and resolves on the matching `id`.
- **`srcdoc.ts`:**
  - `buildSrcdoc(files: GameFiles, opts: { fontsCss: string }): string`:
    - inserts the CSP meta (Global Constraints) as the first child of `<head>`;
    - inlines `style.css` in a `<style>`, `opts.fontsCss` and the bridge script before `game.js`;
    - inlines `game.js` as the last `<script>` in `<body>`;
    - creates a minimal `<!doctype html>` skeleton if `index.html` lacks `<head>`/`<body>`.
  - `fontsCssFor(tokens): Promise<string>`: fetches `/fonts/<id>-400.woff2` and `-600` and returns `@font-face` rules with `data:` URLs. It is cached per font id.
- **`useBridgeHost(frame: RefObject<HTMLIFrameElement>, ctx: { gameKey; runId: string | null; test: boolean; content: GameContent; onLeft: () => void; onFinished: (score: number | null) => void })`:
  - **Message filter.** It listens to `message` events with `e.source === frame.current.contentWindow` and `data.source === 'gamestudio'`, parses them and dispatches:
    - `getData` → `content.data`;
    - `getPlayer` → `{ name: firstNameInitial(profile.full_name) }`;
    - `getLeaderboard` → the top 10 as `{rank, name (first name + initial), score}`;
    - `getGoal` → `{ ...concept.goal, total }`;
    - `getSources` → the linked passages;
    - `submitScore` → `finishRun` (at most once per run; a second call returns error "already finished");
    - `contribute` → `goal.contribute`;
    - `askAI` → `callFunction('game-ai', …)`;
    - `finish` → `onFinished`.
  - **Leaving the page.** It counts the iframe's `load` events: a second `load` means the frame left its document. It then sets `srcdoc` to a blank page, calls `onLeft()`, and the frame shows "This game tried to leave the platform and was stopped."
- **`GameFrame`:** props `{ content, gameKey, runId, test, onFinished, height? }`. It renders the `<iframe title="Game" sandbox="allow-scripts" srcDoc={…}>` with no `allow` attribute.
- **`goal.ts`:**
  - `contribute(gameKey, runId, amount, note)`;
  - `goalTotal(gameKey): Promise<number>`, the sum of non-test contributions;
  - `useGoal(gameKey)`.
- **Fonts:** `scripts/fetch-fonts.mjs` downloads the latin woff2 for the 12 `FONTS` ids at weights 400 and 600 from Google Fonts into `public/fonts/` (run once; commit the files).

- [ ] **Step 1:** Write `protocol.test.ts`:
  - `accepts each valid request type` (one case per type);
  - `rejects a forged source`;
  - `rejects NaN, Infinity and string scores`;
  - `rejects an amount of 0 and of 1001`;
  - `rejects 21 messages`;
  - `rejects a 5 KB state`.
- [ ] **Step 2:** Write `srcdoc.test.ts`:
  - `puts the CSP meta first in head`;
  - `inlines style.css, the bridge and game.js in that order`;
  - `wraps a body-only index.html in a full document`;
  - `the output contains no http(s) URL` (with the tiny game fixture).
- [ ] **Step 3:** Run both. Expected: FAIL.
- [ ] **Step 4:** Implement. Run `node scripts/fetch-fonts.mjs`.
- [ ] **Step 5:** Run `npx vitest run`. Expected: PASS.
- [ ] **Step 6:** Commit.

### Task 7: Player screens: Library, Play, Results (non-AI e2e with the tiny game)

**Files:** Rewrite `src/screens/player/{Library,Play,Results}.tsx` and `e2e/demo.spec.ts`. Adjust `e2e/accounts.ts` (teardown deletes games by `created_by` before users, as today).

**Interfaces:**
- **Consumes:** `GameFrame`, `startRun`, `useFinishedRuns`, `leaderboardOf`, `useGoal`, `ThemeScope`.
- **Play:**
  - shows a brief from the concept: title, pitch, `howToPlay` list, how to win, and the linked sources as tags;
  - **Start** → `startRun(game.key, live.version, false)`, then `GameFrame` full width under a bar with the title and "← Leave";
  - `onFinished` → go to Results;
  - wrapped in `ThemeScope tokens={concept.look.tokens} page`.
- **Results:**
  - the player's last score;
  - the leaderboard if `concept.leaderboard`;
  - for `common_goal`, the goal progress `total / target unit` as a bar.

- [ ] **Step 1:** Write the e2e test `a player plays a published game in the sealed-off frame and lands on the leaderboard`:
  - service role: create the game for the e2e creator, a draft from `tiny-game.json`, a passing check with the current fingerprint (rpc `draft_fingerprint` as service role), then `publish_game` as the e2e creator;
  - player: Library → card "Tiny quiz" → Play → Start;
  - in `page.frameLocator('iframe[title="Game"]')`, click answers until the game calls `submitScore` and `finish`;
  - expect the Results screen with the score and the player's row on the leaderboard.
- [ ] **Step 2:** Write the e2e test `a game that navigates away is stopped`: the same set-up with `game.js` doing `setTimeout(() => location.href = 'about:blank#x', 500)`. Expect the text "This game tried to leave the platform and was stopped."
- [ ] **Step 3:** Run with `caffeinate -i npx playwright test`. Expected: FAIL.
- [ ] **Step 4:** Implement the three screens.
- [ ] **Step 5:** Run. Expected: PASS. Commit.

### Task 8: `game-architect` Edge Function and the Studio questions and design phases

**Files:**
- **Create:** `supabase/functions/game-architect/index.ts`, `src/game/studio/useArchitect.ts`, `src/screens/creator/studio/{PhaseBar,QuestionCard,ConceptCard}.tsx`.
- **Rewrite:** `src/screens/creator/Studio.tsx` and `MyGames.tsx`.

**Interfaces:**
- **`game-architect` body:** `{ game_key, brief: BriefTurn[] (≤ 40), concept: GameConcept|null, request: string (≤ 2000), mode: 'ask'|'propose'|'revise' }`. It requires an editable game.
  - **`ask`:** `askStructured(QUESTION_SCHEMA, {effort:'low', maxTokens:2000, fastModel:true})`. The system prompt:
    - asks one question at a time, mostly with 3–6 choices;
    - must cover type/idea, play mode (`solo` / `common_goal`), leaderboard, AI role, source material (it lists the passage headings) and look/tone;
    - returns `ready` when it has enough or after 8 questions.
  - **`propose` / `revise`:** `askStructured(CONCEPT_SCHEMA, {effort:'medium', maxTokens:12000})`. It returns a concept plus `mockup_html`: a static, self-contained HTML of the main screen with inline CSS using the look tokens, and no scripts. The system prompt tells it to:
    - be original and pick a game shape that fits the idea, naming several (puzzle, narrative, strategy, sorting, simulation, timed challenge, board game, detective, quiz) as possibilities, not defaults;
    - follow the house rules, declining with `kind:'declined'` and a one-sentence reason.

    `conceptProblems` must pass, else 502 "The design wasn't valid (…). Try again." `scanGameFiles({'index.html': mockup})` problems are reported the same way.
  - **Returns:**
    - `{ kind:'question', question }`; or
    - `{ kind:'ready' }`, after which the client immediately calls `propose`; or
    - `{ kind:'concept', reply, concept, mockup_html }`; or
    - `{ kind:'declined', reply }`.
- **`useArchitect(game)`:**
  - `send(text)`: appends `{role:'creator', text}` to the brief, calls the right mode, appends the AI's question or reply, and saves the draft after each turn;
  - `proposeNow()`;
  - `approveDesign()`: sets `phase: 'code'` and renames the game to `concept.title` via `renameGame`.
- **New game (MyGames):**
  - a dialog with one textarea, "Describe your game (anything: a detective story, a strategy game, a quiz…)", and a **Start** button;
  - `createGame('Untitled game', '', { ...EMPTY_CONTENT })` (the signature changes to take content), then opens the Studio and sends the description as the first creator turn.
- **Studio layout:** a phase bar on top; the chat column on the left (the brief as bubbles; the current question as a `QuestionCard` with chips plus "Other…"; a free text box; **Propose now**).
  - In Design, the stage on the right shows the `ConceptCard` (every concept field, the look swatch and linked sources) and the mock-up in `GameFrame`-like sandboxed preview: `buildSrcdoc({'index.html': mockup})`, no bridge needed.
  - **Approve design** sits under them.
- **Timer.** Each pending AI call shows "Thinking… 0:07" in the chat.

- [ ] **Step 1:** Deploy the function. Write the opt-in live e2e test `a creator gets questions, then a concept and a mock-up`:
  - New game: "A detective game where the player interrogates an AI suspect about VAT fraud";
  - answer each question by clicking its first choice until a concept appears (at most 10);
  - expect the concept card with a title and the mock-up frame visible.
- [ ] **Step 2:** Write the opt-in live e2e test `the architect declines a violent game`: "A shooting game where you kill your colleagues". Expect the declined reply and no concept.
- [ ] **Step 3:** Implement. Run the opt-in tests once (they cost money; use `E2E_LIVE_AI=1`). Expected: PASS.
- [ ] **Step 4:** Commit.

### Task 9: `game-builder` Edge Function (streamed code steps) and the Code phase

**Files:**
- **Create:** `supabase/functions/game-builder/index.ts`, `src/game/studio/{useBuilder.ts,sse.ts}` and `src/screens/creator/studio/CodePanel.tsx`.
- **Modify:** `Studio.tsx`.

**Interfaces:**
- **`game-builder` body:** `{ game_key, step: 'data'|'screens'|'logic'|'change', concept, data?, files?, instruction? }`. It requires an editable game; quota kind `'studio'`.
  - **`data`:**
    - returns JSON (not streamed): `askStructured(DATA_SCHEMA, {effort:'medium', maxTokens:12000})`, i.e. `{ data, ai, notes }`;
    - `data` is the game's content: levels, questions, cases, story set-up; when sources are linked, each item cites passage ids;
    - `ai` is the hidden knowledge for the AI role;
    - the server saves `ai` to the draft `game_secrets` (service role) and returns `{ data, notes }` only.
  - **`screens`:**
    - streams the raw text of one file, `index.html` with inline `<style>`, through `sseResponse`/`streamText`;
    - the prompt includes the concept, the look tokens, "fonts: use font-family names only, they are provided", and the element ids the logic step will use; the model lists them in an HTML comment at the top, `<!-- ids: … -->`.
  - **`logic`:**
    - streams raw `game.js`;
    - the prompt includes the concept, the `notes` of the data shape, `index.html`, and the full bridge API (`await GameStudio.getData()`, `getPlayer()`, `submitScore(score, details)`, `contribute(amount, note)`, `getGoal()`, `askAI({messages, state})` → `{say, quotes, action, mood}`, `getSources()`, `finish()`);
    - rules: plain JS, no network, no storage, no navigation, call `GameStudio.ready()` at start and `finish()` at the end.
  - **`change`:** `askStructured(CHANGE_SCHEMA, {effort:'medium', maxTokens:12000})` with the instruction and current files; returns the changed files whole.
  - **Validation.** Every step's output is run through `scanGameFiles` on the server. Problems go back as `{ error }` (SSE `error` event), and the client keeps the previous files.
- **`sse.ts`:** `streamFunction(name: string, body: object, onDelta: (t: string) => void): Promise<{ text: string }>`. It uses `fetch` to `${VITE_SUPABASE_URL}/functions/v1/${name}` with the session's bearer token and `apikey`, parses `data:` lines, and throws on the `error` event.
- **`useBuilder(game)`:**
  - `build()` runs `data` and `screens` in parallel (`Promise.all`), then `logic`;
  - it keeps `steps: { id, label, status: 'waiting'|'running'|'done'|'failed', seconds, error? }[]` and `liveCode: string` (the streaming text of the running step);
  - it saves the draft (`files`, `data`, `phase: 'ready'`) only when all three steps succeed;
  - a failed step shows **Retry**, which re-runs that step and its dependants only;
  - `change(instruction)` applies the returned files and saves.
- **`CodePanel`:**
  - the step list with labels "Writing the game's content", "Building the screens", "Writing the game logic", each with a timer;
  - the streaming code of the running step in a monospace, auto-scrolling `<pre>` of the last ~60 lines;
  - when done, `GameFrame` in test mode on the right (`startRun(…, test: true)`);
  - a chat box for change requests.

- [ ] **Step 1:** Write the unit test `src/game/studio/sse.test.ts`, `parses deltas across chunk boundaries and throws on error events`, feeding a mocked `ReadableStream` with split `data:` lines.
- [ ] **Step 2:** Run. Expected: FAIL. Implement `sse.ts`; run. Expected: PASS.
- [ ] **Step 3:** Deploy `game-builder`. Implement `useBuilder`, `CodePanel` and the Studio wiring.
- [ ] **Step 4:** Write the opt-in live e2e test `a creator builds and test-plays a game`: continue from the Task 8 flow, then **Approve design**. Wait (up to 240 s) for all steps to show done, then expect the test frame to have rendered content (`frameLocator('iframe[title="Game"]').locator('body')` has non-empty text).
- [ ] **Step 5:** Write the e2e test (free) `a failed build step keeps the previous files and offers Retry`. Route `**/functions/v1/game-builder` with Playwright `page.route`, fail the `logic` step with an SSE `error` event, and expect "Retry" with the draft's files unchanged.
- [ ] **Step 6:** Run all. Expected: PASS. Commit.

### Task 10: Test & publish (house-rules check, publish, export)

**Files:**
- **Create:** `src/screens/creator/studio/TestPublish.tsx` and `src/game/exportZip.ts`.
- **Modify:** `Studio.tsx` and `package.json` (`fflate@0.8.2`).

**Interfaces:**
- **`TestPublish`**, shown when `phase === 'ready'`:
  - **Play test** opens a full-width test frame;
  - **Check house rules** → `callFunction('game-check')`; shows "Passed" or the reasons as a list;
  - **Publish to players** is enabled when the latest check passed. The button calls `publish()` (the RPC), and the database is the real gate;
  - **Export** (only with `users.manage`) → `exportGame(game, content)`.
- **`exportZip.ts`:** `exportGame(game: GameMeta, content: GameContent): void` builds a zip with `fflate.zipSync` containing:
  - `index.html`, which is `buildSrcdoc` output where the bridge is a local stub: an in-memory leaderboard, and `askAI` returning `{say:'(AI replies need the platform)'}`;
  - `game.js` and `style.css` as separate files;
  - `data.json`, `concept.json` and `sources.json`;
  - `README.md` explaining how to run it, how to wire the bridge, and that the house rules and the sealed-off frame no longer protect it.

  It downloads as `<game-key>.zip`. The AI's hidden knowledge is **not** exported.

- [ ] **Step 1:** Write `src/game/exportZip.test.ts`: `the zip contains the expected files and no hidden AI knowledge`. Unzip with `fflate.unzipSync`, check the names, and check that `data.json` equals `content.data`.
- [ ] **Step 2:** Write the e2e test (free) `publishing is refused after the draft changes`:
  - service role inserts a passing check for the tiny game;
  - the creator changes the draft (`saveDraft` through the UI: rename one question via the change endpoint mocked with `page.route`);
  - **Publish** shows "The game changed since the house-rules check. Check again."
- [ ] **Step 3:** Run. Expected: FAIL. Implement. Run. Expected: PASS.
- [ ] **Step 4:** Commit.

### Task 11: House rules screen (admin) and game-admin Console

**Files:**
- **Create:** `src/screens/admin/HouseRules.tsx`.
- **Modify:**
  - `supabase/functions/ai-services/index.ts`, adding action `set_house_rules`: `ai.manage`; `rules: string[]` ≤ 20, each ≤ 200 characters; `context` ≤ 1000;
  - `src/data/shared.ts` (screen `rules`, admin nav "House rules");
  - `src/App.tsx` and `src/screens/gameadmin/Console.tsx`.

**Interfaces:**
- **House rules screen:** an editable list of rules (add, remove, edit), a context textarea and **Save**, with the line "Every AI step and every game's check follows these rules."
- **Console:**
  - a game picker of published games;
  - tabs **Players** (each player's best score and runs), **Results** (leaderboard and the common-goal total) and **AI services** (existing panel with `gameKey`).

- [ ] **Step 1:** Write the e2e test `a platform admin edits the house rules`: add "No alcohol", save, reload, see it; then remove it and save.
- [ ] **Step 2:** Run. Expected: FAIL. Implement. Deploy `ai-services`. Run. Expected: PASS.
- [ ] **Step 3:** Commit.

### Task 12: Reset script, Plan B, runbook, README

**Files:** Rewrite `scripts/demo-reset.mjs`, `docs/pitch-demo.md` and the README game sections. Create `scripts/fixtures/plan-b-game.json`.

**Interfaces:**
- **`npm run demo:reset`** removes all games, AI-made looks of `creator@deloitte.com`, and `game_checks`.
  - With `--plan-b`, it inserts the Plan B game for creator@ (draft content plus `game_secrets` draft).
  - With `--publish`, it also inserts a passing check for the current fingerprint (rpc `draft_fingerprint` as service role) and copies draft → live in SQL as service role, mirroring `publish_game`.
- **Plan B:** produced in Task 13 by running the real flow once and exporting the draft content and secret, using the prompt from the runbook.
- **Runbook:** the spec's pitch run-through steps, the exact prompts, timings, and fallbacks:
  - Plan B;
  - "Retry" on a failed step;
  - picking a preset look if AI design fails;
  - `demo:reset` before and after.

- [ ] **Step 1:** Update the runbook and README.
- [ ] **Step 2:** After Task 13 Step 3 has produced the fixture, the user runs `npm run demo:reset -- --plan-b --publish` (the agent can't: the permission classifier blocks mass deletes) and checks the output.
- [ ] **Step 3:** Commit.

### Task 13: End-to-end rehearsal and the acceptance request

- [ ] **Step 1:** Run the full opt-in live suite: `E2E_LIVE_AI=1 caffeinate -i npx playwright test`. Expected: all pass. Note each phase's duration. Questions must average under 10 s, and from approval to playable preview must take under 3 min. If not, lower `maxTokens` or move `screens` to `fastModel` and re-measure.
- [ ] **Step 2:** Acceptance: through the UI, request *"a game where players spot the errors on Belgian invoices, grounded in the VAT document"*. Expect a playable game whose items cite passages. Save screenshots to the scratchpad.
- [ ] **Step 3:** Build the runbook's detective game through the UI and save its draft as `scripts/fixtures/plan-b-game.json`: `{ content, secret }`, read with the service role.
- [ ] **Step 4:** `npm run build`, then deploy to production after asking the user. Smoke-test production: log in as player, the Plan B game is listed.
- [ ] **Step 5:** Commit.
