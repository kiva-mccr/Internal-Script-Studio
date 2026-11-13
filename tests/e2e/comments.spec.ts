import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { listFiles, readFile, setUp } from './folder';

// Review comments in Write (RV-13, board 37 idea A): a Comments tab beside Planning, bubbles on rows, quotes marked.
const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const COMMENTS = 'Episode 03/.studio/comments';
const VERSIONS = 'Episode 03/.studio/versions';
const id = (n: number) => example.match(new RegExp(`## ${n} <!-- id: (\\w+) -->`))![1];

const note = (o: Record<string, string>): [string, string] => [`${COMMENTS}/${o.when.replace(/[-:]/g, '')}_${o.id}.json`, JSON.stringify({ v: 1, ...o })];
// Ana's comment on row 1's On screen, Ana's suggestion on row 3, Ben's comment on the whole of row 4.
const ANA = note({ id: 'ana00001', kind: 'comment', who: 'Ana', when: '2026-11-10T09:00:00Z', row: id(1), field: 'on_screen', quote: 'sunlit leaf', text: 'Could we shoot a real leaf?' });
const SUGGEST = note({ id: 'ana00002', kind: 'suggestion', who: 'Ana', when: '2026-11-10T09:01:00Z', row: id(3), field: 'dialogue', quote: 'catch', replace: 'absorb' });
const BEN = note({ id: 'ben00001', kind: 'comment', who: 'Ben', when: '2026-11-10T09:02:00Z', row: id(4), field: 'dialogue', quote: '', text: 'Say where the oxygen goes too.' });
const draft = example.replace('status: in review', 'status: draft');
const sentBack = (who: string): [string, string] => [`${VERSIONS}/20261110T091200Z_back0000.json`,
  JSON.stringify({ v: 1, id: 'back0000', parents: [], who, when: '2026-11-10T09:12:00Z', kind: 'review', note: 'Sent back to writer', message: 'A few wording fixes, mostly in Inside the leaf.', sha256: '', text: draft })];

async function open(page: Page, files: [string, string][], script = draft) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: script, ...Object.fromEntries(files) });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

const marked = (page: Page, name = 'comment') => page.evaluate((name) => [...(CSS.highlights.get(name) ?? [])].map((r) => (r as Range).toString()), name);

test('rows with open comments get a bubble; it opens the Comments tab at that card, and quotes are marked', async ({ page }) => {
  await open(page, [ANA, SUGGEST, BEN]);
  // Closed, the edge shows both tabs.
  await expect(page.getByRole('button', { name: 'Open planning' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open comments, 3 open' })).toContainText('Comments · 3');
  await expect(page.getByRole('button', { name: '1 open comment on row 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1 open suggestion on row 3' })).toBeVisible();
  await expect(page.getByRole('button', { name: /open .* on row 2/ })).toHaveCount(0);
  await expect.poll(() => marked(page).then((m) => m.sort())).toEqual(['catch', 'sunlit leaf']);

  await page.getByRole('button', { name: '1 open suggestion on row 3' }).click();
  const panel = page.getByRole('complementary', { name: 'Comments' });
  await expect(panel.getByRole('button', { name: 'Comments · 3' })).toHaveAttribute('aria-pressed', 'true');
  await expect(panel.getByRole('article', { name: 'Suggestion by Ana' })).toContainText('Ana suggested · row 3, Dialogue');
  await expect.poll(() => marked(page, 'comment-on')).toEqual(['catch']);
  await expect(panel.getByRole('article', { name: 'Comment by Ben' })).toContainText('Ben commented · row 4');
  await expect(panel).toContainText('New comments are started in Review.');

  // Clicking a quote's words in a field opens its card.
  await page.getByLabel('On screen, row 1').click();
  await page.getByLabel('On screen, row 1').evaluate((box: HTMLTextAreaElement) => {
    const at = box.value.indexOf('sunlit') + 2;
    box.setSelectionRange(at, at);
    box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect.poll(() => marked(page, 'comment-on')).toEqual(['sunlit leaf']);

  // Planning is the other tab of the same panel; closing keeps the choice after a reload.
  await panel.getByRole('button', { name: 'Planning' }).click();
  await expect(page.getByLabel('Planning notes')).toBeVisible();
  await page.getByRole('complementary', { name: 'Planning' }).getByRole('button', { name: /^Comments/ }).click();
  await page.reload();
  await expect(page.getByRole('complementary', { name: 'Comments' })).toBeVisible();
  await page.getByRole('button', { name: 'Close comments' }).click();
  await expect(page.getByRole('button', { name: 'Open comments, 3 open' })).toBeVisible();

  // Review has only Planning in the panel: its comments are beside the script already.
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.getByRole('button', { name: /^Review/ })).toContainText('3');
  await expect(page.getByRole('button', { name: 'Open planning' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Open comments/ })).toHaveCount(0);
});

test('in Write the writer accepts a suggestion, resolves with Undo and replies while editing', async ({ page }) => {
  await open(page, [ANA, SUGGEST, BEN]);
  await page.getByRole('button', { name: 'Open comments, 3 open' }).click();
  const panel = page.getByRole('complementary', { name: 'Comments' });
  const suggestion = panel.getByRole('article', { name: 'Suggestion by Ana' });
  await suggestion.getByRole('button', { name: 'Accept' }).click();
  await expect(suggestion).toContainText('Accepted. The script is updated.');
  await expect(page.getByLabel('Dialogue, row 3')).toHaveValue(/chloroplasts absorb the light/);
  await expect.poll(() => readFile(page, SCRIPT)).toContain('chloroplasts absorb the light');
  await expect(page.getByRole('button', { name: /on row 3/ })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Comments · 2' })).toBeVisible();

  // Resolve asks nothing; Undo is there while the panel is open.
  const ben = panel.getByRole('article', { name: 'Comment by Ben' });
  await ben.getByRole('button', { name: 'Resolve' }).click();
  await expect(ben).toContainText('Resolved.');
  await expect(page.getByRole('button', { name: /on row 4/ })).toHaveCount(0);
  await ben.getByRole('button', { name: 'Undo' }).click();
  await expect(ben.getByRole('button', { name: 'Resolve' })).toBeVisible();
  await expect(page.getByRole('button', { name: '1 open comment on row 4' })).toBeVisible();

  // Reply, then fix the row in Write without leaving the tab.
  const ana = panel.getByRole('article', { name: 'Comment by Ana' });
  await ana.getByRole('button', { name: 'Reply' }).click();
  await ana.getByLabel('Reply').fill('We can, next week.');
  await ana.getByRole('button', { name: 'Reply' }).click();
  await expect(ana).toContainText('We can, next week.');
  await page.getByLabel('On screen, row 1').fill('Slow push-in on a real leaf.');
  await expect(ana).toContainText('On text that has since changed: “sunlit leaf”');

  const files = await Promise.all((await listFiles(page, COMMENTS)).map(async (f) => JSON.parse(await readFile(page, `${COMMENTS}/${f}`))));
  expect(files.map((f) => f.kind).sort()).toEqual(['accept', 'comment', 'comment', 'reopen', 'reply', 'resolve', 'suggestion']);
  expect(files.find((f) => f.kind === 'reply')).toMatchObject({ who: 'Sam', about: 'ana00001' });
});

test('a card takes Write to its row', async ({ page }) => {
  await open(page, [BEN]);
  await page.setViewportSize({ width: 1280, height: 400 });
  await page.getByRole('button', { name: 'Open comments, 1 open' }).click();
  await page.getByRole('article', { name: 'Comment by Ben' }).click();
  await expect(page.getByLabel('Dialogue, row 4')).toBeInViewport();
});

test('after a send back by someone else, Write opens on Comments with their note, once (RV-13)', async ({ page }) => {
  await open(page, [SUGGEST, sentBack('Ana')]);
  const panel = page.getByRole('complementary', { name: 'Comments' });
  await expect(panel).toBeVisible();
  const back = panel.getByRole('note', { name: 'Note from Ana' });
  await expect(back).toContainText('Ana sent it back');
  await expect(back).toContainText('A few wording fixes, mostly in Inside the leaf.');
  // Closed, it stays closed next time: it opens by itself only once for each send back.
  await page.getByRole('button', { name: 'Close comments' }).click();
  await page.reload();
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(panel).toHaveCount(0);
  // The note is still at the top while it is a draft.
  await page.getByRole('button', { name: 'Open comments, 1 open' }).click();
  await expect(back).toBeVisible();
});

test('your own send back does not open the panel; once sent for review again the note goes', async ({ page }) => {
  await open(page, [sentBack('Sam')]);
  await page.waitForTimeout(500);
  await expect(page.getByRole('complementary', { name: 'Comments' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Open comments, 0 open' }).click();
  await expect(page.getByRole('note', { name: 'Note from Sam' })).toBeVisible();
  await expect(page.getByText('No open comments.')).toBeVisible();
  await page.getByRole('button', { name: 'Send for review' }).click();
  await page.getByRole('region', { name: 'Send for review' }).getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('In review', { exact: true })).toBeVisible();
  await expect(page.getByRole('note', { name: 'Note from Sam' })).toHaveCount(0);
});

test('Send back to writer takes a note, kept in History and shown at the top of Comments', async ({ page }) => {
  await open(page, [], example); // in review
  await page.getByRole('button', { name: /^Review/ }).click();
  await page.getByRole('button', { name: 'Send back to writer' }).click();
  const region = page.getByRole('region', { name: 'Send back to writer' });
  await expect(region.getByLabel('A note for the writer')).toBeFocused();
  await region.getByLabel('A note for the writer').fill('Tighten row 3.');
  await page.keyboard.press('Escape');
  await expect(region).toHaveCount(0);
  await page.getByRole('button', { name: 'Send back to writer' }).click();
  await expect(region.getByLabel('A note for the writer')).toHaveValue('Tighten row 3.');
  await region.getByRole('button', { name: 'Send back to writer' }).click();
  await expect.poll(() => readFile(page, SCRIPT)).toContain('status: draft\n');
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Open comments, 0 open' }).click();
  await expect(page.getByRole('note', { name: 'Note from Sam' })).toContainText('Tighten row 3.');
  await page.getByRole('button', { name: 'History' }).click();
  const newest = page.getByRole('navigation', { name: 'Versions' }).getByRole('button').nth(0);
  await expect(newest).toContainText('Sent back to writer');
  await expect(newest).toContainText('Tighten row 3.');
});
