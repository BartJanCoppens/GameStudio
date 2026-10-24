import { expect, test, type Page } from '@playwright/test';
import { emailFor, password, type E2eRole } from './accounts';
import { seedGame, tinyGame } from './games';

async function signIn(page: Page, role: E2eRole) {
  await page.goto('/');
  await page.getByLabel('Email').fill(emailFor(role));
  await page.getByLabel('Password').fill(password());
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('banner').getByRole('button', { name: 'Sign out' })).toBeVisible();
}

/** The tiny quiz under its own title, so tests don't collide in the library. */
function quiz(title: string, js?: (js: string) => string) {
  const game = tinyGame();
  game.concept.title = title;
  if (js) game.files['game.js'] = js(game.files['game.js']);
  return game;
}

function card(page: Page, title: string) {
  return page.locator('div').filter({ has: page.getByText(title, { exact: true }) }).filter({ has: page.getByRole('button', { name: /^Play/ }) }).last();
}

test('a player plays a published game in the sealed-off frame and lands on the leaderboard', async ({ page }) => {
  const title = `Tiny quiz ${Date.now()}`;
  const game = quiz(title);
  await seedGame(title, game, { publish: true });
  await signIn(page, 'player');
  await card(page, title).getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.getByRole('button', { name: 'Start' }).click();
  const frame = page.frameLocator('iframe[title="Game"]');
  for (const q of game.data.questions) {
    await expect(frame.getByRole('heading', { name: q.q })).toBeVisible();
    await frame.getByRole('button', { name: q.options[q.answer], exact: true }).click();
  }
  await expect(page.locator('header')).toContainText('Player · Results');
  await expect(page.getByText('Your score: 100')).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'E2E player' })).toContainText('100');
});

test('a game that navigates away is stopped', async ({ page }) => {
  const title = `Runaway quiz ${Date.now()}`;
  await seedGame(title, quiz(title, js => `${js}\nsetTimeout(() => { location.href = 'about:blank#escaped'; }, 300);`), { publish: true });
  await signIn(page, 'player');
  await card(page, title).getByRole('button', { name: 'Play', exact: true }).click();
  await page.getByRole('button', { name: 'Start' }).click();
  await expect(page.getByRole('alert')).toHaveText('This game tried to leave the platform and was stopped.');
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
