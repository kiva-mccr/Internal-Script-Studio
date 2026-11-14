import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const svg = (fill: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="${fill}"/></svg>`;
// Row 2 gets a second picture only for the timeline.
const script = example.replace('- assets/icons-ingredients.svg\n', '- assets/icons-ingredients.svg\n- assets/sun.svg (timeline)\n');
const files = {
  'Episode 03/script.md': script,
  'Episode 03/assets/icons-ingredients.svg': svg('#2b67a8'),
  'Episode 03/assets/sun.svg': svg('#b5651d'),
};

const timeline = (page: Page) => page.getByRole('region', { name: 'Timeline' });
const saved = (page: Page) => expect.poll(() => readFile(page, 'Episode 03/script.md'), { timeout: 15000 });

test('the timeline lays out the rows; a click lights up the row and opens its pictures', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await expect(t.getByRole('button', { name: /^Row 1 · / })).toBeVisible();
  await expect(t.getByRole('button', { name: /^Intro ·/ })).toBeVisible();
  // A row with no take shows its read time.
  await expect(t.getByText(/no take · read time/).first()).toBeVisible();
  // Hover shows the dialogue.
  const row2 = t.getByRole('button', { name: /^Row 2 · / });
  await expect(row2).toHaveAccessibleName(/sunlight, water, and carbon dioxide/);
  await expect(row2.getByText('Sequence · 2')).toBeVisible();
  await row2.click();
  await expect(page.locator('.row.lit').getByLabel('Dialogue, row 2')).toBeVisible();
  await expect(t.locator('.panel strong')).toHaveText(/^Row 2 · /);
  await expect(t.getByRole('button', { name: /sun\.svg · timeline only/ })).toHaveAttribute('aria-pressed', 'true');
});

test('pictures: collage, leave one out', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await t.getByRole('button', { name: /^Row 2 · / }).click();
  await t.getByRole('button', { name: 'Collage' }).click();
  await expect(t.getByRole('button', { name: /^Row 2 · / }).getByText('Collage')).toBeVisible();
  await saved(page).toContain('Timeline: collage\n');
  await t.getByRole('button', { name: /icons-ingredients\.svg/ }).click();
  await saved(page).toContain('Timeline: collage, without assets/icons-ingredients.svg\n');
});

test('a file only for the timeline is minimised in Files', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const cell = page.locator('[data-row="p8x2m"]');
  await expect(cell.getByRole('button', { name: 'sun.svg', exact: true })).toHaveCount(0);
  await cell.getByRole('button', { name: '+1 for the timeline' }).click();
  await expect(cell.getByRole('button', { name: 'sun.svg', exact: true })).toBeVisible();
});

test('holds and placeholders: added from the panel, a bar in the script, changed there, ✕ with Undo', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await t.getByRole('button', { name: /^Row 2 · / }).click();
  await t.getByRole('button', { name: '+ Hold' }).click();
  await expect(t.getByRole('button', { name: /^Hold · 2 s/ })).toBeVisible();
  await saved(page).toContain('Timeline: then hold 2 s\n');
  // The bar in the script opens the same editing.
  const bar = page.getByRole('button', { name: 'Hold after row 2, 2 seconds' });
  await expect(bar).toHaveAttribute('aria-expanded', 'true'); // picked on the timeline, so open here too
  await bar.click();
  await expect(bar).toHaveAttribute('aria-expanded', 'false');
  await bar.click();
  await page.locator('.bar').getByRole('button', { name: 'Longer' }).click();
  await expect(page.getByRole('button', { name: 'Hold after row 2, 2.5 seconds' })).toBeVisible();
  await saved(page).toContain('Timeline: then hold 2.5 s\n');
  // A placeholder after row 4, with its words.
  await t.getByRole('button', { name: /^Row 4 · / }).click();
  await t.getByRole('button', { name: '+ Placeholder' }).click();
  await page.locator('.bar').last().getByLabel(/what goes here/).fill('Drone shot over a field');
  await saved(page).toContain('Timeline: then placeholder 3 s "Drone shot over a field"\n');
  // ✕ removes it at once; Undo puts it back.
  await page.getByRole('button', { name: 'Remove this placeholder' }).click();
  await expect(page.getByRole('button', { name: /^Placeholder after row 4/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('button', { name: /^Placeholder after row 4/ })).toBeVisible();
});

test('the timeline can be hidden, and stays hidden', async ({ page }) => {
  await setUp(page, '#/Episode%2003', files);
  const t = timeline(page);
  await t.getByRole('button', { name: '⌄ Hide' }).click();
  await expect(t.getByRole('button', { name: /^Row 1 · / })).toHaveCount(0);
  // Opening the script again (from the list) keeps it hidden.
  await page.getByRole('link', { name: 'Back to Video Scripts' }).click();
  await page.getByRole('link', { name: /How Photosynthesis Works/ }).click();
  await expect(timeline(page).getByRole('button', { name: '⌃ Show' })).toBeVisible();
});
