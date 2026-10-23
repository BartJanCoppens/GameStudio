import { expect, test, type Page } from '@playwright/test';
import { ERRORS, INVOICES, ruleById } from '../src/game/content';
import { fieldName } from '../src/game/fields';
import { emailFor, password, type E2eRole } from './accounts';

async function signIn(page: Page, role: E2eRole) {
  await page.goto('/');
  await page.getByLabel('Email').fill(emailFor(role));
  await page.getByLabel('Password').fill(password());
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible();
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
  await expect(page.getByRole('row').filter({ hasText: 'E2E player' }).first()).toContainText('12 of 12');
});

test('the creator sees the answer key and its grounding', async ({ page }) => {
  await signIn(page, 'creator');
  await page.getByRole('button', { name: 'Studio' }).click();
  await page.getByRole('navigation', { name: 'Invoices' }).getByRole('button').nth(9).click();
  await expect(page.getByText('6% on a new detached shed')).toBeVisible();
  await expect(page.getByText(/§ 7 · Royal Decree No. 20/)).toBeVisible();
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
