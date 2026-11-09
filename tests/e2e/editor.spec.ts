import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, setUp, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';

async function openExample(page: Page) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example, 'Episode 03/assets/leaf-closeup.jpg': 'jpg' });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

async function saved(page: Page) {
  await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 10000 });
}

test('shows the three columns, sections and files', async ({ page }) => {
  await openExample(page);
  await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toHaveText(/Video Scripts\s*\/\s*How Photosynthesis Works/);
  await expect(page.getByLabel('Section title')).toHaveCount(3);
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Slow push-in on a sunlit leaf.');
  await expect(page.getByRole('button', { name: 'leaf-closeup.jpg', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Chloroplast zoom animation' })).toHaveAttribute('href', 'https://example.com/chloroplast-zoom.mp4');
});

test('saves on its own after you stop typing, and adds you as an author', async ({ page }) => {
  await openExample(page);
  await page.getByLabel('Dialogue, row 1').fill('Every leaf is a tiny factory.');
  await expect(page.getByRole('status')).toHaveText('Editing…');
  await saved(page);
  const text = await readFile(page, SCRIPT);
  expect(text).toContain('Dialogue:\nEvery leaf is a tiny factory.\n');
  expect(text).toContain('authors: [Kiva, Sam]');
  // Nothing else changed.
  expect(text).toBe(example.replace('Every leaf you have ever seen is running a tiny factory.', 'Every leaf is a tiny factory.'));
});

test('rows can be added, moved and deleted', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Add a row below row 1' }).click();
  await page.getByLabel('Dialogue, row 2').fill('A new line.');
  await page.getByRole('button', { name: 'Move row 2 up' }).click();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('A new line.');
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Delete row 6' }).click();
  await saved(page);
  const text = await readFile(page, SCRIPT);
  expect(text).toMatch(/## 1 <!-- id: [a-z0-9]{5} -->\nDialogue:\nA new line\.\n/);
  expect(text).toContain('## 2 <!-- id: k3f9a -->');
  expect(text).not.toContain('z4r5e');
  expect(text.match(/^## /gm)).toHaveLength(5);
});

test('a file picked is copied into assets/ and listed', async ({ page }) => {
  await openExample(page);
  await page.getByLabel('Dialogue, row 2').hover();
  await page.getByRole('button', { name: '+ Add' }).nth(1).click();
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose a file…' }).click();
  await (await chooser).setFiles({ name: 'sun icon.png', mimeType: 'image/png', buffer: Buffer.from('png') });
  await expect(page.getByRole('button', { name: 'sun icon.png', exact: true })).toBeVisible();
  await saved(page);
  expect(await readFile(page, 'Episode 03/assets/sun icon.png')).toBe('png');
  expect(await readFile(page, SCRIPT)).toContain('- assets/icons-ingredients.svg\n- assets/sun icon.png\n');
});

test('a link or a note can be added to the files', async ({ page }) => {
  await openExample(page);
  await page.getByLabel('Dialogue, row 1').hover();
  await page.getByRole('button', { name: '+ Add' }).first().click();
  await page.getByLabel('Link or description').fill('Drone shot of a forest (to find)');
  await page.getByLabel('Link or description').press('Enter');
  await saved(page);
  expect(await readFile(page, SCRIPT)).toContain('- assets/leaf-closeup.jpg\n- Drone shot of a forest (to find)\n');
});

test("a missing asset says so instead of failing", async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'icons-ingredients.svg', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText("isn't in the script's folder");
});

test('a change someone else saved shows up on its own', async ({ page }) => {
  await openExample(page);
  await writeFile(page, SCRIPT, example.replace('Slow push-in on a sunlit leaf.', 'Wide shot of a forest.'));
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Wide shot of a forest.', { timeout: 10000 });
});

test('saving over someone else’s change asks first', async ({ page }) => {
  await openExample(page);
  await page.getByLabel('Dialogue, row 1').fill('Mine.');
  await writeFile(page, SCRIPT, example.replace('Slow push-in on a sunlit leaf.', 'Theirs.'));
  await expect(page.getByRole('alert')).toContainText('Someone else saved this script');
  await page.getByRole('button', { name: 'Keep mine (replace theirs)' }).click();
  await saved(page);
  const text = await readFile(page, SCRIPT);
  expect(text).toContain('Mine.');
  expect(text).not.toContain('Theirs.');
});

test('a link to a script that is not there says so', async ({ page }) => {
  await setUp(page, '#/Episode%2099');
  await expect(page.getByRole('heading', { name: 'No script called "Episode 99"' })).toBeVisible();
});
