# Demo script · Spot the invoice errors (5 minutes)

Proof of concept. Content is written from *Invoice mandatory mentions.md* and has not been reviewed by a VAT specialist; say so if asked.

**Before you start**
- Open the app and sign out. All four accounts share the password in `.env.seed` (`SEED_PASSWORD`).
- Use a screen of 1280 px or wider; the invoice and the feedback panel sit side by side.
- To start from an empty leaderboard, delete the old runs in the Supabase dashboard: Table editor → `game_runs`.

## 1 · Player (2 min) · `player@deloitte.com`

1. The library shows one game. Open it: **Play** → the brief → **Start · 15:00**.
2. Invoice 1 is clean. Submit with no flags: *Correct*.
3. Invoice 3: click the supplier's VAT number, pick *Supplier's name, address and valid VAT number*, submit. The feedback explains the check digits and quotes § 3 of the source.
4. Invoice 5: click the customer's empty VAT line but pick a wrong rule, to show *Right place, wrong rule* with both rules named.
5. Play on, or leave with **← Leave** and come back: the clock keeps running.
6. Finish to show the results: the ring, x of 12 invoices, the badge, the leaderboard, and the seven errors with their passages.

## 2 · Game creator (1 min) · `creator@deloitte.com`

1. **My games** → **Spot the invoice errors** opens the Studio.
2. Click invoice 10: in the *Answer key*, the 6% rate is highlighted. The grounding panel quotes § 7 (no reduced rate for a new detached outbuilding).
3. Switch to **As the player sees it**, then show **Workflow & allocation** (v4 moving Dev → Test → Review → Published).
4. **Draft with AI** (needs a model set up under Admin › AI services): ask for a change, watch the preview update, then **Keep** or **Discard**. Collapse the chat (**«**) to give the preview room; earlier chats are listed at the top of the panel.

## 3 · Game administrator (1 min) · `gameadmin@deloitte.com`

1. **Invoices**: all 12 with their planted errors and source passages.
2. **Results**: the run you just played, how often each error is found, and the leaderboard.

## 4 · Platform admin (1 min) · `admin@deloitte.com`

1. **Overview**: users, players, runs and the latest run.
2. **Users** → **+ Invite user**: create someone; no email goes out. **Edit** → **Deactivate**: they can no longer sign in.
3. **Roles & permissions**: click a cell to grant or remove a permission. The two admin cells that stay locked keep the platform from losing its admins.
4. **AI services**: the model, avatar and voice providers. Add a key (it's never shown again, only its last four characters), test it, and choose the Studio assistant's model. A game admin can give the game its own keys under **Game administration › AI services**.

**If someone asks "can a user manager make themselves admin?"** No. The database only lets you hand out, or act on, permissions you hold yourself.
