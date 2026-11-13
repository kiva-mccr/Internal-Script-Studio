import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readJsonFiles, setUp } from './folder';

// Put a comment on hold (RV-19, board 58): out of the open list into "On hold", back at the next send or version.
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const COMMENTS = 'Episode 03/.studio/comments';
const id = (n: number) => example.match(new RegExp(`## ${n} <!-- id: (\\w+) -->`))![1];
const note = (o: Record<string, string>): [string, string] => [`${COMMENTS}/${o.when.replace(/[-:]/g, '')}_${o.id}.json`, JSON.stringify({ v: 1, ...o })];
const ANA = note({ id: 'ana00001', kind: 'comment', who: 'Ana', when: '2026-11-10T09:00:00Z', row: id(1), field: 'on_screen', quote: 'sunlit leaf', text: 'Could we shoot a real leaf?' });
const BEN = note({ id: 'ben00001', kind: 'comment', who: 'Ben', when: '2026-11-10T09:02:00Z', row: id(4), field: 'dialogue', quote: '', text: 'Add a recap here?' });
const HELD = note({ id: 'ana00009', kind: 'hold', who: 'Ana', when: '2026-11-10T09:05:00Z', about: 'ben00001' });
const draft = example.replace('status: in review', 'status: draft');

async function open(page: Page, files: [string, string][], script = draft) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: script, ...Object.fromEntries(files) });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

test('Put on hold waits 5 seconds with Undo, then slides into On hold; not counted; Take off hold brings it back', async ({ page }) => {
  await page.clock.install();
  await open(page, [ANA, BEN]);
  await page.clock.pauseAt(Date.now() + 60_000);
  await page.getByRole('button', { name: 'Open comments, 2 open' }).click();
  const panel = page.getByRole('complementary', { name: 'Comments' });
  const ben = panel.getByRole('article', { name: 'Comment by Ben' });
  await ben.getByRole('button', { name: 'Put on hold' }).click();
  await expect(ben).toContainText('On hold.');
  // Undo within the wait keeps it open. (Each step a second apart: notes are put in order by their time, and the
  // clock is stopped.)
  await page.clock.runFor(1000);
  await ben.getByRole('button', { name: 'Undo' }).click();
  await expect(ben.getByRole('button', { name: 'Put on hold' })).toBeVisible();
  await page.clock.runFor(1000);
  await ben.getByRole('button', { name: 'Put on hold' }).click();
  await expect(ben).toContainText('On hold.'); // written: the wait starts now
  await page.clock.runFor(3000);
  await expect(ben).toContainText('On hold.');
  await page.clock.runFor(2500);
  // It slides away, a frame at a time: the clock is stopped, so it moves only while the test runs it.
  await expect.poll(async () => (await page.clock.runFor(100), ben.count())).toBe(0);
  await expect(panel.getByRole('button', { name: 'On hold · 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: /open on row 4/ })).toHaveCount(0); // no bubble
  await expect(panel.getByRole('button', { name: 'Comments · 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Review/ })).toContainText('1');

  await panel.getByRole('button', { name: 'On hold · 1' }).click();
  await expect(panel).toContainText('Back in the open list at the next Send for review or official version.');
  await expect(ben).toContainText('On hold · Sam');
  await page.clock.runFor(1000);
  await ben.getByRole('button', { name: 'Take off hold' }).click();
  await expect(panel.getByRole('button', { name: /On hold ·/ })).toHaveCount(0);
  await expect(ben.getByRole('button', { name: 'Resolve' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1 open comment on row 4' })).toBeVisible();

  const files = await readJsonFiles(page, COMMENTS);
  expect(files.filter((f) => f.about === 'ben00001').map((f) => [f.kind, f.who])).toEqual([
    ['hold', 'Sam'], ['reopen', 'Sam'], ['hold', 'Sam'], ['reopen', 'Sam'],
  ]);
});

test('Send for review says held comments come back, and brings them back marked', async ({ page }) => {
  await open(page, [ANA, BEN, HELD]);
  await page.getByRole('button', { name: 'Send for review' }).click();
  const region = page.getByRole('region', { name: 'Send for review' });
  await expect(region).toContainText('The comment on hold comes back into the open list for the reviewers.');
  await region.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('In review', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Review/ }).click();
  const aside = page.getByRole('complementary', { name: 'Comments' });
  await expect(aside.getByRole('heading', { name: 'Open · 2' })).toBeVisible();
  await expect(aside.getByRole('article', { name: 'Comment by Ben' })).toContainText('Back from hold · put on hold by Ana');
  await expect(aside.getByRole('button', { name: /On hold ·/ })).toHaveCount(0);
});

test('in Review: held comments are under On hold, and Put on hold works there too', async ({ page }) => {
  await open(page, [ANA, BEN, HELD], example); // in review
  await page.getByRole('button', { name: /^Review/ }).click();
  const aside = page.getByRole('complementary', { name: 'Comments' });
  await expect(aside.getByRole('heading', { name: 'Open · 1' })).toBeVisible();
  await expect(aside.getByRole('article', { name: 'Comment by Ben' })).toHaveCount(0);
  const ana = aside.getByRole('article', { name: 'Comment by Ana' });
  await ana.getByRole('button', { name: 'Put on hold' }).click();
  await expect(ana).toContainText('On hold.');
  await expect(aside.getByRole('heading', { name: 'Open · 0' })).toBeVisible();
  // After 5 seconds it slides off to the right and fades, then its space closes.
  const slot = aside.locator('.slot', { has: page.locator('[data-id="ana00001"]') });
  const sliding = () => slot.evaluate((el) => Number(getComputedStyle(el).opacity) < 1 && new DOMMatrix(getComputedStyle(el).transform).m41 > 0).catch(() => false);
  await expect.poll(sliding, { intervals: [25], timeout: 8000 }).toBe(true);
  await expect(aside.getByRole('button', { name: 'On hold · 2' })).toBeVisible();
  await expect(slot).toHaveCount(0);
  await expect(aside.getByText('No open comments.')).toBeVisible();
  await aside.getByRole('button', { name: 'On hold · 2' }).click();
  await expect(aside.getByRole('article', { name: 'Comment by Ben' })).toContainText('On hold · Ana');
  await expect(ana).toContainText('On hold · Sam');
});
