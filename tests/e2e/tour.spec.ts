import { expect, test, type Page } from '@playwright/test';
import { TABS, TOURS, type Tab } from '../../src/lib/tour';

// The guided tour in the example (AP-34, board 53). Other tests start with it skipped (playwright.config.ts).
test.use({ storageState: { cookies: [], origins: [] } });

async function openExample(page: Page) {
  await page.goto('./');
  await page.getByRole('button', { name: 'Open the example' }).click();
  await page.getByText('How Photosynthesis Works').click();
}

const card = (page: Page) => page.getByRole('dialog', { name: 'Tour' });

// Every step's part is on the page and on screen: a feature that moved or went away fails here, so the tour is
// updated with it.
test('every tab plays its tour by itself once, each step on screen, then hands over', async ({ page }) => {
  await openExample(page);
  for (const tab of Object.keys(TOURS) as Tab[]) {
    if (tab !== 'write') await page.getByRole('button', { name: new RegExp(`^${TABS[tab]}`) }).first().click();
    const steps = TOURS[tab];
    for (const [i, step] of steps.entries()) {
      await expect(card(page)).toContainText(`${TABS[tab]} · ${i + 1} of ${steps.length}`);
      await expect(card(page).getByRole('heading', { name: step.title })).toBeVisible();
      const part = page.locator(`[data-tour="${step.target}"]`).first();
      await expect(part).toHaveClass(/tour-on/);
      await expect(part).toBeInViewport();
      await card(page).getByRole('button', { name: 'Next' }).click();
    }
    await expect(card(page).getByRole('heading', { name: 'Your turn' })).toBeVisible();
    await card(page).getByRole('button', { name: 'Start playing' }).click();
    await expect(card(page)).toHaveCount(0);
  }
  // Seen: going back to a tab doesn't play it again, nor does a reload.
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await page.reload();
  await expect(page.getByText('Every leaf you have ever seen is running a tiny factory.')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(card(page)).toHaveCount(0);
});

test('Skip tour stops the tours on every tab, and Take the tour plays one again', async ({ page }) => {
  await openExample(page);
  await expect(card(page)).toBeVisible();
  // While a step shows, the page behind can't be clicked.
  await page.getByRole('button', { name: /^Review/ }).first().click({ force: true });
  await expect(card(page)).toContainText('Write · 1 of');
  await page.keyboard.press('ArrowRight');
  await expect(card(page)).toContainText('Write · 2 of');
  await page.keyboard.press('ArrowLeft');
  await expect(card(page)).toContainText('Write · 1 of');
  await card(page).getByRole('button', { name: 'Skip tour' }).click();
  await expect(card(page)).toHaveCount(0);
  for (const tab of ['Review', 'History', 'Assets']) {
    await page.getByRole('button', { name: new RegExp(`^${tab}`) }).first().click();
    await page.waitForTimeout(500);
    await expect(card(page)).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Take the tour' }).click();
  await expect(card(page)).toContainText('Assets · 1 of');
  await page.keyboard.press('Escape');
  await expect(card(page)).toHaveCount(0);
});

test('the tour only shows in the example', async ({ page }) => {
  await openExample(page);
  await expect(card(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Open your scripts folder' }).click();
  await expect(page.getByRole('button', { name: 'Take the tour' })).toHaveCount(0);
});
