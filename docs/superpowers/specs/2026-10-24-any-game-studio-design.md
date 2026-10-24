# Any game: AI-built games in Game Studio · design

Date: 2026-10-24 · Pitch: 2026-10-26 (two days) · Status: for approval (reviewed by a builder check; leak decision and invoice-game removal taken with the user)

## Intent

Game Studio becomes a place where a creator can make **any kind of game**. The hand-built invoice audit game is removed: it becomes just one game a creator could ask for. The creator talks to the AI the way Claude Design works (it asks questions, then shows a design on screen) and then watches it build the game the way Claude Code works (steps, code, a live preview). The result is published and players play it.

Why now: a pitch in two days. The audience should be impressed by:
- **creativity and flexibility**: each game is a different shape, not one template reworded;
- **originality**: the AI's proposals surprise;
- **visuals**: games look designed;
- **speed**: from idea to a published, playable game within the talk;
- **grounding**: when a game links to source material, its questions and feedback visibly rest on that material.

## Decided with the user

- A creator can make a game about **anything**. They *may* link it to source material (Content Domains; today only *Invoice mandatory mentions.md*, Belgian VAT).
- The **platform admin** sets **house rules and context** that every game must respect (e.g. non-violent, professional). **The platform enforces them**, not the creator's good behaviour.
- Creator flow: **Questions → Design → Code**.
  - **Questions:** like claude.ai/design. Things like type of game, describe your game, leaderboard yes/no, collaborative or competitive, AI within the game, plus whatever else the AI needs before proposing.
  - **Design:** shown on screen.
  - **Code:** like Claude Code.
- **Play modes, for now:** solo games, and solo play contributing to a **common goal**. Live sessions, turn-taking and teams are later.
- **AI within a game:** the creator gives the AI a role, e.g. a Dungeons & Dragons-style **game master** that creates the narrative, or an **opponent** in a two-player game against the AI.
- **Game admins extend content with AI** (more questions, levels, cases). This is *after the pitch*, or a simple version if time allows.
- **Export:** the admin can download a game's code base to take it beyond the platform.
- **Pitch cut, agreed:** see *Goals for the pitch* below.
- **The invoice game goes.** Remove the current invoice game and all code and set-up specific to it. A creator should be able to request such a game through the generic flow.

## Goals for the pitch (must work on stage)

1. **Questions.** New game → a chat in which the AI asks questions, mostly as clickable choices with free text allowed, and adapts the next question to earlier answers. It ends with a proposed concept.
2. **Design.** On screen, side by side:
   - a **concept card**: title, pitch line, what the player does, how they win, scoring, play mode, the AI's role, source material used, the look;
   - a **visual mock-up** of the main game screen in the proposed look.

   The creator changes either by chatting, then approves.
3. **Code.** The AI builds the game in visible **steps**. The creator sees:
   - a step list;
   - the code appearing;
   - a **live, playable preview** when done.

   The creator can ask for changes (another round of code steps) and test-play.
4. **House rules.**
   - The admin edits them on one screen.
   - They are included in every AI step: questions, design, code, in-game AI and the content check.
   - Before publishing, an AI check reviews the game against the rules. A failing game can't be published, and the creator sees why.
5. **Publish and play.** The player sees the game in their library and plays it in a **sealed-off frame**. Scores, the leaderboard and common-goal progress go through the platform.
6. **AI in the game.** A game master or opponent replies **through the platform**:
   - it follows the house rules and the role the creator gave it;
   - it draws on and can quote the source material when the game is linked to it;
   - it is capped per player.
7. **Export.** The admin downloads a zip of the game's files with a readme.

### Removing the invoice game (decided with the user)

The hand-built invoice game and everything specific to it go. **Acceptance test:** asking the generic flow for *"a game where players spot the errors on Belgian invoices, grounded in the VAT document"* produces a playable, grounded game of that kind.

What goes:
- **App code:**
  - the invoice engine and content: invoices, planted errors, rules, scoring, the VAT-number check, field names, the invoice paper;
  - the invoice Studio, with its answer-key preview and AI chat for invoice edits;
  - the invoice-specific "Build with AI / Start from sample" New game dialog;
  - the invoice tabs and statistics in the game-admin Console;
  - the invoice-specific runs code;
  - the Plan B invoice fixture.
- **Server code:**
  - the `studio-chat` function. Its saved-chat tables may be reused for the new creator chat.
  - the invoice rule list in the shared source module. The source **passages stay**: they are the Content Domain.
- **Database:**
  - the demo game `invoice-errors` with its content, runs, chats and keys;
  - the invoice-only columns and checks on `game_runs`;
  - the demo-game exceptions in the permission helper and delete policy.
- **Tests and docs:**
  - the invoice unit tests;
  - the invoice end-to-end tests;
  - the old demo script and the invoice parts of the pitch runbook and README.

What stays and becomes generic:
- **Users, roles and permissions.**
- **The games table and draft/live publishing.**
- **AI services and keys,** quotas and cost tracking.
- **Design systems** (presets and AI-made looks): they feed the look of generated games.
- **The Content screen** with the VAT document's passages.
- **The library, results, game-admin Console and admin overview,** rebuilt around generic games: players and results, the AI services tab, leaderboard and common goal.

Consequences:
- **Empty library after the migration.** Players' libraries are empty until a generated game is published. The **Plan B** game and the reset script provide one for rehearsals and the stage.
- **No more "every creator may edit" exception.** Every game is editable by its creator and platform admins only.
- **Deleted data.** Removing the demo game deletes its runs and leaderboard on the hosted project. That is intended.

## Non-goals (now)

- Live multiplayer, turn-taking, teams.
- A person approving every game before publishing. The existing publish permission can be used for that later.
- Source material beyond the one VAT document; uploading new Content Domains.
- Game admins extending content with AI. A simple version is a stretch goal.
- Server-side verification of scores reported by generated games: a PoC limit, stated openly.
- Mobile layouts for generated games.

## Anti-goals (a failure even if it "works")

- A generated game that can reach the internet, the firm's data, other players' data or an AI key.
- House rules that a creator or a player can talk their way around because the check only lives in a prompt the game controls.
- Every game coming out as the same multiple-choice quiz with different words.
- A stage demo that stalls with nothing visible on screen for minutes.
- Leaving dead invoice-specific code, tables or screens behind, or a generic flow that can't produce an invoice-style game when asked.

## Constraints

- **Stack as today:**
  - React 19 + Vite + TypeScript frontend on Vercel;
  - Supabase: Postgres with RLS, Auth, Edge Functions on Deno, Vault for AI keys;
  - Claude through the existing `_shared/llm.ts` (structured outputs, provider resolution, cost tracking);
  - usage quota through `_shared/quota.ts`.
- **Edge Function time limit:** a single call can run for about 150 s (Free plan) or 400 s (paid). Our measured rate: an 8-invoice game of about 12 operations took 65 s. A whole game's code must therefore be produced in **several calls**, each well under the limit, or streamed within one call that stays under it.
- Content is stored in `game_content` (draft/live, JSONB, currently capped at 256 KB) and publishing uses the draft → live copy. The cap may need raising for generated games.
- AI usage limits exist: per creator (`usage_limits`, audience `creators`) and per player per game (audience `players`). The in-game AI meters against the latter. There is no UI for these limits yet; defaults apply.
- Security posture of the project so far: no secrets in the browser, RLS on every table, SSRF guards, no privilege escalation. Keep it.

## How it works (decided by me, the builder can refine)

### What a generated game is (stored in the draft/live content)

My call:
- **`brief`:** the questions asked and the creator's answers.
- **`concept`:**
  - title, pitch, how to play, win condition, scoring;
  - play mode: `solo` or `common_goal`, with the goal's description and target;
  - leaderboard: on or off;
  - AI role: none, `game_master` or `opponent`, with a plain-language role description;
  - linked source passages;
  - look: design tokens, reusing the existing design-system tokens.
- **`files`:** the game's code. At least `index.html`; the builder may split it into a few files (`game.js`, `style.css`), which are inlined at run time.
- **`data`:** the game's content (questions, levels, cases, story set-up), as JSON kept **separate from the code**, so content can be extended later without touching code. The code reads it through the bridge (below).
- **`ai`** (when the game has an AI role): what the AI knows that the player doesn't, such as the case file, the suspect's secret or the opponent's strategy. It stays on the server: players never receive it through `getData()`.

The **house-rules check result is not stored in the content** (my call). It lives in its own server-written record, keyed on a fingerprint of the exact content checked. That way a saved draft can't carry a stale or forged "passed".

### Creator Studio for generated games (three phases)

One screen with the chat on the left and the stage on the right. My calls on layout:
- A phase bar: **Questions · Design · Code · Test & publish**.
- **Questions:** each AI question appears as a card with choice chips and an "other" text box. The creator can also type freely at any point.
  - The AI should ask roughly 5–8 questions. Mandatory topics: type/idea, play mode, leaderboard, AI role, source material, look/tone.
  - It may ask more, or skip ones already answered in the description.
  - "Propose now" lets the creator skip ahead.
- **Design:**
  - the stage shows the concept card and a **mock-up**: a static HTML preview of the main screen in the proposed look, made by the AI and rendered in the sealed-off frame;
  - chat messages revise the concept and/or the mock-up;
  - **Approve design** moves to Code.
- **Code:**
  - the stage shows a step list (e.g. "Game data", "Screens and layout", "Game logic and scoring", "AI role", "Polish"), the code of the current step as it arrives, and then the live preview;
  - chat messages after the build make targeted changes, as new steps.
- **Test & publish:**
  - **Play test**: the preview in full, using the same bridge as players but marked as a test, so its scores don't count;
  - **Check house rules**: an AI review, with the result shown;
  - **Publish to players**: enabled only when the latest version passed the check;
  - **Export**: admin only.

### The sealed-off frame and the bridge

My calls:
- **The frame.** Generated code runs in an `<iframe sandbox="allow-scripts">` with `srcdoc`. There is no `allow-same-origin`, so the game cannot read the app's cookies or storage or call Supabase.
- **CSP.** A strict policy inside the document: no network (`connect-src 'none'`), inline scripts and styles only, images from `data:`, fonts only from the app's own address (see the leak section).
- **Third-party libraries.** None for the pitch. The AI writes plain HTML, CSS and JS, and canvas is fine.
- **The bridge.** The platform injects a small `GameStudio` script into the frame. The game talks to the app only through `postMessage`, and the app validates every message before acting:
  - `ready()`, `getData()`, `getPlayer()` (first name and initial only);
  - `submitScore(score, details)` and `getLeaderboard()`;
  - `contribute(amount, note)` and `getGoal()` for common-goal games;
  - `askAI({ messages, state })` for the game master or opponent (contract below);
  - `getSources()` for the linked passages, with location;
  - `finish()`.
- **The app does the work.** It turns these messages into its own calls (Supabase RLS-protected tables, or Edge Functions) as the signed-in player.
- **Rate limits.** Scores and contributions are rate-limited per run.

### The one leak the frame can't stop (decided with the user: accept and narrow)

A sandboxed game can still send its own page to an outside address, carrying data in the link (no browser policy blocks this any more). We accept this as a **stated proof-of-concept limit** and narrow what can leak and how:
- Inside games, the bridge gives **first names and initials only**, for the player and on leaderboards. Full names stay in the app's own screens.
- **Fonts are served by the app itself**, not from Google, so the CSP allows no outside font requests either.
- The **house-rules check rejects code** that contains outside web addresses or tries to navigate, open windows or submit forms.
- The app **closes a game the moment its frame navigates away** from the page it was given. It shows "This game tried to leave the platform and was stopped" and records it.
- The proper fix, serving games from a separate address with its own protections, is follow-up work after the pitch.

### The in-game AI contract (my call)

- **The game sends:**
  - the conversation so far (`messages`, short, capped);
  - a `state` object describing where the player is: current case or level, board position, inventory. It is capped in size, passed to the model **as data inside tags, never as instructions**, and can't change the role, rules or sources.
- **The server adds:**
  - the role description from the concept;
  - the game's `ai` content (the secret knowledge, stored server-side);
  - the linked source passages;
  - the house rules.

  All of it is read from the stored game, never taken from the game's message.
- **The reply has one fixed shape for every game:**
  - `say`: what the AI says, in role;
  - `quotes`: ids of source passages it relied on. The bridge resolves them to text and location so the game can show them.
  - `action`: optional, for opponents. One of the moves the concept defines for that game, so the game can apply it.
  - `mood`: optional, for presentation.

  The code-building prompt tells generated games exactly this contract.
- **Play test** (my call): `game-ai` serves the **draft** to people who may edit the game. Test calls count against the **creator's** quota. Test runs are saved with a `test` flag and never appear on leaderboards or in common-goal totals.

### Speed and models (my call)

- **Phase-specific settings.** When the AI provider is Claude:
  - Questions run on a fast setting: low effort, small replies, target under 10 s;
  - Design and Code run on the admin's chosen model.

  This is set in code, not as new admin settings.
- **The code phase** is a few steps of under 90 s each. Independent steps (e.g. game data and screens) run **in parallel**, aiming for **2–3 minutes** from approval to a playable preview on stage.
- **Quota.** The hourly limit per creator goes from 30 to 120 calls. A run-through uses about 15–25, and rehearsals happen in the same hour as the stage run.

### Server pieces (Edge Functions)

My call: three new functions, or one with actions. All of them:
- use `caller()` and a permission check;
- use quotas from `quota.ts`;
- put the house rules into every system prompt;
- treat creator and player text as data inside tags, not as instructions.

The functions:
- **`game-architect`**: the Questions and Design phases. Structured output that is either the next question (text, choices, multi-select or not) or a concept plus a mock-up HTML. Creators only, on games they may edit.
- **`game-builder`**: the Code phase. One call per step, with the brief, concept, data and the files so far, returning files for that step. Each call must stay well under the time limit (target under 90 s). It may stream (SSE through `fetch`, since `supabase.functions.invoke` doesn't stream) so code appears as it is written. Creators only.
- **`game-check`**: the house-rules review of a version (concept, data, AI content, code). Returns pass/fail with reasons. Records the result in its own table with a fingerprint of the content checked.
- **`game-ai`**: in-game AI for players. Takes the game key, run id and the conversation. It uses:
  - the published game's role description and linked sources, read on the server, never taken from the game's message;
  - the house rules.

  It meters against the player's per-game limit and returns short, structured replies.

### Publishing

- Publishing copies draft → live as today, and requires "Approve and publish a version" plus the right to edit the game.
- **New:** the database refuses a live version unless a passed check exists for that exact content (same fingerprint). Enforced in the database or server, not only by a disabled button.
- **Re-check after edits.** Any edit to the draft after a check invalidates that check.

### Runs, scores, leaderboard, common goal

- Generated games need generic runs:
  - a `score` (numeric, higher is better);
  - `details` (JSON);
  - started and finished times.
- **My call:** `game_runs` loses its invoice columns and checks and gets generic ones: `score`, `details`, a `test` flag, plus rules suited to generated games.
- "Admin" for export means the platform admin.
- **Leaderboard:** best score per player per game.
- **Common goal:** each player's contributions add up per game to a shared total against the target from the concept. It is shown in the game through `getGoal()` and on the library card.

### House rules (admin)

- A screen under the admin's menu with:
  - **house rules**: plain sentences, e.g. "No violence", "Professional tone", "No real client names";
  - **context**: e.g. audience, firm values.
- Stored server-side. Readable by functions; edited by admins, using the existing `ai.manage` permission or a new one.
- **Seed values:**
  - rules: "Non-violent", "Professional and respectful tone", "No real people or companies unless they are in the linked source material", "No gambling with real money";
  - context: "Players are Deloitte professionals".

### Export

- A zip of `index.html` (with the bridge as a **local stub** that stores scores in memory and answers `askAI` with a placeholder), the separate files, `data.json`, `sources.json`, `concept.json` and `README.md`.
- The readme explains how to run the game and how to wire the bridge to a real backend, and says that the house-rules protections and the sealed-off frame no longer apply once the game leaves the platform.
- Built in the browser. A small zip library such as `fflate` is acceptable; pin the version.

### Players

- The library lists published games, each in its own look. It shows an empty state until one is published.
- Opening a generated game shows it full-width in the sealed-off frame inside the app's layout, with the platform's own header and a **Leave** button.
- Results show the leaderboard (if enabled) and the common-goal progress.

## Pitch run-through to support (target 6–8 minutes)

1. **Creator:** New game. "A detective game where the player solves VAT fraud cases, with the AI as a suspect they interrogate." Answer 5–8 question cards by clicking.
2. **Design:** the concept card and mock-up appear. Ask for one change ("make it noir, dark and moody"). Approve.
3. **Code:** the steps run with code visible, then the playable preview. Play test for 20 seconds.
4. **Check house rules:** pass. Publish.
5. **Player window:** the game appears in its look. The player plays and talks to the AI suspect, who answers in role and quotes the source. The score lands on the leaderboard.
6. **Admin:** show the house rules screen. Optionally show a blocked game, e.g. a "shooting game" request declined or failing the check. **Export**: download the zip.

## Fallbacks for the stage

- **Plan B game:** a fully built generated game, created and checked once through the real flow and saved as a fixture in the repo. `npm run demo:reset` (rewritten) removes all games and restores the Plan B game. It can restore it published, so players have something to play, or as a draft for the creator.
- Every AI step must fail visibly and recoverably: retry this step, or keep the previous version. It must never leave a half-broken draft as the only copy.
- **Timing on screen:** each step shows a timer and what is happening. The question phase must be quick (target under 10 s per question).

## Left to the builder

- Exact prompts, schemas, step breakdown and token budgets, within the time limit above.
- Whether the three or four functions are separate or one function with actions.
- The streaming implementation, or none if the step sizes keep each step short enough.
- The table and column names; whether house rules live in `ai_settings` or a new table.
- Visual layout details of the Questions, Design and Code stage, following the existing TaxConnect look for the creator's chrome.
- Test coverage. Expected at least:
  - unit tests for bridge message validation and the publish gate;
  - an e2e test for the non-AI parts: a stored generated game publishes, plays in the frame, posts a score and shows on the leaderboard;
  - an opt-in live-AI e2e test for the full creator flow, including the invoice acceptance request above.
