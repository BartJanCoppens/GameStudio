import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';
import { DEFAULT_CONTENT, ruleById } from '../src/game/content';
import { fieldName } from '../src/game/fields';
import { emailFor, password, type E2eRole } from './accounts';

const { invoices: INVOICES, errors: ERRORS } = DEFAULT_CONTENT;

async function signIn(page: Page, role: E2eRole) {
  await page.goto('/');
  await page.getByLabel('Email').fill(emailFor(role));
  await page.getByLabel('Password').fill(password());
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('banner').getByRole('button', { name: 'Sign out' })).toBeVisible();
}

test('a player audits all 12 invoices perfectly and lands on the leaderboard', async ({ page }) => {
  await signIn(page, 'player');
  await expect(page.locator('header')).toContainText('Player · Library');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Start · 15:00' }).click();
  await expect(page.getByRole('timer')).toHaveText(/^1[45]:\d\d$/);

  for (const inv of INVOICES) {
    await expect(page.getByText(`invoice ${inv.no} of 12`)).toBeVisible();
    for (const e of ERRORS.filter(x => x.invoice === inv.no)) {
      await page.getByRole('button', { name: fieldName(e.fields[0]), exact: true }).click();
      await page.getByRole('radio', { name: ruleById(e.rule).label }).click();
    }
    await page.getByRole('button', { name: /^Submit · / }).click();
    await expect(page.getByText('Correct', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: inv.no < 12 ? 'Next invoice →' : 'See results →' }).click();
  }

  await expect(page.locator('header')).toContainText('Player · Results');
  await expect(page.getByText('12 of 12 invoices right')).toBeVisible();
  await expect(page.getByText(/7 of 7 errors found · 0 false flags · 70 points/)).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'E2E player' })).toContainText('70');
});

test('a flag on a clean invoice costs 5 points', async ({ page }) => {
  await signIn(page, 'player');
  await page.getByRole('button', { name: /^(Play|Play again)$/ }).click();
  await page.getByRole('button', { name: 'Start · 15:00' }).click();
  // Invoice 1 is clean: flag it anyway.
  await page.getByRole('button', { name: 'Invoice number', exact: true }).click();
  await page.getByRole('radio', { name: 'Unique, sequential invoice number' }).click();
  await page.getByRole('button', { name: 'Submit · 1 flag' }).click();
  await expect(page.getByText('Not quite', { exact: true })).toBeVisible();
  await expect(page.getByText('-5 points')).toBeVisible();
});

test('the game admin sees the finished run in results', async ({ page }) => {
  await signIn(page, 'gameadmin');
  await expect(page.locator('header')).toContainText('Game administration');
  await page.getByRole('tab', { name: /Results/ }).click();
  await expect(page.getByRole('row').filter({ hasText: 'E2E player' }).first()).toContainText('70');
});

test('the creator sees the answer key and its grounding', async ({ page }) => {
  await signIn(page, 'creator');
  await page.getByRole('button', { name: 'Studio' }).click();
  await page.getByRole('navigation', { name: 'Invoices' }).getByRole('button', { name: /^Invoice 10,/ }).click();
  await expect(page.getByText('6% on a new detached shed')).toBeVisible();
  await expect(page.getByText(/§ 7 · Royal Decree No. 20/)).toBeVisible();
});

test('the Studio chat collapses to a rail and the preview widens', async ({ page }) => {
  await signIn(page, 'creator');
  await page.getByRole('button', { name: 'Studio' }).click();
  const chat = page.getByRole('region', { name: 'Draft with AI' });
  await expect(chat).toBeVisible();
  const open = (await page.getByRole('article').boundingBox())!.width;
  await page.getByRole('button', { name: 'Collapse AI chat' }).click();
  await expect(chat).toHaveCount(0);
  const collapsed = (await page.getByRole('article').boundingBox())!.width;
  expect(collapsed).toBeGreaterThan(open + 200);
  await page.getByRole('button', { name: 'Open AI chat' }).click();
  await expect(chat).toBeVisible();
});

test('the Studio AI refuses players', async () => {
  if (existsSync('.env.local')) process.loadEnvFile('.env.local');
  const url = process.env.VITE_SUPABASE_URL!, key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data } = await client.auth.signInWithPassword({ email: emailFor('player'), password: password() });
  const res = await fetch(`${url}/functions/v1/studio-chat`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${data.session!.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Add an invoice' }], draft: DEFAULT_CONTENT }),
  });
  expect(res.status).toBe(403);
});

test('a platform admin invites and deactivates a user', async ({ page }) => {
  await signIn(page, 'admin');
  await page.getByRole('button', { name: 'Users' }).click();
  await page.getByRole('button', { name: '+ Invite user' }).click();
  await page.getByLabel('Full name').fill('E2E invited');
  await page.getByRole('dialog').getByLabel('Email').fill(emailFor('player').replace('player', 'invited'));
  await page.getByRole('button', { name: 'Create user' }).click();
  const row = page.getByRole('row').filter({ has: page.getByText('e2e-invited@deloitte.com', { exact: true }) });
  await expect(row).toContainText('Not signed in yet');
  await row.getByRole('button', { name: 'Edit' }).click();
  await page.getByRole('button', { name: 'Deactivate' }).click();
  await expect(row).toContainText('Deactivated');
});

test('a player cannot reach admin screens by URL', async ({ page }) => {
  await signIn(page, 'player');
  await page.goto('/#/users');
  await page.reload();
  await expect(page.locator('header')).toContainText('Player · Library');
  await expect(page.getByRole('button', { name: 'Users' })).toHaveCount(0);
});

test('a platform admin stores a key without ever seeing it again, and tests it', async ({ page }) => {
  await signIn(page, 'admin');
  await page.getByRole('button', { name: 'AI services' }).click();
  await page.getByRole('button', { name: 'ElevenLabs: Add key…' }).click();
  await page.getByLabel('API key').fill('e2e-not-a-real-key-4321');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/key …4321/)).toBeVisible();
  await expect(page.getByText('e2e-not-a-real-key-4321')).toHaveCount(0);
  await page.getByRole('button', { name: 'Test ElevenLabs' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'ElevenLabs: The key was rejected' })).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'ElevenLabs: Change key…' }).click();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('button', { name: 'ElevenLabs: Add key…' })).toBeVisible();
});

test('a game admin sets AI services for the game only', async ({ page }) => {
  await signIn(page, 'gameadmin');
  await expect(page.getByRole('button', { name: 'AI services' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'AI services' }).click();
  await expect(page.getByText('Studio assistant')).toHaveCount(0);
  await page.getByRole('button', { name: 'HeyGen: Use own key…' }).click();
  await page.getByLabel('API key').fill('e2e-heygen-8765');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/key …8765/)).toBeVisible();
  await page.getByRole('button', { name: 'HeyGen: Change key…' }).click();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByRole('button', { name: 'HeyGen: Use own key…' })).toBeVisible();
});

test('a creator makes a game, gives it a look and publishes it; a player plays it', async ({ page, browser }) => {
  const title = `E2E game ${Date.now()}`;
  await signIn(page, 'creator');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Start from the sample game' }).click();
  await expect(page.locator('header')).toContainText('Creator · Studio');
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await expect(page.getByText('Never published')).toBeVisible();
  await expect(page).toHaveURL(/#\/studio\?game=e2e-game-/);

  await page.getByRole('button', { name: 'Look: TaxConnect' }).click();
  await page.getByRole('button', { name: 'Use the look Harbour Blue' }).click();
  await expect(page.getByRole('button', { name: 'Look: Harbour Blue' })).toBeVisible();

  const player = await browser.newPage();
  await signIn(player, 'player');
  await expect(player.getByText(title)).toHaveCount(0);

  await page.getByRole('button', { name: 'Publish to players' }).click();
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByText('Draft matches live')).toBeVisible();

  await player.reload();
  const card = player.locator('div').filter({ has: player.getByText(title, { exact: true }) }).filter({ has: player.getByRole('button', { name: 'Play', exact: true }) }).last();
  await card.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(player.getByRole('heading', { name: title })).toBeVisible();
  // Harbour Blue's accent is on the start button.
  await expect(player.getByRole('button', { name: /^Start · / })).toHaveCSS('background-color', 'rgb(11, 95, 255)');
  await player.getByRole('button', { name: /^Start · / }).click();
  await expect(player.getByText(`${title} · invoice 1 of 12`)).toBeVisible();
});

// Live AI: about a minute and roughly $0.16 a run, so only with E2E_LIVE_AI=1.
test('a creator builds a game from a description with AI', async ({ page }) => {
  test.skip(!process.env.E2E_LIVE_AI, 'set E2E_LIVE_AI=1 to call the real model');
  test.setTimeout(240_000);
  await signIn(page, 'creator');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByLabel('Title').fill(`E2E AI game ${Date.now()}`);
  await page.getByRole('button', { name: 'Use an example' }).click();
  await page.getByRole('button', { name: '6 invoices · 3 errors' }).click();
  await page.getByRole('button', { name: 'Build with AI' }).click();
  await expect(page.getByRole('status')).toContainText('with AI');
  await expect(page.locator('header')).toContainText('Creator · Studio', { timeout: 180_000 });
  await expect(page.getByText(/Invoice 1 of [3-9] · 3 errors/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Draft with AI' })).toContainText('Build this game from scratch');

  await page.getByRole('button', { name: 'Look: TaxConnect' }).click();
  await page.getByPlaceholder(/Bold and friendly/).fill('Bold and friendly for young graduates: deep purple accent, soft lilac page, rounded corners.');
  await page.getByRole('button', { name: 'Design with AI' }).click();
  await expect(page.getByText('Readability (WCAG AA)')).toBeVisible({ timeout: 90_000 });
  await page.getByRole('button', { name: 'Use this look' }).click();
  await expect(page.getByRole('button', { name: /^Look: (?!TaxConnect)/ })).toBeVisible();
});
