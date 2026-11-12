import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, setUp, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const PLAN = 'Episode 03/plan.md';

async function openExample(page: Page, files: Record<string, string> = {}) {
  await setUp(page, '#/Episode%2003', { 'Episode 03/script.md': example, ...files });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

test('the Planning tab opens notes that save to plan.md, and stays open', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Open planning' }).click();
  const notes = page.getByLabel('Planning notes');
  await expect(notes).toHaveAttribute('placeholder', /Learning goals, an outline, notes/);
  await notes.fill('Learning goals');
  await notes.press('End');
  await notes.press('Enter');
  await page.getByRole('button', { name: 'Tick box (again to tick it)' }).click();
  await notes.pressSequentially('Name the three ingredients');
  await notes.press('Enter');
  await notes.pressSequentially('Say what chloroplasts do');
  await expect(page.getByText('Kept with the script, in plan.md', { exact: true })).toBeVisible({ timeout: 10000 });
  expect(await readFile(page, PLAN)).toBe('Learning goals\n- [ ] Name the three ingredients\n- [ ] Say what chloroplasts do');
  // The script itself is untouched.
  expect(await readFile(page, 'Episode 03/script.md')).toBe(example);
  // Shown as tick boxes once you click away.
  await page.getByLabel('Dialogue, row 1').click();
  await expect(page.getByLabel('Planning').getByText('☐ Name the three ingredients')).toBeVisible();

  // Open in Review too, and still open after a reload.
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(notes).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Planning notes')).toHaveValue(/Say what chloroplasts do/);
  await page.getByRole('button', { name: 'Close planning' }).click();
  await expect(page.getByRole('button', { name: 'Open planning' })).toBeVisible();
  await expect(page.getByLabel('Planning notes')).toHaveCount(0);
});

test('someone else\'s plan shows quietly, and saves at the same time are combined', async ({ page }) => {
  await openExample(page, { [PLAN]: 'Outline\n1. Hook\n' });
  await page.getByRole('button', { name: 'Open planning' }).click();
  const notes = page.getByLabel('Planning notes');
  await expect(notes).toHaveValue('Outline\n1. Hook\n');
  await writeFile(page, PLAN, 'Outline\n1. Hook\n2. Ingredients\n');
  await expect(notes).toHaveValue('Outline\n1. Hook\n2. Ingredients\n', { timeout: 10000 });

  // You type while they save: both are kept.
  await notes.fill('Outline\n1. Hook\n2. Ingredients\nNotes: keep it short\n');
  await writeFile(page, PLAN, 'Outline\n1. Hook\n2. Ingredients\n3. Payoff\n');
  await expect(notes).toHaveValue('Outline\n1. Hook\n2. Ingredients\nNotes: keep it short\n\n3. Payoff\n', { timeout: 10000 });
  expect(await readFile(page, PLAN)).toBe('Outline\n1. Hook\n2. Ingredients\nNotes: keep it short\n\n3. Payoff\n');
});

test('not on History', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Open planning' }).click();
  await page.getByRole('button', { name: 'History', exact: true }).click();
  await expect(page.getByLabel('Planning notes')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open planning' })).toHaveCount(0);
});
