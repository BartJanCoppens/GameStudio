# Turn-taking games · design

Date: 2026-10-25 · Status: for approval (calls marked "my call") · Ships after the pitch of 2026-10-26

## Intent

Today a game made in the Studio is played alone, or alone towards a common goal. Creators should also be able to make **turn-taking games between two colleagues**: one invites the other, they take turns, and the platform keeps the game going between turns, live or over days. This is the first step towards the competitive play the user described ("live together or turn-taking, either individual or in groups").

## Decided with the user

- **Two ways of playing:**
  - **Live:** both players are online; a timer runs on each turn.
  - **Turn by turn:** the next player is notified when it is their turn, and plays when they like.
- **Starting a game:** a player invites a colleague who may also play the game. The colleague accepts or declines. On acceptance the inviter is notified and the game starts.
- **A list of invitations and games with a status**, per player (sketch: `.superpowers/brainstorm/*/content/invites.html`):
  - invitations: *Invited* (waiting for an answer, can be withdrawn), *Invites you* (Accept / Decline), *Declined*, *Expired*;
  - games: *Your turn*, *Their turn*, *Finished* (with the result), *Cancelled*.
- **The creator chooses, during creation** (in the Studio questions):
  - the ways to play: live, turn by turn, or both;
  - how players hear it's their turn: **email**, **phone notification**, or both;
  - what a finished game counts for: only who won, a **leaderboard**, the **game admin's results**, or any combination.
- **The game admin sets the longest a game may go without a move**; after that it is cancelled. A cancelled game counts for nothing.
- Confirmed guesses: the inviter picks live or turn by turn when the game allows both; only colleagues who may play the game can be invited (the search shows no one else); one list for all games, on the player's home screen; two players per game; the platform keeps the game's state between turns, so a player can close the browser and continue later; notifications both in the app and on the phone.

## Goals

1. **Studio.** The questions phase offers *turn-taking between two colleagues* as a play mode and asks the creator the three choices above. The concept carries them; the design card shows them. The AI writes the game against new bridge calls for turns (below), and the house-rules check applies as for every game.
2. **Inviting.** On a turn-taking game's page: *Invite a colleague* (search over the people who may play this game, by name), live or turn by turn when both are allowed, *Send invitation*. An invitation expires after 7 days without an answer (my call).
3. **The list.** On the player's home screen (Library), above "Your games": *Your games with colleagues*, one row per invitation or game with its status, the other player's name, the time of the last move, and the action (Play, Accept, Decline, Withdraw). It updates by itself while open. A notification in the app (a toast and a dot on the list) when an invitation arrives, is accepted, or it becomes your turn.
4. **Playing.**
   - The game runs in the same sealed-off frame as today. The platform holds the game's shared state and whose turn it is; only the player whose turn it is can make a move, and the database enforces it.
   - **Live:** both see each move as it happens. When the timer runs out, the turn passes to the other player (my call). Time per turn is set by the creator (my call; 15 s–10 min).
   - **Turn by turn:** after a move the other player is notified the way the creator chose.
   - The game decides when it is over and who won (or a draw); the platform records it, and it counts the way the creator chose.
5. **Notifications.**
   - **Phone:** a real notification (web push). The player turns it on once ("Notify me on this device"); on iPhones this requires adding Game Studio to the home screen first, and the app explains how. The notification says only "<Name> made a move in <Game> · your turn" (no game content).
   - **Email:** the same sentence and a link to the game, sent to the player's work email.
   - Players can turn either off for themselves (my call).
6. **Game admin.** In the game's console:
   - **Longest time without a move** (default 3 days for turn by turn, 10 minutes for live; my call), after which the game is cancelled automatically.
   - Under *Players & results*, when the creator chose it: the games played, who played whom, and the results.
7. **Leaderboard** (when the creator chose it): wins, draws and losses per player, ranked by wins.

## Non-goals

- More than two players, teams or groups playing together.
- Turn-taking against the AI (the AI opponent of today's games stays as it is).
- Chat between players, spectators, rematches with one click.
- The platform checking that a move is legal or that the reported winner is right: the game's own code decides, as scores are reported by games today (a known proof-of-concept limit). Secrets per player are protected (see below); the rules are not.
- Text messages (SMS) or chat apps as notification channels.

## Anti-goals

- A player moving when it isn't their turn, or anyone outside the two players changing the game, through the screens or the API.
- Inviting, or being matched with, someone who may not play the game (access as set by its game admin; an offline game can't be started or continued).
- A notification or email that reveals game content or the AI role's hidden knowledge.
- A game that stays "Your turn" forever: inactivity always ends in a cancellation.
- Players' full names reaching the game's code (games still get first name and initial only).

## Constraints

- Same stack and security posture: RLS on every new table; privileged writes through Edge Functions or security-definer SQL with explicit checks; secrets (push keys, email key) server-only.
- Access rules stay those of the assigned game admin work: `can_play_game` for both players, offline and archived games refused.
- The bridge stays the game's only way out; new calls validated like the existing ones.
- Sending email needs a sending service account (e.g. Resend) and a verified sender address: **provided by the user** before email can work. Phone notifications need no outside account.

## How it works (my calls; the builder can refine)

- **Concept:** `mode: 'turns'` with `turns: { ways: ('live' | 'async')[], turnSeconds, notify: ('email' | 'push')[], counts: { leaderboard: boolean, results: boolean } }`. `conceptProblems` and the architect's schema learn it.
- **Bridge, for turn-taking games:**
  - `GameStudio.getMatch()` → `{ you: 'a' | 'b', players: { a: { name }, b: { name } }, turn: 'a' | 'b', state, way: 'live' | 'async', turnEndsAt? , over?: { winner: 'a' | 'b' | null } }`;
  - `GameStudio.makeMove(move, state, over?)` → saves the move (small JSON), the new shared state and, optionally, the end of the game;
  - `GameStudio.onMatchChange(callback)` → called when the other player moves or the turn passes.
- **Data:** `matches` (game, live version, players a and b, way, status, turn, state, last move time, turn deadline, result), `match_moves` (append-only log), `push_subscriptions` (per user and device), and per-game `turn_inactivity_limit` on `games`.
- **Writes:** a new Edge Function `game-match` for invite / accept / decline / withdraw / move / pass-expired-turn. It checks access and turn order, writes with the service role, and sends the notifications (push via the standard Web Push protocol with keys kept as function secrets; email via the sending service).
- **Live updates:** Supabase Realtime on the player's own `matches` rows.
- **Expiry and inactivity:** a scheduled database job (pg_cron, every 5 minutes) expires invitations and cancels inactive games. A live turn's timer is checked when the waiting player's screen asks to pass the turn after the deadline.
- **Phone notifications** need a service worker and a web app manifest on the main site (the games' sealed-off frames are unaffected).

### Secrets per player (decided with the user: real secrets)

- Besides the shared state, each player has a **private state** that only their own browser ever receives. The database refuses it to the other player and the platform never sends it to the other frame.
- A game reads `getMatch().mine` (its own private state) and passes `makeMove(move, state, { mine, over })`, writing only its own private part.
- A move that needs the other side's secret is answered by that side (my call): the game shows the opponent's last move to the player whose turn it now is, whose game resolves it with its own private state ("C3: hit") in the shared state as part of its next move. The Studio's prompt for turn-taking games teaches this pattern, with Battleship as the example.
- Limit (my call): secrets belong to a player. A secret held by neither, like a shuffled deck both draw from, isn't supported yet; a game can still deal each player a hand at the start, from the inviting player's side.

### Settled after the builder check (my calls)

- **Version:** a game in progress keeps the version it started with, as solo runs do. Every published version's content is kept (a snapshot per version, written by both publish paths), and a match loads its own version each turn. Republishing or adding content never touches games in progress.
- **Testing in the Studio and the content preview:** one person plays both sides in one frame. The bridge host gives the game a stand-in match kept in memory (whose turn alternates after each move) and never writes to the database. A "Switch to player B" label shows whose side is being played.
- **No AI roles in turn-taking games, for now:** the concept check refuses an AI role together with `mode: 'turns'`. (Who pays for AI use, and whether the AI's conversation is shared, can be decided when this is wanted.)
- **Starting a live game:** after acceptance the game shows *Waiting for <name>* until both players have it open; the first turn's timer starts then. A live invitation expires after 1 hour without an answer; a turn-by-turn invitation after 7 days. A turn passed by the timer doesn't count as activity, so a live game one player has left is cancelled after the game admin's limit.
- **Who moves first:** the invited colleague (my call; the inviter chose the game).
- **Invitations by notification too:** an invitation, an acceptance and a decline go out through the same channels the creator chose for turns, with the same no-content wording ("<Name> invites you to play <Game>").
- **Leaderboard:** for turn-taking games the creator's "counts for a leaderboard" choice replaces the existing leaderboard switch.

## Left to the builder

- Table and column names, migration split, test names.
- Exact layout of the invite dialog, the list and the match screen, following the existing style and the sketch.
- Wording of the Studio questions and the prompts for the new bridge calls.
- How the leaderboard and results present wins, draws and losses.
