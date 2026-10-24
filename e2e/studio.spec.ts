import { expect, test, type Page } from '@playwright/test';
import { emailFor, password, type E2eRole } from './accounts';

// The creator's flow with the real AI: about a minute and some cents per test, so only with E2E_LIVE_AI=1.
test.skip(!process.env.E2E_LIVE_AI, 'set E2E_LIVE_AI=1 to call the real model');

async function signIn(page: Page, role: E2eRole) {
  await page.goto('/');
  await page.getByLabel('Email').fill(emailFor(role));
  await page.getByLabel('Password').fill(password());
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('complementary').getByRole('button', { name: 'Sign out' })).toBeVisible();
}

export async function newGame(page: Page, idea: string) {
  await signIn(page, 'creator');
  await page.getByRole('button', { name: 'New game' }).click();
  await page.getByLabel('Describe your game').fill(idea);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('header')).toContainText('Creator · Studio');
}

/** Answers each question with its first choice until the concept appears. */
export async function answerUntilConcept(page: Page) {
  const concept = page.getByRole('region', { name: 'Concept' });
  const question = page.getByRole('group', { name: 'Question' });
  for (let i = 0; i < 12; i++) {
    await expect(question.or(concept)).toBeVisible({ timeout: 150_000 });
    if (await concept.isVisible()) return;
    const asked = await question.locator('div').first().textContent();
    await question.getByRole('button').first().click();
    const submit = question.getByRole('button', { name: 'Send answer' });
    if (await submit.isVisible()) await submit.click();
    // The next question (or the concept) replaces this one.
    await expect(async () => {
      if (await concept.isVisible()) return;
      expect(await question.locator('div').first().textContent({ timeout: 1000 }).catch(() => null)).not.toBe(asked);
    }).toPass({ timeout: 150_000 });
  }
  await expect(concept).toBeVisible({ timeout: 150_000 });
}

test('a creator gets questions, then a concept and a mock-up', async ({ page }) => {
  test.setTimeout(400_000);
  await newGame(page, 'A detective game where the player interrogates an AI suspect about VAT fraud');
  await expect(page.getByRole('group', { name: 'Question' }).first()).toBeVisible({ timeout: 60_000 });
  await answerUntilConcept(page);
  await expect(page.getByRole('region', { name: 'Concept' }).getByRole('heading')).not.toHaveText('');
  await expect(page.locator('iframe[title="Mock-up"]')).toBeVisible();
});

test('the architect declines a violent game', async ({ page }) => {
  test.setTimeout(120_000);
  await newGame(page, 'A shooting game where you kill your colleagues');
  await expect(page.getByRole('status', { name: 'Declined' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole('region', { name: 'Concept' })).toHaveCount(0);
});
