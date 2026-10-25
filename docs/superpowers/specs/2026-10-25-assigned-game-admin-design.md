# Assigned game admin · design

Date: 2026-10-25 · Status: for approval (calls marked "my call")

## Intent

Today every game admin looks after every game, and a newly published game is open to every player. The creator should instead hand the game to **one named game admin** when publishing. That person alone looks after it: they decide who may play, they can take it away again, and they can take the whole game offline. Until they open it up, nobody plays it.

## Decided with the user

- **At publish, the creator picks the game admin.** Publishing is not possible without one.
- **Only that game admin sees the game** in their list of games. Other game admins don't.
- **A newly published game is closed:** no player sees it until the game admin grants access.
- **The game admin grants and revokes access** to groups and to individual players, in the game's Access tab in the game admin console (what the user called "user management").
- **The game admin can take the whole game offline** and bring it back. Offline, nobody can play it, whatever their access; back online, the access is as it was.
- **One game admin per game.**
- **The platform admin** still sees every game, can change a game's game admin, and steps in when that person leaves.
- **The creator** still sees their own game in the Studio, improves it and republishes. Republishing keeps the game admin and the access.
- **"Everyone"** stays a choice for the game admin; it is no longer the default.
- **Groups** are still created by the platform admin only; game admins pick from them.
- **Adding content with AI, and the game's players and results,** are also only for the assigned game admin.
- **Games published before this change** get the platform admin as game admin and keep their current access, so nothing goes dark.

## Goals

1. **Publish asks for the game admin.** On the first publish, the creator chooses from the people who hold the game admin role (*Add content to a live game*, `live.edit`), by name. The chosen name shows next to Publish afterwards; later publishes don't ask again.
2. **Assignment enforced by the database,** not just the screens:
   - game admin console: the game picker lists only games assigned to the signed-in game admin (platform admins: all games);
   - access changes, content additions, offline/online, results and AI services for a game: the assigned game admin or a platform admin only;
   - test runs and the in-game AI test path for game admins: the assigned one only.
3. **Closed by default.** A game's first publish sets its access to *Selected groups and people* with nobody selected. Players see nothing until the game admin adds a group or a person, or picks *Everyone*.
4. **Offline.** A switch in the game admin console, with a confirmation. Offline:
   - the game disappears from players' libraries and can't be opened by link;
   - no new runs, and the in-game AI refuses;
   - runs in progress can't finish (my call: offline means stopped);
   - leaderboards and past results stay visible to the game admin; players don't see the game, so they don't see its leaderboard either (my call).
   The creator's Studio shows "Offline (taken offline by the game admin)" and can still edit and republish; republishing does not bring it back online (my call).
5. **Platform admin reassigns.** In the game admin console (platform admins see all games), a "Game admin" field per game with a change control. The new game admin sees the game immediately; the old one no longer does.

## Before the pitch (decided: ships before 2026-10-26)

- **Production order:** migration first (existing games get their game admin), then the Edge Functions, then the web app, then `demo:reset`.
- **On stage (my call):** the creator picks `gameadmin@` at publish. The runbook's Access step moves between publish and play: the game admin signs in, opens the new game to Analysts, and only then does the player reload and find it. `docs/pitch-demo.md` gets the new order and the extra sign-in.
- **`demo:reset --plan-b --publish` (my call):** publishes Plan B through the same rules as a real publish, with `gameadmin@` as its game admin and access open to Analysts, so the player can play it straight away after a reset.
- **Tests:** `e2e/demo.spec.ts` and the publish tests follow the new flow; the full suites run before release, as before.

## Non-goals

- Several game admins per game, or deputies.
- Notifying the game admin (or players) by email or in the app when a game is assigned or opened up.
- The creator choosing who may play.
- Scheduling: opening and closing dates.
- Changing archive (the creator's and platform admin's "put away" of a game) beyond what is needed below.

## Anti-goals

- A game that a non-assigned game admin can still manage through the API.
- A freshly published game that any player can see before the game admin chose who may play.
- An existing game that goes dark for its players because of this change.
- An offline game that can still be played by link, through the API, or through its AI.
- A creator who can publish without a game admin, or pick someone who isn't a game admin.

## Constraints

- Same stack and security posture as before: RLS on every table; privileged writes through Edge Functions or security-definer SQL with explicit checks.
- **Who counts as "platform admin" here:** holders of *Manage users and invitations* (`users.manage`). Holding `live.edit` alone no longer gives access to every game. (The platform admin role holds both.)
- `private.can_play_game` today lets every `live.edit` holder past a restriction; that becomes "the assigned game admin" only.
- The pitch flow in `docs/pitch-demo.md` must keep working; update it for the new publish step.

## How it works (my calls; the builder can refine)

- **`games.game_admin`** (uuid, references profiles, nullable until first publish) and **`games.offline_at`** (timestamptz, null = online).
- **`private.is_game_admin(key)`**: the caller is the game's `game_admin` and still holds `live.edit`, or the caller holds `users.manage`.
  Replaces the `live.edit` checks in `can_manage_access`, `can_play_game`, the runs policy, `game-content`, `game-builder` (extend), `game-ai` (test runs), results and AI services.
- **`private.can_play_game(key)`**: not offline, and (as today) access everyone / listed person / listed group; or `can_edit_game`; or `is_game_admin`. Offline blocks players only; creator, assigned game admin and platform admin can still test.
- **Publishing:** `publish_game` takes the game admin on first publish (refused if missing or not a `live.edit` holder, "Choose a game admin who can look after games"); on first publish it also sets `access = 'restricted'`. A new RPC lists the people who may be chosen (id, name), like `players_for_access`.
- **Offline/online and reassignment:** security-definer RPCs (`set_game_offline(key, bool)` for `is_game_admin`; `set_game_admin(key, user)` for `users.manage`).
- **Migration of existing games:** live games get `game_admin` = the oldest active `users.manage` holder; their access is left as it is.
- **Creators no longer change who may play (my call).** `can_manage_access` drops its "can edit the game" branch: only the assigned game admin or a platform admin writes `games.access` and `game_access`. Otherwise a creator could open a fresh game to everyone through the API and undo closed-by-default. `publish_game` sets the closed state itself.
- **"Nobody else can see it" includes the game's row (my call).** The `games` select policy narrows from everyone to: those who may play it (`can_play_game`), its creator and platform admins (`can_edit_game`), and its game admin (`is_game_admin`). Drafts that were never published stay visible to their creator and platform admins only. The library, My games, the Overview and the console picker then show only what the database returns.

## Left to the builder

- Exact names, migration split, test names.
- Layout of the game admin picker in the publish step and of the offline switch, following the existing console style.
- Whether reassignment lives in the console's header or its own small dialog.
