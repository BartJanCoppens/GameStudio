# Pitch demo · From an idea to a published game (about 8 minutes)

The story: a creator describes a game in one sentence. The AI asks a few questions, shows a design and builds the game while everyone watches. The game is checked against the house rules and published, and a player plays it straight away, with the AI playing a part in it.

Proof of concept: games are built by the AI from the creator's answers. When a game links to the source material (*Invoice mandatory mentions.md*, Belgian VAT), its facts and feedback come from it, but nothing has been reviewed by a specialist. Say so if asked.

## The day before

1. In **Admin › Groups**, make sure the group **Analysts** exists with `player@deloitte.com` in it (it survives resets).
2. `npm run demo:reset -- --plan-b --publish`. This removes rehearsal games and AI-made looks, then adds the prepared detective game, published, so players have a game from the start. Read the output: it lists what it removed and added.
   - For an empty start, run `npm run demo:reset -- --plan-b` instead: the prepared game is a draft for creator@ only.
3. Check the AI: `admin@deloitte.com` → **AI services** → Claude → **Test**. Check the Claude Console credit; a full run-through costs about $1–2.
4. Rehearse once on https://game-studio-flame.vercel.app (after the latest deploy), then reset again.
5. AI limits: 120 calls an hour per creator. A run-through uses about 15.

## Set-up on stage

- **Three browser windows** (two side by side, the third behind them):
  - **left:** `creator@deloitte.com`;
  - **right:** `player@deloitte.com`;
  - **behind:** `gameadmin@deloitte.com` on **Game administration** (use a private window or another browser, so the sign-ins don't mix).

  The password is `SEED_PASSWORD` in `.env.seed`.
- Screen 1280 px or wider. Zoom 100–110 %.
- Keep this page open on a third screen.

## 1 · The idea (30 s) · creator

**My games** → **New game**, then paste:

> A detective game where the player interrogates an AI suspect about a VAT fraud case, grounded in the Belgian invoice rules

**Start.**

## 2 · Questions (1–1½ min)

The AI asks up to six questions, one at a time, with clickable answers: what the player does, who plays, solo or common goal, leaderboard, the AI's role, source material, look. Click an answer each time, or type your own.

What to say while it thinks (about 10 s per question):
- "It's interviewing me like a game designer would."
- "Every step follows the house rules the platform admin set."

## 3 · Design (about 1 min)

The concept card and a mock-up of the main screen appear side by side.
- Ask for one change in the chat, e.g. *"Make it film noir: dark, moody, rain on the window."* The concept and the mock-up update.
- Optional: **Change look** → pick a preset, or describe a look and use **Design with AI**.
- **Approve design · build it.**

## 4 · Code (2–3 min)

The three steps run with timers: *Writing the game's content* and *Building the screens* side by side, then *Writing the game logic*. The code streams in the dark panel.

What to say:
- "Every file is scanned before it's accepted: no internet access, no leaving the page, no storage."
- "If a step fails, I retry just that step."

When it's done, **Play test**: talk to the suspect for a moment. Its replies come through the platform, in role, and quote the source.

## 5 · Check and publish (30 s)

1. **Check house rules.** The AI reviews the whole game against the rules: "✓ Passed the house-rules check."
2. **Game admin** → choose **Demo Game Admin** (the person who will look after the game; not *Demo Admin*, the platform admin), then **Publish to players**: "Published · the game admin decides who may play it."

Mention:
- "If I change anything after the check, the database refuses to publish until it's checked again."
- "Nobody can play it yet. Only the game admin I named sees it, and decides who may play."

## 5b · Open it up (30 s) · game admin

Switch to the game admin window → reload → the new game is in the **Game** list (other game admins don't see it). **Access** → *Selected groups and people* → tick **Analysts**. Mention the **Take offline** switch: one click stops the game for everyone.

## 6 · Play (1 min) · player

Reload the player window. The new game is in **Your games** (the player is in Analysts), in its own look. **Play** → **Start**. Interrogate the suspect, accuse someone. The score lands on the leaderboard.

## 7 · Look after the game (1½ min) · game admin

Back in the game admin window, on the same game:
- **Access** (done in 5b): only Analysts, the creator, its game admin and platform admins can play it; anyone else doesn't even see it.
- **Content** → *"Add two harder cases where the supplier's VAT number is valid but the customer's is missing."* → **Generate** (about 20 s) → the preview shows what grew (e.g. *cases · 3 → 5*) and a test play → **Check and publish**. The player's next game includes the new cases.

## 8 · The admin view (30 s, optional) · admin

- **House rules**: the rules every game follows.
- **Overview** → **Export** next to the game: a zip with the code, content and a readme, ready to take further.
- To show the guardrails: as creator, **New game** → *"A shooting game where you kill your colleagues"*. It is declined with a friendly reason.

## If something is slow or fails

- **A question or the design fails:** the chat shows the error with **Try again**.
- **A build step fails:** **Retry** on that step. Earlier steps are kept, and nothing is saved until the whole build works.
- **Everything is slow:** open **My games** → the prepared detective game (Plan B) and continue from step 4 (Play test) or step 5. With `--publish`, Plan B is already published with `gameadmin@` as its game admin and open to Analysts, so the player can play it straight away. Say "here's one I made earlier with the same prompt".
- **The house-rules check fails:** read the reason out. It shows the guardrails working. Ask for a change in the chat, then check again.

## Afterwards

`npm run demo:reset` clears the games made on stage.
