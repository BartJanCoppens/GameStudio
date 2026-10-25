import { expect, test, type Page } from '@playwright/test';
import { adminClient, emailFor, password, type E2eRole } from './accounts';
import { idOf, matchAs, seedTurnGame } from './games';

async function signIn(page: Page, role: E2eRole) {
  await page.goto('/');
  await page.getByLabel('Email').fill(emailFor(role));
  await page.getByLabel('Password').fill(password());
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('complementary').getByRole('button', { name: 'Sign out' })).toBeVisible();
}

const row = (page: Page, title: string) => page.getByRole('row').filter({ hasText: title });
const frameOf = (page: Page) => page.frameLocator('iframe[title="Game"]');

async function scorePoint(page: Page) {
  const frame = frameOf(page);
  await expect(frame.getByText('Your turn')).toBeVisible();
  await frame.getByRole('button', { name: 'Score a point' }).click();
}

test('two colleagues play a turn-by-turn game', async ({ page, browser }) => {
  test.setTimeout(150_000);
  const title = `Duel ${Date.now()}`;
  await seedTurnGame(title);
  await signIn(page, 'player');
  await page.locator('div').filter({ has: page.getByText(title, { exact: true }) }).getByRole('button', { name: /^Play/ }).last().click();
  await page.getByRole('button', { name: 'Invite a colleague' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Find a colleague').fill('player2');
  await dialog.getByRole('radio', { name: 'E2E player2' }).check();
  await dialog.getByRole('radio', { name: 'Turn by turn' }).check();
  await dialog.getByRole('button', { name: 'Send invitation' }).click();
  await expect(row(page, title)).toContainText('Invited · waiting for an answer');

  const other = await browser.newPage();
  await signIn(other, 'player2');
  await expect(row(other, title)).toContainText('Invites you');
  await row(other, title).getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByText(`E2E player2 accepted your invitation · ${title} has started`)).toBeVisible();

  await row(other, title).getByRole('button', { name: 'Play' }).click();
  await scorePoint(other);
  await expect(row(page, title)).toContainText('Your turn');
  await row(page, title).getByRole('button', { name: 'Play' }).click();
  await scorePoint(page);
  await scorePoint(other);
  await scorePoint(page);
  await scorePoint(other);
  await expect(frameOf(other).getByText('You won')).toBeVisible();
  await expect(frameOf(page).getByText('You lost')).toBeVisible();
  await page.goto('/#/library');
  await expect(row(page, title)).toContainText('Finished · you lost');
});

test('a live game waits for both players', async ({ page, browser }) => {
  const title = `Live duel ${Date.now()}`;
  const key = await seedTurnGame(title);
  const invite = await matchAs('player', { action: 'invite', game_key: key, invitee: await idOf('player2'), way: 'live' });
  await matchAs('player2', { action: 'accept', match_id: invite.body.match_id });
  await signIn(page, 'player2');
  await row(page, title).getByRole('button', { name: 'Play' }).click();
  await expect(page.getByText('Waiting for E2E player')).toBeVisible();
  const other = await browser.newPage();
  await signIn(other, 'player');
  await row(other, title).getByRole('button', { name: 'Play' }).click();
  await expect(page.getByText(/s left/)).toBeVisible();
  await scorePoint(page);
  await expect(frameOf(other).getByText('Your turn')).toBeVisible();
});

test('a match keeps its version after a republish', async ({ page }) => {
  const title = `Versioned duel ${Date.now()}`;
  const key = await seedTurnGame(title);
  const invite = await matchAs('player', { action: 'invite', game_key: key, invitee: await idOf('player2'), way: 'async' });
  await matchAs('player2', { action: 'accept', match_id: invite.body.match_id });
  const { error } = await adminClient().rpc('publish_live_content', { p_game_key: key, p_data: { target: 3, marker: 'version two' }, p_fingerprint: 'e2e', p_checked_by: await idOf('gameadmin') });
  expect(error).toBeNull();
  await signIn(page, 'player2');
  await row(page, title).getByRole('button', { name: 'Play' }).click();
  await expect(frameOf(page).getByText('version one')).toBeVisible();
});

test('the Studio test plays both sides', async ({ page }) => {
  const title = `Studio duel ${Date.now()}`;
  const key = await seedTurnGame(title);
  await signIn(page, 'creator');
  await page.goto(`/#/studio?game=${key}`);
  await page.getByRole('button', { name: 'Play test' }).click();
  await expect(page.getByText('Testing both sides · playing as B')).toBeVisible();
  await scorePoint(page);
  await expect(page.getByText('Testing both sides · playing as A')).toBeVisible();
});
