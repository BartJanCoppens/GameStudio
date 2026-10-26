import { expect, test, type Page } from '@playwright/test';
import { adminClient, emailFor, password, type E2eRole } from './accounts';
import { idOf, matchAs, seedTurnGame } from './games';

async function finishedMatch(title: string) {
  const key = await seedTurnGame(title);
  const invite = await matchAs('player', { action: 'invite', game_key: key, invitee: await idOf('player2'), way: 'async' });
  const id = invite.body.match_id as string;
  await matchAs('player2', { action: 'accept', match_id: id });
  await matchAs('player2', { action: 'move', match_id: id, move_no: 0, move: {}, state: { a: 0, b: 1 } });
  await matchAs('player', { action: 'move', match_id: id, move_no: 1, move: {}, state: { a: 3, b: 1 }, over: { winner: 'a' } });
  return key;
}

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
  // The preview frame is replaced by the test run's frame: play only once that has happened.
  await expect(page.getByRole('button', { name: 'Restart test' })).toBeVisible();
  await expect(page.getByText('Testing both sides · playing as B')).toBeVisible();
  await scorePoint(page);
  await expect(page.getByText('Testing both sides · playing as A')).toBeVisible();
});

test('a game admin sets the longest time without a move', async ({ page }) => {
  const title = `Limits duel ${Date.now()}`;
  await seedTurnGame(title);
  await signIn(page, 'gameadmin');
  await page.getByRole('combobox', { name: 'Game' }).selectOption({ label: title });
  await page.getByRole('tab', { name: /Players & results/ }).click();
  await page.getByLabel('Turn by turn, in days').fill('2');
  await page.getByLabel('Live, in minutes').fill('5');
  await page.getByRole('button', { name: 'Save limits' }).click();
  await expect(page.getByText('Limits saved')).toBeVisible();
  await page.reload();
  await page.getByRole('combobox', { name: 'Game' }).selectOption({ label: title });
  await page.getByRole('tab', { name: /Players & results/ }).click();
  await expect(page.getByLabel('Turn by turn, in days')).toHaveValue('2');
  await expect(page.getByLabel('Live, in minutes')).toHaveValue('5');
});

test('a game admin sees who played whom', async ({ page }) => {
  const title = `Results duel ${Date.now()}`;
  await finishedMatch(title);
  await signIn(page, 'gameadmin');
  await page.getByRole('combobox', { name: 'Game' }).selectOption({ label: title });
  await page.getByRole('tab', { name: /Players & results/ }).click();
  await expect(page.getByText('E2E player – E2E player2 · E2E player won')).toBeVisible();
});

test('the players’ leaderboard counts wins, draws and losses', async ({ page }) => {
  const title = `Ranked duel ${Date.now()}`;
  const key = await finishedMatch(title);
  await signIn(page, 'player2');
  await page.goto(`/#/results?game=${key}`);
  const winner = page.getByRole('row').filter({ hasText: 'E2E player' }).filter({ hasNotText: 'player2' });
  await expect(winner).toContainText('1 won · 0 drawn · 0 lost');
  await expect(page.getByRole('row').filter({ hasText: 'E2E player2' })).toContainText('0 won · 0 drawn · 1 lost');
});

async function liveMatch(title: string) {
  const key = await seedTurnGame(title);
  const invite = await matchAs('player', { action: 'invite', game_key: key, invitee: await idOf('player2'), way: 'live' });
  const id = invite.body.match_id as string;
  await matchAs('player2', { action: 'accept', match_id: id });
  await Promise.all([matchAs('player', { action: 'ready', match_id: id }), matchAs('player2', { action: 'ready', match_id: id })]);
  return { key, id };
}

test('two players opening a live game at once both start it', async () => {
  const { id } = await liveMatch(`Both ready ${Date.now()}`);
  const view = await matchAs('player', { action: 'get', match_id: id });
  expect((view.body.match as { status: string }).status).toBe('active');
});

test('a pass the server refuses is tried again', async ({ page }) => {
  const title = `Retry pass ${Date.now()}`;
  const { id } = await liveMatch(title);
  // It is b's (player2's) turn; player waits. The turn's time is up on the server.
  await adminClient().from('matches').update({ turn_ends_at: new Date(Date.now() - 1000).toISOString() }).eq('id', id);
  let refused = 0;
  await page.route('**/functions/v1/game-match', async route => {
    const body = route.request().postDataJSON() as { action: string };
    if (body.action === 'pass' && refused === 0) {
      refused += 1;
      return route.fulfill({ status: 409, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ error: 'The turn’s time isn’t up yet' }) });
    }
    return route.continue();
  });
  await signIn(page, 'player');
  await row(page, title).getByRole('button', { name: 'Play' }).click();
  await expect(frameOf(page).getByText('Your turn')).toBeVisible({ timeout: 15_000 });
  expect(refused).toBe(1);
});

test('a game isn’t told about changes that didn’t happen', async ({ page }) => {
  test.setTimeout(60_000);
  const title = `Quiet duel ${Date.now()}`;
  const key = await seedTurnGame(title);
  const invite = await matchAs('player', { action: 'invite', game_key: key, invitee: await idOf('player2'), way: 'async' });
  await matchAs('player2', { action: 'accept', match_id: invite.body.match_id });
  await signIn(page, 'player2');
  await row(page, title).getByRole('button', { name: 'Play' }).click();
  await expect(frameOf(page).getByText('Your turn')).toBeVisible();
  // Two polls go by without a move.
  await page.waitForTimeout(21_000);
  await expect(frameOf(page).getByText('Changes: 0')).toBeVisible();
});

test('an invited player accepts on the game’s own page and starts playing', async ({ page }) => {
  const title = `Accept here ${Date.now()}`;
  const key = await seedTurnGame(title);
  await matchAs('player2', { action: 'invite', game_key: key, invitee: await idOf('player'), way: 'async' });
  await signIn(page, 'player');
  await page.goto(`/#/play?game=${key}`);
  await expect(page.getByText('Turn-taking', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Solo', { exact: true })).toHaveCount(0);
  const invitation = page.getByRole('region', { name: 'Your games with colleagues in this game' });
  await expect(invitation).toContainText('E2E player2 invites you');
  await invitation.getByRole('button', { name: 'Accept' }).click();
  // Accepting opens the game; the invited player moves first.
  await expect(page.locator('header')).toContainText('Game with a colleague');
  await expect(frameOf(page).getByText('Your turn')).toBeVisible();
});

test('the inviter sees the invitation on the game’s page and can withdraw it', async ({ page }) => {
  const title = `Withdraw here ${Date.now()}`;
  const key = await seedTurnGame(title);
  await matchAs('player', { action: 'invite', game_key: key, invitee: await idOf('player2'), way: 'async' });
  await signIn(page, 'player');
  await page.goto(`/#/play?game=${key}`);
  const mine = page.getByRole('region', { name: 'Your games with colleagues in this game' });
  await expect(mine).toContainText('Waiting for E2E player2 to answer');
  await mine.getByRole('button', { name: 'Withdraw' }).click();
  await expect(mine).toHaveCount(0);
});

