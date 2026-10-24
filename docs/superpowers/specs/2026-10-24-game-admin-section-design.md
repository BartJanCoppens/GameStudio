# Game admin section · design

Date: 2026-10-24 · Pitch: 2026-10-26 · Status: for approval (reviewed by a builder check; calls marked "my call")

## Intent

Every game has an admin section where a game admin looks after it once it exists:
- decides **who may play** it;
- **adds content** (more levels, questions, cases, challenges) with the help of AI.

Today every player sees every published game, and content can only change through the creator's Studio.

## Decided with the user

- **Access, per game:**
  - **Everyone:** all players, as today.
  - **Selected groups**, e.g. "Analysts", "New joiners 2026".
  - **Selected people:** individual names, added on top of the groups.
- **Groups** are named lists of people, managed **only by the platform admin**. Game admins pick from them.
- **Content:** adding content **with AI** is enough for now. Editing items by hand is later.

## Goals for the pitch

1. **Groups screen (platform admin).** Create, rename and delete groups; add and remove members (search existing users); a person can be in several groups.
2. **Access tab (per game).** Choose *Everyone* or *Selected groups and people*. For the second: pick groups, add individuals, see the resulting number of players. Saved immediately, with a confirmation toast.
3. **Enforced by the platform, not just the screens.** A player outside a restricted game's list:
   - doesn't see it in their library;
   - can't read its live content;
   - can't start a run, even by link or through the API;
   - can't use its in-game AI.

   Existing runs and leaderboard entries stay.
4. **Content tab (per game).** The game admin describes what to add ("three harder cases about reverse charge"). The AI writes the additions in the same shape as the game's existing content, so the game's code picks them up unchanged. Grounded games keep citing their source passages.

   The tab then shows:
   - the AI's summary of what it added;
   - what grew: counts of items per list, before and after;
   - a test-play preview of the game with the new content (never counted).

   **Check and publish** runs the house-rules check on the game with the new content. Only if it passes does that become the live version. Runs in progress keep the version they started with.
5. **The game admin section has four tabs:** Access · Content · Players & results · AI services. It stays where it is today, in the game admin console with its game picker, and gains the two new tabs.

## Non-goals

- Changing the AI role's hidden knowledge when adding content.
- An Access screen for creators: the database allows them to manage access to their own games, but the screen is the game admin console, which only game admins reach (my call).
- Changing the free-text cohort on users: groups are separate and leave it alone (my call).

- Editing content items by hand.
- Game admins creating groups.
- Per-game assignment of game admins: every game admin can look after every game, as today.
- Invitations or notifications when someone gets access.
- Scheduling (opening and closing dates) and cohort-based reporting.

## Anti-goals

- A restricted game that a player can still play by link, through the API or through its AI.
- Added content that skips the house-rules check, or a check that passed on different content than what went live.
- Added content that breaks the game: the code no longer understands the content's shape.
- Losing added content the next time the creator republishes from the Studio.

## Constraints

- Same stack and security posture as the rest of the app:
  - RLS on every table;
  - privileged writes through Edge Functions or security-definer SQL with explicit checks;
  - every AI step behind `takeQuota`, the house rules in the prompt, and creator text as data.
- **Permissions** (existing keys):
  - Managing access needs *Allocate to cohorts and players* (`allocation.manage`), plus either the right to edit the game (its creator, or a platform admin) or *Add content to a live game* (`live.edit`, held by game admins).
  - Adding content needs `live.edit`.
  - Managing groups needs *Manage users and invitations* (`users.manage`, platform admin).
- **Unchanged rule:** players see game titles in the games list, but only games they may play show in their library and can be opened.

## How it works (my calls; the builder can refine)

### Data

- **Groups:**
  - `user_groups`: `id`, `name` (unique, 1–60 characters), `description`, `created_at`;
  - `group_members`: `group_id`, `user_id`, with that pair as primary key.
  - Writes only with `users.manage`. Any signed-in user may read group names; members are readable by holders of `allocation.manage` or `users.manage`.
- **Access:**
  - `games.access`: `'everyone' | 'restricted'`, default `'everyone'`;
  - `game_access`: `game_key`, then either `group_id` or `user_id` (exactly one), unique per game.
- **`private.can_play_game(key)`** is true when any of these holds:
  - the game is not archived and its access is everyone;
  - the caller is listed directly;
  - the caller is in a listed group;
  - the caller may edit the game (its creator, or a platform admin);
  - the caller holds `live.edit` (game admins).

  Other creators don't get past a restriction on games that aren't theirs (my call).
- **Where `can_play_game` is enforced:**
  - the live `game_content` select policy for players;
  - the `game_runs` insert policy;
  - `game-ai`, which checks it on the server for non-test runs.

  The library simply shows what the player can read.

### Adding content

- A new action on `game-builder`, `step: 'extend'`, for `live.edit` holders, quota kind `'studio'`.
  - **Input:** the live concept, the live data, the game's data notes (the data step's notes are now kept; see below), and the request.
  - **Output (streamed):** JSON with:
    - `data`: the full new content, which must keep every existing top-level key and its type;
    - `reply`.
  - **The AI role's hidden knowledge is not changed by additions, for now (my call).** The extend step reads it on the server, so additions fit the character. It never goes to the browser, and the live secret stays as it is. That keeps secrets server-only and keeps "runs in progress keep their version" true for the AI role too. Extending the hidden knowledge is later work.
  - **Server checks before `done`:**
    - the same top-level keys and types as before;
    - every list at least as long as before, so nothing was removed;
    - size limits.
- **New Edge Function action `publish_content`** (in `game-check`, or a new `game-content` function), for `live.edit` holders. It takes the proposed `data`, builds the full candidate (live concept, files and secret, with the new data), and runs:
  - the static scan;
  - the concept checks;
  - the house-rules review.

  If the candidate passes, it writes the new live version with the service role, in one transaction with a passing `game_checks` row whose fingerprint matches what went live.
- **The creator's draft follows (my call).**
  - If the draft's data equals the previous live data, it gets the new data too, so republishing doesn't drop the additions.
  - If the creator has already changed the draft's content, nothing is overwritten. The draft is marked as behind live: live content was added after the draft's base. **Publishing a draft that is behind is refused** with "A game admin added content to the live game. Take it into your draft first." The Studio then offers **Take in the live content**, which replaces the draft's data with the live data and keeps the creator's code. The creator sees that their own content changes since then are replaced.
  - So added content can't vanish silently on republish.
  - Implementation: live `game_content` gets a `data_revision` counter, bumped by `publish_content`. The draft records the revision it is based on; `publish_game` compares the two.
- **Previewing added content (my call).** The preview plays the proposed content in the sealed-off frame as a test run. Game admins may start test runs (the `game_runs` policy allows `live.edit` holders, not only editors). For a game admin's test run, `game-ai` uses the live AI knowledge, which is unchanged by additions. Test runs never count.
- **The data notes are kept.** The data step stores them in the draft content as `dataNotes`, so later extensions know the shape. For games built before this, the extend step infers the shape from the data itself.

### Screens

- **Admin › Groups** (new, in the admin navigation):
  - a list of groups with member counts;
  - a group's detail: members with remove, add-member search over users (name or email), rename and delete.
- **Game administration:**
  - the game picker as today;
  - tabs **Access · Content · Players & results · AI services**;
  - **Players & results** merges today's Players and Results tabs, and keeps them as two sections.
- **Library:** shows only games the player may play. An empty state names no hidden games.

## Pitch run-through to support

1. As admin, show **Groups**: "Analysts", with the player in it.
2. As game admin, open the game → **Access** → *Selected groups* → Analysts. Players outside it no longer see the game; the player in it still does.
3. **Content** → "Add two harder cases where the supplier's VAT number is valid but the customer's is missing" → preview → **Check and publish** → the player's next game includes the new cases.

## Left to the builder

- Table and column names, migration split, test names.
- Whether `publish_content` lives in `game-check` or a new function.
- Exact layout of the Access and Content tabs, following the existing console style.
- Prompt wording for the extend step.
