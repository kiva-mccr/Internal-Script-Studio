import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp, writeChange } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const OLD = 'It needs three simple ingredients: sunlight, water, and carbon dioxide.';

async function open(page: Page) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

test('a changed cell shows its words from before you started, plain, and can put them back (AP-38)', async ({ page }) => {
  await open(page);
  const toggle = page.getByRole('button', { name: 'Before you started: row 2 Dialogue' });
  await expect(toggle).toHaveCount(0); // nothing on rows you haven't touched

  const box = page.getByRole('textbox', { name: 'Dialogue, row 2' });
  await box.fill('It needs sunlight, water and carbon dioxide.');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('button', { name: 'Before you started: row 2 On screen' })).toHaveCount(0);
  await toggle.click();
  const old = page.getByLabel('Row 2 Dialogue as it was');
  await expect(old).toHaveText(OLD);

  // It stays open while you keep typing, and after a save.
  await box.pressSequentially(' Simple.');
  await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 10000 });
  await expect(old).toHaveText(OLD);

  // Put it back: the old words return through the Undo bar, and the toggle goes as nothing differs.
  await page.getByRole('button', { name: 'Put back row 2 Dialogue' }).click();
  await expect(box).toHaveValue(OLD);
  await expect(toggle).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(box).toHaveValue('It needs sunlight, water and carbon dioxide. Simple.');
  await expect(toggle).toBeVisible();
});

test("someone else's change is not shown as yours (AP-38)", async ({ page }) => {
  await open(page);
  await writeChange(page, 'Episode 03', 'Ana', example, example.replace('Slow push-in on a sunlit leaf.', 'Ana’s shot.'));
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Ana’s shot.', { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Before you started: row 1 On screen' })).toHaveCount(0);
  await page.getByLabel('On screen, row 1').fill('My shot.');
  await page.getByRole('button', { name: 'Before you started: row 1 On screen' }).click();
  await expect(page.getByLabel('Row 1 On screen as it was')).toHaveText('Ana’s shot.');
});
