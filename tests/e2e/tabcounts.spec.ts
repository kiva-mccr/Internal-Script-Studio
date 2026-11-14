import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { setUp, writeFile } from './folder';

// Tab counts that show what's new for you (RV-21, board 57).
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const VERSIONS = 'Episode 03/.studio/versions';
const COMMENTS = 'Episode 03/.studio/comments';
const SEEN_REVIEW = 'seen-review:Video Scripts/Episode 03';
const version = (id: string, parent: string, who: string, when: string, text: string, kind = 'edit', note = '') => ({
  [`${VERSIONS}/${when.replace(/[-:]/g, '')}_${id}.json`]: JSON.stringify({ v: 1, id, parents: parent ? [parent] : [], who, when, kind, note, sha256: '', text }),
});
const note = (id: string, who: string, when: string, text: string): [string, string] =>
  [`${COMMENTS}/${when.replace(/[-:]/g, '')}_${id}.json`, JSON.stringify({ v: 1, id, kind: 'comment', who, when, row: 'k3f9a', field: 'dialogue', quote: '', text })];
const tab = (page: Page, name: string) => page.getByRole('navigation', { name: 'Mode' }).getByRole('button', { name: new RegExp(`^${name}`) });

test('Review counts the rows changed since the send back, new to you; opening Review clears it', async ({ page }) => {
  // Ana sent it back; Jo changed row 1, then row 3, then sent it for review.
  const back = example.replace('Slow push-in on a sunlit leaf.', 'A leaf.').replace('chloroplasts catch the light', 'chloroplasts take the light');
  const one = back.replace('A leaf.', 'Slow push-in on a sunlit leaf.');
  const history = {
    ...version('a0000000', '', 'Ana', '2026-11-10T09:00:00Z', back, 'review', 'Sent back to writer'),
    ...version('b0000000', 'a0000000', 'Jo', '2026-11-11T09:00:00Z', one),
    ...version('c0000000', 'b0000000', 'Jo', '2026-11-11T10:00:00Z', example),
    ...version('d0000000', 'c0000000', 'Jo', '2026-11-11T11:00:00Z', example, 'review', 'Sent for review'),
  };
  // Sam last had Review open between Jo's two changes: only row 3 is new.
  await page.addInitScript(([key]) => sessionStorage.getItem('seeded') || (localStorage.setItem(key, '2026-11-11T09:30:00Z'), sessionStorage.setItem('seeded', '1')), [SEEN_REVIEW]);
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example, ...history });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await expect(tab(page, 'Review')).toHaveAccessibleName('Review 1 new');
  await expect(tab(page, 'Write')).toHaveAccessibleName('Write'); // the tab you are on never shows one

  // Opening Review clears it, and it stays cleared on leaving and on coming back.
  await tab(page, 'Review').click();
  await expect(page.getByRole('heading', { name: /^Open · / })).toBeVisible();
  await expect(tab(page, 'Review')).toHaveAccessibleName('Review');
  await tab(page, 'History').click();
  await expect(tab(page, 'Review')).toHaveAccessibleName('Review');
  await page.reload();
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await expect(tab(page, 'Write')).toHaveAccessibleName('Write');
  await expect(tab(page, 'Review')).toHaveAccessibleName('Review');
});

test("Write counts others' open comments made during the review, once sent back; it counts again what comes later", async ({ page }) => {
  const draft = example.replace('status: in review', 'status: draft');
  const files = {
    [SCRIPT]: draft,
    ...version('a0000000', '', 'Sam', '2026-11-10T09:00:00Z', example, 'review', 'Sent for review'),
    ...version('b0000000', 'a0000000', 'Ana', '2026-11-10T12:00:00Z', draft, 'review', 'Sent back to writer'),
    ...Object.fromEntries([
      note('old00001', 'Ana', '2026-11-09T09:00:00Z', 'From the round before.'),
      note('ana00001', 'Ana', '2026-11-10T10:00:00Z', 'Shorter?'),
      note('ana00002', 'Ana', '2026-11-10T11:00:00Z', 'Real leaf?'),
      note('sam00001', 'Sam', '2026-11-10T11:30:00Z', 'My own.'),
    ]),
  };
  // From a shared link, so it opens on Review.
  await setUp(page, '#/Episode%2003?review', files);
  await expect(page.getByRole('heading', { name: /^Open · / })).toBeVisible();
  await expect(tab(page, 'Write')).toHaveAccessibleName('Write 2 new');
  await tab(page, 'Write').click();
  await expect(tab(page, 'Write')).toHaveAccessibleName('Write');

  // Back on Review, a new comment by Jo comes in with the 5 s check: Write counts only that one.
  await tab(page, 'Review').click();
  await expect(page.getByRole('heading', { name: /^Open · / })).toBeVisible();
  const [path, text] = note('jo000001', 'Jo', new Date().toISOString(), 'One more thing.');
  await writeFile(page, path, text);
  await expect(tab(page, 'Write')).toHaveAccessibleName('Write 1 new', { timeout: 15000 });
  await expect(tab(page, 'Review')).toHaveAccessibleName('Review'); // a draft: Review counts nothing
});
