# Pitch demo · A creator builds a game from scratch (about 6 minutes)

The story: a creator describes a game in one sentence, the AI builds it, the creator refines it, gives it a look and publishes it, and a player plays it straight away.

Proof of concept: every game is an invoice audit game grounded in *Invoice mandatory mentions.md* (Belgian VAT). The AI writes new invoices and plants new errors, but the rules, scoring and source document are fixed, and the content isn't reviewed by a VAT specialist. Say so if asked.

## The day before

1. `npm run demo:reset -- --plan-b` removes rehearsal games and AI-made looks. It also adds the draft **Business travel expenses** for `creator@deloitte.com` as a fallback (see *If the AI is slow*).
2. Check the AI is ready: sign in as `admin@deloitte.com` → **AI services** → Claude → **Test**. Check the credit balance in the Claude Console: a full run-through costs about $0.30–0.40 (the build alone measured $0.16).
3. Rehearse once on https://game-studio-flame.vercel.app. Then run the reset again.
4. AI limits: 30 calls an hour and 150 a day per creator. A run-through uses 3–5.

## Set-up on stage

- Two browser windows side by side, or two profiles, so both sessions stay signed in:
  - **left**: `creator@deloitte.com`
  - **right**: `player@deloitte.com`
- The password for all four accounts is `SEED_PASSWORD` in `.env.seed`.
- Use a screen of 1280 px or wider. Zoom to 110 % if the room is large.
- Keep this page open on a third screen with the prompts below ready to paste.

## 1 · Build it (2 min) · creator

1. **My games** → **New game**.
2. Title: `Hotel and travel invoices`
3. Describe the game (or click **Use an example**):
   > Expense invoices from hotels, airlines, taxis and restaurants that consultants bring back from business trips in Belgium.
4. Length: **8 invoices · 4 errors** → **Build with AI**.
5. While it builds (about a minute), say what is happening:
   - the AI writes each invoice and plants each error against a rule;
   - every error must quote a passage of the source document;
   - the app checks every invoice and error before saving: valid Belgian VAT numbers, real rates, totals that add up.
6. The Studio opens on the new game.
   - The chat on the left shows what was asked and what the AI did.
   - Click an invoice with a dot: the *Answer key* highlights the error, and the right panel quotes the passage it breaks.

## 2 · Refine it (1 min) · creator

Type into **Draft with AI**, for example:
> Make invoice 2 a restaurant bill where the VAT rate on food is wrong.

The changed invoice is highlighted in the preview. **Keep**, and it's in the draft.

To show the AI's limits, ask something off-topic:
> Write me a poem about Brussels.

It declines, because it only edits this game.

## 3 · Give it a look (1 min) · creator

1. **Look: TaxConnect** → pick a preset (**Harbour Blue**, **Midnight Audit**, **Ledger Serif**). The invoice preview restyles straight away.
2. Or describe a look:
   > Bold and friendly for young graduates: deep purple accent, soft lilac page, rounded corners.

   → **Design with AI**, which takes 10–20 seconds. The readability checks (WCAG AA contrast) show next to the preview, and an unreadable design can't be used. → **Use this look**.

## 4 · Publish it (15 s) · creator

**Publish to players** → **Publish**. The status changes to *Draft matches live*.

## 5 · Play it (1 min) · player

1. Reload the player window: the new game is in **Your games**, in its own look.
2. **Play** → **Start**.
3. Flag something on an invoice, pick a rule and **Submit**. The feedback quotes the source passage.
4. One or two invoices are enough. **← Leave** goes back to the library, and the clock keeps running.

## If the AI is slow or fails

- **The build takes over two minutes or fails:** the game is still created, from the sample invoices, and the chat panel says the AI step failed. Carry on with that game: it publishes and plays the same way.
- **Or use the prepared draft:** **My games** → **Business travel expenses** (generated earlier from the same description). Present it as "one I made earlier", then continue from step 2.
- **A look fails to design:** pick a preset instead.

## Afterwards

`npm run demo:reset` clears the games made on stage.
