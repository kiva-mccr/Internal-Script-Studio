import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile, setUp } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const VERSIONS = 'Episode 03/.studio/versions';
const KEY = 'visit:Video Scripts/Episode 03';

// Sam last looked on Nov 10. Since then Ana changed row 1, Jo wrote row 4 and removed a row, and Sam (on another
// computer) changed row 3: only Ana's and Jo's are marked.
const base = example
  .replace('Slow push-in on a sunlit leaf.', 'A leaf.')
  .replace(/## 4 <!-- id: b6n0w -->[\s\S]*?(?=# Wrap-up)/, '')
  .replace('# Inside the leaf', '## 6 <!-- id: gone1 -->\nDialogue:\nChlorophyll is what makes leaves green.\n\n# Inside the leaf');
const ana = base.replace('A leaf.', 'Slow push-in on a sunlit leaf.');
const jo = example;
const sam = example.replace('chloroplasts catch the light', 'chloroplasts grab the light');
const version = (id: string, parent: string, who: string, when: string, text: string) => ({
  [`${VERSIONS}/${when.replace(/[-:]/g, '')}_${id}.json`]: JSON.stringify({ v: 1, id, parents: parent ? [parent] : [], who, when, kind: 'edit', note: '', sha256: '', text }),
});
const HISTORY = {
  ...version('base0000', '', 'Sam', '2026-11-10T09:00:00Z', base),
  ...version('ana00000', 'base0000', 'Ana', '2026-11-11T10:00:00Z', ana),
  ...version('jo000000', 'ana00000', 'Jo', '2026-11-11T11:00:00Z', jo),
  ...version('sam00000', 'jo000000', 'Sam', '2026-11-11T12:00:00Z', sam),
};

async function open(page: Page, lastLooked: string) {
  if (lastLooked) await page.addInitScript(([key, when]) => sessionStorage.getItem('looked') || (localStorage.setItem(key, when), sessionStorage.setItem('looked', '1')), [KEY, lastLooked]);
  await setUp(page, '#/Episode%2003', { [SCRIPT]: sam, ...HISTORY });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

test("rows others changed since you last looked are marked, can be stepped through, edited, ticked Seen or cleared (RV-15)", async ({ page }) => {
  await open(page, '2026-11-10T12:00:00Z');
  const bar = page.getByRole('group', { name: 'Changed since you last looked' });
  await expect(bar).toContainText('2 changes since');
  await expect(bar).toContainText('by Ana and Jo · 1 row removed');
  await expect(page.getByRole('button', { name: 'Seen, row 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seen, row 4' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Seen, row 3' })).toHaveCount(0); // Sam's own
  await expect(page.locator('[data-visit]').first()).toContainText('Changed');
  await expect(page.locator('.removed')).toContainText('Chlorophyll is what makes leaves green. · Jo');

  // Show the edits: the old words above the box; the box is still the place to type.
  await expect(page.getByLabel('On screen before, row 1')).toHaveCount(0);
  await bar.getByLabel('Show the edits').check();
  await expect(page.getByLabel('On screen before, row 1')).toHaveText('A leaf.');
  await expect(page.getByLabel('Dialogue before, row 1')).toHaveCount(0);
  await page.getByLabel('On screen, row 1').fill('Slow push-in on a sunlit leaf, at dawn.');
  await expect.poll(() => readFile(page, SCRIPT)).toContain('at dawn.');
  await expect(page.getByRole('button', { name: 'Seen, row 1' })).toBeVisible(); // the mark stays until you leave

  // ‹ › step through the changed rows.
  await bar.getByRole('button', { name: 'Next change' }).click();
  await expect(bar).toContainText('1 of 2');
  await expect(page.locator('.visit-on')).toHaveAttribute('data-visit', 'k3f9a');
  await bar.getByRole('button', { name: 'Next change' }).click();
  await expect(bar).toContainText('2 of 2');

  // Seen clears one row; Review shows the same marks, as it has no review round to compare with.
  await page.getByRole('button', { name: 'Seen, row 1' }).click();
  await expect(bar).toContainText('1 change left since');
  await expect(page.getByRole('button', { name: 'Seen, row 1' })).toHaveCount(0);
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(bar).toContainText('1 change left since');
  await expect(page.getByRole('button', { name: 'Seen, row 4' })).toBeVisible();
  await expect(page.getByLabel('Dialogue before, row 4')).toHaveCount(0); // a new row has no old words

  // Got it clears the rest; the next visit starts from this one.
  await bar.getByRole('button', { name: 'Got it' }).click();
  await expect(bar).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Seen, row 4' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await expect(page.getByLabel('Seen, row 4')).toHaveCount(0);
  await expect(bar).toHaveCount(0);
});

test('the first time on this computer marks nothing, and remembers the visit (RV-15)', async ({ page }) => {
  await open(page, '');
  await expect(page.getByRole('group', { name: 'Changed since you last looked' })).toHaveCount(0);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), KEY)).toMatch(/^\d{4}-\d\d-\d\dT/);
});
