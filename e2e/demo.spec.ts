import { expect, test, type Page } from '@playwright/test';
import { adminClient, emailFor, password, type E2eRole } from './accounts';
import { seedGame, tinyGame } from './games';

async function signIn(page: Page, role: E2eRole) {
  await page.goto('/');
  await page.getByLabel('Email').fill(emailFor(role));
  await page.getByLabel('Password').fill(password());
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('complementary').getByRole('button', { name: 'Sign out' })).toBeVisible();
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

test('a platform admin edits the house rules', async ({ page }) => {
  await signIn(page, 'admin');
  await page.getByRole('button', { name: 'House rules' }).click();
  await expect(page.getByRole('textbox', { name: 'Rule 1' })).toHaveValue('Non-violent');
  await page.getByRole('button', { name: 'Add a rule' }).click();
  const rules = page.getByRole('textbox', { name: /^Rule \d+$/ });
  await rules.last().fill('E2E: no alcohol');
  await page.getByRole('button', { name: 'Save house rules' }).click();
  await expect(page.getByText('House rules saved')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: /^Rule \d+$/ }).last()).toHaveValue('E2E: no alcohol');
  await page.getByRole('button', { name: `Remove rule ${await page.getByRole('textbox', { name: /^Rule \d+$/ }).count()}` }).click();
  await page.getByRole('button', { name: 'Save house rules' }).click();
  await expect(page.getByText('House rules saved')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('textbox', { name: /^Rule \d+$/ }).last()).not.toHaveValue('E2E: no alcohol');
});

test('a game admin sees results and sets AI services for one game', async ({ page }) => {
  const title = `Console quiz ${Date.now()}`;
  await seedGame(title, quiz(title), { publish: true });
  await signIn(page, 'gameadmin');
  await expect(page.locator('header')).toContainText('Game administration');
  await page.getByRole('combobox', { name: 'Game' }).selectOption({ label: title });
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
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

test('a platform admin exports a game’s code', async ({ page }) => {
  const title = `Exportable quiz ${Date.now()}`;
  const key = await seedGame(title, quiz(title), { publish: true });
  await signIn(page, 'admin');
  const row = page.getByRole('row').filter({ hasText: title });
  const download = page.waitForEvent('download');
  await row.getByRole('button', { name: 'Export' }).click();
  expect((await download).suggestedFilename()).toBe(`${key}.zip`);
});

test('profile details and the language sit behind the name in the sidebar', async ({ page }) => {
  await signIn(page, 'creator');
  const header = page.getByRole('banner');
  await expect(header.getByRole('button', { name: 'Sign out' })).toHaveCount(0);
  await expect(header.getByText(emailFor('creator'))).toHaveCount(0);
  await expect(header.getByRole('button', { name: 'EN' })).toHaveCount(0);
  await page.getByRole('complementary').getByRole('button', { name: /E2E creator/ }).click();
  const profile = page.getByRole('dialog', { name: 'Profile details' });
  await expect(profile).toContainText(emailFor('creator'));
  await expect(profile).toContainText('Game creator');
  await profile.getByRole('button', { name: 'NL' }).click();
  await expect(profile.getByRole('button', { name: 'NL' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(profile).toHaveCount(0);
});

test('the menu folds away and the account stays in view in a short window', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 560 });
  await signIn(page, 'creator');
  const menu = page.getByRole('complementary');
  const signOut = menu.getByRole('button', { name: 'Sign out' });
  const box = (await signOut.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(560);
  await menu.getByRole('button', { name: 'Hide menu' }).click();
  await expect(menu.getByRole('button', { name: 'My games' })).toHaveCount(0);
  await expect.poll(async () => (await page.getByRole('main').boundingBox())!.x).toBeLessThan(120);
  await menu.getByRole('button', { name: 'Show menu' }).click();
  await expect(menu.getByRole('button', { name: 'My games' })).toBeVisible();
});

test('a creator archives, restores and deletes a game; players follow', async ({ page, browser }) => {
  const title = `Archivable ${Date.now()}`;
  await seedGame(title, quiz(title), { publish: true });
  await signIn(page, 'creator');
  const row = page.getByRole('row').filter({ hasText: title });
  await row.getByRole('button', { name: 'Archive' }).click();
  await expect(row).toContainText('Archived');

  const player = await browser.newPage();
  await signIn(player, 'player');
  await expect(player.getByText(title, { exact: true })).toHaveCount(0);

  await row.getByRole('button', { name: 'Restore' }).click();
  await expect(row).toContainText('Published');
  await player.reload();
  await expect(player.getByText(title, { exact: true })).toBeVisible();

  await row.getByRole('button', { name: 'Delete' }).click();
  const confirm = page.getByRole('dialog', { name: `Delete “${title}”?` });
  await expect(confirm).toContainText('can’t be undone');
  await confirm.getByRole('button', { name: 'Delete for good' }).click();
  await expect(page.getByRole('row').filter({ hasText: title })).toHaveCount(0);
  await player.reload();
  await expect(player.getByText(title, { exact: true })).toHaveCount(0);
});

test('a platform admin deletes any game from the overview', async ({ page }) => {
  const title = `Admin delete ${Date.now()}`;
  await seedGame(title, quiz(title), { publish: true });
  await signIn(page, 'admin');
  await page.getByRole('row').filter({ hasText: title }).getByRole('button', { name: 'Delete' }).click();
  await page.getByRole('dialog', { name: `Delete “${title}”?` }).getByRole('button', { name: 'Delete for good' }).click();
  await expect(page.getByRole('row').filter({ hasText: title })).toHaveCount(0);
});

test('a platform admin creates a group and manages its members', async ({ page }) => {
  const name = `E2E Analysts ${Date.now()}`;
  await signIn(page, 'admin');
  await page.getByRole('button', { name: 'Groups' }).click();
  await page.getByRole('button', { name: 'New group' }).click();
  await page.getByRole('dialog').getByLabel('Name').fill(name);
  await page.getByRole('dialog').getByRole('button', { name: 'Create group' }).click();
  const detail = page.getByRole('region', { name });
  await detail.getByLabel('Add a member').selectOption({ label: 'E2E player' });
  await expect(detail.getByRole('row').filter({ hasText: 'E2E player' })).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`${name}.*1 member`) })).toBeVisible();
  await detail.getByRole('row').filter({ hasText: 'E2E player' }).getByRole('button', { name: 'Remove' }).click();
  await expect(detail.getByRole('row').filter({ hasText: 'E2E player' })).toHaveCount(0);
  await detail.getByRole('button', { name: 'Delete group' }).click();
  await page.getByRole('dialog', { name: `Delete “${name}”?` }).getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByRole('button', { name: new RegExp(name) })).toHaveCount(0);
});

test('a game admin restricts a game to a group', async ({ page, browser }) => {
  const title = `Restricted quiz ${Date.now()}`;
  const key = await seedGame(title, quiz(title), { publish: true });
  const admin = adminClient();
  const { data: group } = await admin.from('user_groups').insert({ name: `E2E access ${Date.now()}` }).select('id, name').single();
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  await admin.from('group_members').insert({ group_id: group!.id, user_id: users.users.find(u => u.email === emailFor('player'))!.id });

  await signIn(page, 'gameadmin');
  await page.getByRole('combobox', { name: 'Game' }).selectOption({ label: title });
  await page.getByRole('tab', { name: 'Access' }).click();
  await page.getByRole('radio', { name: 'Selected groups and people' }).check();
  await page.getByRole('checkbox', { name: group!.name }).check();
  await expect(page.getByText('1 player can play this game')).toBeVisible();

  const outsider = await browser.newPage();
  await signIn(outsider, 'player2');
  await expect(outsider.getByText(title, { exact: true })).toHaveCount(0);
  await outsider.goto(`/#/play?game=${key}`);
  await expect(outsider.getByText('This game isn’t available.')).toBeVisible();

  const member = await browser.newPage();
  await signIn(member, 'player');
  await expect(member.getByText(title, { exact: true })).toBeVisible();
});

test('a game admin previews and publishes content added with AI', async ({ page }) => {
  const title = `Growing quiz ${Date.now()}`;
  const game = quiz(title);
  await seedGame(title, game, { publish: true });
  const more = { questions: [...game.data.questions, { q: 'Extra one?', options: ['Yes', 'No'], answer: 0, source: 'p-reverse' }, { q: 'Extra two?', options: ['Yes', 'No'], answer: 1, source: 'p-reverse' }] };
  await page.route('**/functions/v1/game-builder', route => route.fulfill({
    status: 200, headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' },
    body: `event: delta\ndata: "{\\"data\\":"\n\nevent: done\ndata: ${JSON.stringify({ data: more, reply: 'Added two questions on reverse charge.' })}\n\n`,
  }));
  await page.route('**/functions/v1/game-content', route => route.fulfill({
    status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ passed: true, reasons: [], version: 2 }),
  }));
  await signIn(page, 'gameadmin');
  await page.getByRole('combobox', { name: 'Game' }).selectOption({ label: title });
  await page.getByRole('tab', { name: 'Content' }).click();
  await expect(page.getByText('questions · 10 items')).toBeVisible();
  await page.getByLabel('What should be added?').fill('Two questions on reverse charge');
  await page.getByRole('button', { name: 'Generate' }).click();
  await expect(page.getByText('Added two questions on reverse charge.')).toBeVisible();
  await expect(page.getByText('questions · 10 → 12')).toBeVisible();
  await expect(page.locator('iframe[title="Game"]')).toBeVisible();
  await page.getByRole('button', { name: 'Check and publish' }).click();
  await expect(page.getByText('Published · players get the new content in their next game')).toBeVisible();
});
