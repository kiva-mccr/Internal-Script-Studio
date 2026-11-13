import { expect, test, type Page } from '@playwright/test';
import { readFile, setUp } from './folder';

// Find and replace in a script (AP-32, board 44).
const SCRIPT = 'Episode 03/script.md';
const text = `---
title: How Plants Eat
status: draft
authors: [Sam]
---

# Glucose basics

## 1 <!-- id: aaaa1 -->
Dialogue:
Every leaf takes in light and makes glucose.

On screen:
The word GLUCOSE fades in.

Files:
- glucose-flow.mp4
- Find a glucose diagram

## 2 <!-- id: bbbb2 -->
Dialogue:
**Glucose** is the plant's food.

On screen:
Animation: glucose flowing down the stem.
`;

async function open(page: Page) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: text });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

// The text under each highlight, the one you're on last.
const marks = (page: Page) => page.evaluate(() => [
  ...[...(CSS.highlights.get('find') ?? [])].map((r) => (r as Range).toString()),
  `on:${[...(CSS.highlights.get('find-on') ?? [])].map((r) => (r as Range).toString()).join()}`,
]);

test('Ctrl+F finds in every column but file names, steps through, and Esc closes', async ({ page }) => {
  await open(page);
  await page.getByLabel('Dialogue, row 1').click();
  await page.keyboard.press('Control+f');
  const find = page.getByLabel('Find', { exact: true });
  await expect(find).toBeFocused();
  await find.fill('glucose');
  const count = page.getByRole('search').getByRole('status');
  // The section title, both text columns, the "to find" note; never glucose-flow.mp4.
  await expect(count).toHaveText('1 of 6');
  await expect(page.getByLabel('Section title')).toHaveClass(/found-on/);
  await expect.poll(() => marks(page)).toEqual(['glucose', 'GLUCOSE', 'glucose', 'Glucose', 'glucose', 'on:']);
  await find.press('Enter');
  await expect(count).toHaveText('2 of 6');
  await expect.poll(() => marks(page)).toEqual(['GLUCOSE', 'glucose', 'Glucose', 'glucose', 'on:glucose']);
  await find.press('Shift+Enter');
  await find.press('Shift+Enter');
  await expect(count).toHaveText('6 of 6');
  // Match case and Whole words.
  await page.getByRole('button', { name: 'Match case' }).click();
  await expect(count).toHaveText('1 of 3');
  await page.getByRole('button', { name: 'Match case' }).click();
  await find.fill('gluco');
  await page.getByRole('button', { name: 'Whole words' }).click();
  await expect(count).toHaveText('No matches');
  // Ctrl+F from the script comes back to the bar; Esc closes it and the marks go.
  await page.getByLabel('Dialogue, row 2').click();
  await page.keyboard.press('Control+f');
  await expect(find).toBeFocused();
  await find.press('Escape');
  await expect(page.getByRole('search')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => CSS.highlights.has('find'))).toBe(false);
});

test('Replace changes one and moves on, keeping capitals and bold; Replace all has Undo', async ({ page }) => {
  await open(page);
  // From ⋯ in the top bar too.
  await page.getByRole('button', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Find and replace' }).click();
  await page.getByLabel('Find', { exact: true }).fill('glucose');
  await page.getByLabel('Replace with').fill('sugar');
  const count = page.getByRole('search').getByRole('status');
  await page.getByRole('button', { name: 'Replace', exact: true }).click();
  await expect(page.getByLabel('Section title')).toHaveValue('Sugar basics');
  await expect(count).toHaveText('1 of 5');
  await expect.poll(() => marks(page)).toEqual(['GLUCOSE', 'glucose', 'Glucose', 'glucose', 'on:glucose']);
  await page.getByRole('button', { name: 'Replace all' }).click();
  await expect(count).toHaveText('No matches');
  await expect(page.getByText('Replaced 5 in 2 rows.')).toBeVisible();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf takes in light and makes sugar.');
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('The word SUGAR fades in.');
  await expect(page.getByLabel('Dialogue, row 2')).toHaveValue("**Sugar** is the plant's food.");
  await expect.poll(() => readFile(page, SCRIPT)).toContain('- Find a sugar diagram');
  const saved = await readFile(page, SCRIPT);
  expect(saved).toContain('- glucose-flow.mp4');
  expect(saved).toContain('# Sugar basics');
  // Undo puts the five back (the title stays: it was replaced on its own).
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('The word GLUCOSE fades in.');
  await expect(count).toHaveText('1 of 5');
  await expect(page.getByLabel('Section title')).toHaveValue('Sugar basics');
});
