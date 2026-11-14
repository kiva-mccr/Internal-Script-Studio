import { expect, test, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { listFiles, readFile, readJsonFiles, setUp, writeChange, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const leaf = 'Slow push-in on a sunlit leaf.';

async function openExample(page: Page, files: Record<string, string> = {}) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example, ...files });
}

const version = (id: string, parents: string[], who: string, when: string, text: string) =>
  JSON.stringify({ v: 1, id, parents, who, when, kind: 'edit', note: '', sha256: sha(text), text });
const sha = (text: string) => createHash('sha256').update(text).digest('hex');

test('someone else’s change to another row comes in by itself, and yours are kept (FX-2)', async ({ page }) => {
  await openExample(page);
  await page.getByLabel('Dialogue, row 1').fill('Mine.');
  await writeChange(page, 'Episode 03', 'Ana', example, example.replace('They turn it into sugar', 'Theirs: sugar'));
  await expect(page.getByLabel('Dialogue, row 4')).toHaveValue(/Theirs: sugar/, { timeout: 10000 });
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Mine.');
  await expect(page.getByRole('status')).toHaveText('Saved', { timeout: 10000 });
  // This page is the only one here, so it keeps script.md: both changes end up in it.
  await expect.poll(() => readFile(page, SCRIPT), { timeout: 10000 }).toContain('Theirs: sugar');
  const text = await readFile(page, SCRIPT);
  expect(text).toContain('Dialogue:\nMine.\n');
});

test('the same field changed by both: pick one side by side, then save', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('save-every', '60000')); // still typing when theirs comes in
  await openExample(page);
  await page.getByLabel('On screen, row 1').fill('Mine.');
  await writeChange(page, 'Episode 03', 'Ana', example, example.replace(leaf, 'Theirs.'));
  await expect(page.getByRole('heading', { name: 'Ana and you both changed the same place' })).toBeVisible({ timeout: 10000 });
  const save = page.getByRole('button', { name: 'Pick one to save' });
  await expect(save).toBeDisabled();
  const row = page.getByRole('region', { name: 'Row 1 · On screen' });
  await row.getByRole('button', { name: /Ana’s.*Theirs\./ }).click();
  await page.getByRole('button', { name: 'Save combined version' }).click();
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Theirs.');
  await expect.poll(() => readFile(page, SCRIPT), { timeout: 10000 }).toContain('Theirs.');
  expect(await readFile(page, SCRIPT)).not.toContain('Mine.');
});

test('“… is editing” shows who else has the script open', async ({ page }) => {
  await openExample(page);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await writeFile(page, 'Episode 03/.studio/editing/ana_20261113T120000000Z.json',
    JSON.stringify({ v: 1, who: 'Ana', since: new Date().toISOString(), seen: new Date().toISOString(), last_written: '' }));
  await expect(page.getByText('Ana is editing')).toBeVisible({ timeout: 10000 });
  // Your own file is written (a new one each time). Leaving, a last one marked "left" takes their place (AP-37).
  const mine = async () => (await readJsonFiles(page, 'Episode 03/.studio/editing')).filter((e) => e.who === 'Sam');
  expect((await mine()).length).toBeGreaterThan(0);
  await page.getByRole('link', { name: 'Video Scripts' }).click();
  await expect.poll(async () => (await mine()).map((e) => !!e.left)).toEqual([true]);
  expect(await listFiles(page, 'Episode 03/.studio/editing')).toContain('ana_20261113T120000000Z.json');
});

test('who was here: "was here", "last seen" when someone went quiet, and the list (AP-37)', async ({ page }) => {
  const ago = (min: number) => new Date(Date.now() - min * 60000).toISOString();
  const file = (who: string, min: number, left: boolean) => JSON.stringify({ v: 1, who, since: ago(min + 30), seen: ago(min), last_written: '', ...(left ? { left: ago(min) } : {}) });
  await openExample(page, {
    'Episode 03/.studio/editing/lee_20261101T120000000Z.json': file('Lee', 180, true),
    'Episode 03/.studio/editing/ana_20261101T120000000Z.json': file('Ana', 12, true),
    'Episode 03/.studio/editing/jo_20261001T120000000Z.json': file('Jo', 40 * 24 * 60, true),
  });
  await expect(page.getByRole('button', { name: 'Ana was here 12 min ago' })).toBeVisible();
  await page.getByRole('button', { name: 'Ana was here 12 min ago' }).click();
  const list = page.getByRole('region', { name: 'Who has been here' });
  await expect(list).toContainText('Ana12 min ago');
  await expect(list).toContainText('Lee3 h ago');
  await expect(list).not.toContainText('Sam');
  await expect(list).not.toContainText('Jo'); // over 30 days: not listed, and removed
  await expect.poll(() => listFiles(page, 'Episode 03/.studio/editing')).not.toContain('jo_20261001T120000000Z.json');
  await page.keyboard.press('Escape');
  await expect(list).toHaveCount(0);
  // Priya stopped checking in 3 minutes ago without leaving: her last changes may not be in.
  await writeFile(page, 'Episode 03/.studio/editing/priya_20261101T120000000Z.json', file('Priya', 3, false));
  await expect(page.getByRole('button', { name: 'Priya last seen 3 min ago' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Priya last seen 3 min ago' })).toHaveAttribute('title', /stopped checking in/);
  // Someone editing takes the place, and the list opens from there too.
  await writeFile(page, 'Episode 03/.studio/editing/ana_20261102T120000000Z.json', file('Ana', 0, false));
  await page.getByRole('button', { name: 'Ana is editing' }).click({ timeout: 10000 });
  await expect(list).toContainText('Anaediting now');
  await expect(list).toContainText('Priyalast seen 3 min ago');
});

test('a copy OneDrive kept beside script.md is combined, then removed', async ({ page }) => {
  await openExample(page, { 'Episode 03/script-LAPTOP-SAM.md': example.replace('They turn it into sugar', 'From the copy') });
  await expect(page.getByLabel('Dialogue, row 4')).toHaveValue(/From the copy/);
  await expect.poll(() => readFile(page, SCRIPT)).toContain('From the copy');
  await expect.poll(() => listFiles(page, 'Episode 03')).not.toContain('script-LAPTOP-SAM.md');
});

test('a closed laptop’s last save is credited to its owner, not “outside the app”', async ({ page }) => {
  await openExample(page, {
    [SCRIPT]: example.replace(leaf, 'Lee’s change.'),
    'Episode 03/.studio/versions/20261109T100000Z_base0000.json': version('base0000', [], 'Kiva', '2026-11-09T10:00:00Z', example),
    'Episode 03/.studio/editing/lee.json': JSON.stringify({ v: 1, who: 'Lee', since: '2026-11-09T10:00:00Z', seen: '2026-11-09T10:10:00Z', last_written: sha(example.replace(leaf, 'Lee’s change.')) }),
  });
  await page.getByRole('button', { name: 'History' }).click();
  const newest = page.getByRole('navigation', { name: 'Versions' }).getByRole('button').first();
  await expect(newest).toContainText('Edited row 1');
  await expect(newest).toContainText('Lee ·');
});
