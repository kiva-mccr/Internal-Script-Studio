import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { listFiles, readFile, setUp, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const COMMENTS = 'Episode 03/.studio/comments';

async function openReview(page: Page, files: Record<string, string> = {}) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example, ...files });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.getByRole('button', { name: /^Review/ }).click();
}

// Selects `text` inside a cell, as a person dragging over it would.
// The quotes marked in the script (CSS highlights).
const marked = (page: Page) =>
  page.evaluate(() => [...(CSS.highlights.get('comment') ?? []), ...(CSS.highlights.get('comment-on') ?? [])].map((r) => (r as Range).toString()));

async function selectText(page: Page, cell: string, text: string) {
  await page.getByLabel(cell).evaluate((el, text) => {
    const node = [...el.childNodes].find((n) => n.textContent?.includes(text))!;
    const at = node.textContent!.indexOf(text);
    const range = document.createRange();
    range.setStart(node.firstChild ?? node, at);
    range.setEnd(node.firstChild ?? node, at + text.length);
    getSelection()!.removeAllRanges();
    getSelection()!.addRange(range);
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  }, text);
}

test('select text to comment on it; the comment is saved as its own file', async ({ page }) => {
  await openReview(page);
  await selectText(page, 'On screen, row 1', 'sunlit leaf');
  const form = page.getByRole('form', { name: 'New comment' });
  await expect(form).toContainText('Comment on row 1 · On screen');
  await form.getByRole('button', { name: 'Add comment' }).click();
  await expect(form.getByRole('alert')).toHaveText('Write a comment first.');
  await form.getByLabel('Comment', { exact: true }).fill('Could we shoot a real leaf?');
  await form.getByRole('button', { name: 'Add comment' }).click();
  await expect(form).toHaveCount(0);
  const card = page.getByRole('article', { name: 'Comment by Sam' });
  await expect(card).toContainText('Sam commented · row 1');
  await expect(card).toContainText('Could we shoot a real leaf?');
  await expect.poll(() => marked(page)).toEqual(['sunlit leaf']);
  await expect(page.getByRole('heading', { name: 'Open · 1' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Review/ })).toContainText('1');
  const [file] = await listFiles(page, COMMENTS);
  expect(JSON.parse(await readFile(page, `${COMMENTS}/${file}`))).toMatchObject({
    kind: 'comment', who: 'Sam', field: 'on_screen', quote: 'sunlit leaf', text: 'Could we shoot a real leaf?',
  });
});

test('comment on a whole row, reply, resolve and reopen', async ({ page }) => {
  await openReview(page);
  await page.getByRole('button', { name: 'Comment on row 3' }).click();
  await page.getByLabel('Comment', { exact: true }).fill('Is this too fast?');
  await page.getByRole('form', { name: 'New comment' }).getByRole('button', { name: 'Add comment' }).click();
  const card = page.getByRole('article', { name: 'Comment by Sam' });
  await card.getByRole('button', { name: 'Reply' }).click();
  await card.getByLabel('Reply').fill('A little.');
  await card.getByRole('button', { name: 'Reply' }).click();
  await expect(card).toContainText('A little.');
  await card.getByRole('button', { name: 'Resolve' }).click();
  await expect(page.getByRole('heading', { name: 'Open · 0' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Review/ })).toHaveText('Review');
  await page.getByRole('button', { name: /Resolved · 1/ }).click();
  await card.getByRole('button', { name: 'Reopen' }).click();
  await expect(page.getByRole('heading', { name: 'Open · 1' })).toBeVisible();
  expect(await listFiles(page, COMMENTS)).toHaveLength(4); // comment, reply, resolve, reopen: never edited
});

test('someone else’s comment appears, and one on changed text says so', async ({ page }) => {
  const ana = { v: 1, id: 'ana00000', kind: 'comment', who: 'Ana', when: '2026-11-09T10:00:00Z', row: '', field: 'on_screen', quote: 'a plastic tree', text: 'Real leaf?' };
  const rowId = example.match(/## 1 <!-- id: (\w+) -->/)![1];
  await openReview(page, { [`${COMMENTS}/20261109T100000Z_ana00000.json`]: JSON.stringify({ ...ana, row: rowId }) });
  const card = page.getByRole('article', { name: 'Comment by Ana' });
  await expect(card).toContainText('Ana commented · row 1');
  await expect(card).toContainText('On text that has since changed: “a plastic tree”');
  await writeFile(page, `${COMMENTS}/20261109T100100Z_lee00000.json`,
    JSON.stringify({ ...ana, id: 'lee00000', who: 'Lee', quote: 'sunlit', row: rowId, text: 'Morning light?' }));
  await expect(page.getByRole('article', { name: 'Comment by Lee' })).toBeVisible({ timeout: 10000 });
  await expect.poll(() => marked(page)).toEqual(['sunlit']);
});

async function suggestOn(page: Page, cell: string, text: string, replace: string) {
  await selectText(page, cell, text);
  const form = page.getByRole('form', { name: 'New comment' });
  await form.getByRole('button', { name: 'Suggest a change' }).click();
  await expect(form.getByLabel('Replace with')).toHaveValue(text);
  await form.getByRole('button', { name: 'Add suggestion' }).click();
  await expect(form.getByRole('alert')).toHaveText('Change the text first.');
  await form.getByLabel('Replace with').fill(replace);
  await form.getByRole('button', { name: 'Add suggestion' }).click();
  await expect(form).toHaveCount(0);
}

test('suggest a change; accepting updates the script, and Undo puts it back', async ({ page }) => {
  await openReview(page);
  await suggestOn(page, 'Dialogue, row 3', 'catch', 'absorb');
  const card = page.getByRole('article', { name: 'Suggestion by Sam' });
  await expect(card).toContainText('Sam suggested · row 3');
  await expect(card).toContainText('Replace “catch” with “absorb”.');
  await expect(page.getByRole('button', { name: /^Review/ })).toContainText('1');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(card).toContainText('Accepted. The script is updated.');
  await expect(page.getByLabel('Dialogue, row 3')).toContainText('chloroplasts absorb the light');
  await expect(page.getByRole('heading', { name: 'Open · 0' })).toBeVisible();
  await expect.poll(() => readFile(page, SCRIPT)).toContain('chloroplasts absorb the light');
  await card.getByRole('button', { name: 'Undo' }).click();
  await expect(card.getByRole('button', { name: 'Accept' })).toBeVisible();
  await expect(page.getByLabel('Dialogue, row 3')).toContainText('chloroplasts catch the light');
  await expect.poll(() => readFile(page, SCRIPT)).toBe(example);
});

test('rejecting keeps the original; a suggestion on changed text is not applied', async ({ page }) => {
  await openReview(page);
  await suggestOn(page, 'On screen, row 2', 'slide in one at a time', 'pop in, timed to each word');
  const card = page.getByRole('article', { name: 'Suggestion by Sam' });
  await card.getByRole('button', { name: 'Reject' }).click();
  await expect(card).toContainText('Rejected. The original stays.');
  await expect(page.getByLabel('On screen, row 2')).toContainText('slide in one at a time');
  await card.getByRole('button', { name: 'Undo' }).click();
  // Meanwhile the words were changed in Write.
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await page.getByLabel('On screen, row 2').fill('Icons appear.');
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(card).toContainText('On text that has since changed');
  await card.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByRole('alert')).toContainText('That text has changed since the suggestion was made.');
  await expect(card.getByRole('button', { name: 'Accept' })).toBeVisible();
});

// The example's four files, so none is missing and nothing is left open before Approve.
const ALL_FILES = Object.fromEntries(['leaf-closeup.jpg', 'icons-ingredients.svg', 'storyboard-p4.pdf', 'glucose-model.png'].map((f) => [`Episode 03/assets/${f}`, 'x']));

test('approve, send for review again, and send back to the writer; each is in History', async ({ page }) => {
  await openReview(page, ALL_FILES); // the example is "in review"
  await page.getByRole('button', { name: 'Approve' }).click(); // nothing open: approved at once
  await expect(page.getByRole('region', { name: 'Still open' })).toHaveCount(0);
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  await expect.poll(() => readFile(page, SCRIPT)).toContain('status: approved\n');
  await expect(page.getByRole('button', { name: 'Send for review' })).toHaveCount(0); // only Write sends it
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Send for review' }).click();
  await page.getByRole('region', { name: 'Send for review' }).getByRole('button', { name: 'Send for review' }).click(); // no note
  await expect(page.getByText('In review', { exact: true })).toBeVisible(); // Write shows where it stands
  await page.getByRole('button', { name: /^Review/ }).click();
  await page.getByRole('button', { name: 'Send back to writer' }).click();
  await page.getByRole('region', { name: 'Send back to writer' }).getByRole('button', { name: 'Send back to writer' }).click(); // no note
  await expect(page.getByRole('button', { name: 'Send for review' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send for review' })).toBeVisible();
  await expect.poll(() => readFile(page, SCRIPT)).toContain('status: draft\n');
  await page.getByRole('button', { name: 'History' }).click();
  const versions = page.getByRole('navigation', { name: 'Versions' }).getByRole('button');
  await expect(versions.nth(0)).toContainText('Sent back to writer');
  await expect(versions.nth(1)).toContainText('Sent for review');
  await expect(versions.nth(2)).toContainText('Approved');
});

test('a note for the reviewers with Send for review: shown at the top of Review and kept in History (RV-8)', async ({ page }) => {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example.replace('status: in review', 'status: draft') });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  const panel = page.getByRole('region', { name: 'Send for review' });
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(panel.getByLabel('A note for the reviewers')).toBeFocused();
  await panel.getByLabel('A note for the reviewers').fill('Rows 2 and 3 are new.\nIs the CO2 line clear?');
  // Cancel and Esc close it without sending, and keep what was typed.
  await panel.getByRole('button', { name: 'Cancel' }).click();
  await expect(panel).toHaveCount(0);
  await page.getByRole('button', { name: 'Send for review' }).click();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  expect(await readFile(page, SCRIPT)).toContain('status: draft\n');
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(panel.getByLabel('A note for the reviewers')).toHaveValue('Rows 2 and 3 are new.\nIs the CO2 line clear?');
  await panel.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('In review', { exact: true })).toBeVisible();
  // The reviewer sees it at the top of Review, and can fold it away.
  await page.getByRole('button', { name: /^Review/ }).click();
  const note = page.getByRole('note', { name: 'Note from Sam' });
  await expect(note).toContainText('Sam sent this for review');
  await expect(note).toContainText('Rows 2 and 3 are new.\nIs the CO2 line clear?');
  await note.getByRole('button', { name: 'Hide' }).click();
  await expect(note).toHaveCount(0);
  await page.getByRole('button', { name: "Sam's note" }).click();
  await expect(note).toBeVisible();
  // History keeps it with "Sent for review", in the same entry.
  await page.getByRole('button', { name: 'History' }).click();
  const newest = page.getByRole('navigation', { name: 'Versions' }).getByRole('button').nth(0);
  await expect(newest).toContainText('Sent for review');
  await expect(newest).toContainText('Rows 2 and 3 are new.\nIs the CO2 line clear?');
  const files = await listFiles(page, 'Episode 03/.studio/versions');
  const kept = await Promise.all(files.map((f) => readFile(page, `Episode 03/.studio/versions/${f}`).then((t) => JSON.parse(t))));
  expect(kept.filter((v) => v.message).map((v) => [v.note, v.message])).toEqual([['Sent for review', 'Rows 2 and 3 are new.\nIs the CO2 line clear?']]);
  // Once sent back, Review no longer shows it.
  await page.getByRole('button', { name: /^Review/ }).click();
  await page.getByRole('button', { name: 'Send back to writer' }).click();
  await page.getByRole('region', { name: 'Send back to writer' }).getByRole('button', { name: 'Send back to writer' }).click(); // no note
  await expect(note).toHaveCount(0);
  await expect(page.getByRole('button', { name: "Sam's note" })).toHaveCount(0);
  // An empty note sends too, and shows nothing in Review.
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(panel.getByLabel('A note for the reviewers')).toHaveValue('');
  await panel.getByRole('button', { name: 'Send for review' }).click();
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(page.getByRole('button', { name: 'Approve' })).toBeVisible();
  await expect(note).toHaveCount(0);
});

test('Approve lists what is still open first, jumps to it, and never blocks (RV-5)', async ({ page }) => {
  const rowId = example.match(/## 1 <!-- id: (\w+) -->/)![1];
  const ana = { v: 1, id: 'ana00000', kind: 'comment', who: 'Ana', when: '2026-11-09T10:00:00Z', row: rowId, field: 'on_screen', quote: 'sunlit', text: 'Morning light?' };
  await openReview(page, { [`${COMMENTS}/20261109T100000Z_ana00000.json`]: JSON.stringify(ana) }); // the four files are missing
  await page.getByRole('button', { name: 'Approve' }).click();
  const panel = page.getByRole('region', { name: 'Still open' });
  await expect(panel).toContainText('2 things are still open');
  await expect(panel.getByRole('button').nth(0)).toContainText('Comment · Ana · row 1Morning light?');
  await expect(panel.getByRole('button').nth(1)).toContainText('4 files missingleaf-closeup.jpg, icons-ingredients.svg');
  // A line jumps to that comment, and the panel closes.
  await panel.getByRole('button', { name: /Comment · Ana/ }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'Comment by Ana' })).toHaveClass(/active/);
  // Keep reviewing and Esc close it; nothing changes.
  await page.getByRole('button', { name: 'Approve' }).click();
  await panel.getByRole('button', { name: 'Keep reviewing' }).click();
  await expect(panel).toHaveCount(0);
  await page.getByRole('button', { name: 'Approve' }).click();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  expect(await readFile(page, SCRIPT)).toContain('status: in review\n');
  // The missing files line opens Assets.
  await page.getByRole('button', { name: 'Approve' }).click();
  await panel.getByRole('button', { name: /files missing/ }).click();
  await expect(page.getByRole('region', { name: 'Assets' })).toBeVisible();
  // Approve anyway approves, and History says how much was left open.
  await page.getByRole('button', { name: /^Review/ }).click();
  await page.getByRole('button', { name: 'Approve' }).click();
  await panel.getByRole('button', { name: 'Approve anyway' }).click();
  await expect(page.getByText('Approved', { exact: true })).toBeVisible();
  await expect.poll(() => readFile(page, SCRIPT)).toContain('status: approved\n');
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('navigation', { name: 'Versions' }).getByRole('button').nth(0)).toContainText('Approved, 2 still open');
});

test('edit and delete your own comment, reply and suggestion, with Undo; never someone else’s (RV-7)', async ({ page }) => {
  const rowId = example.match(/## 1 <!-- id: (\w+) -->/)![1];
  const ana = { v: 1, id: 'ana00000', kind: 'comment', who: 'Ana', when: '2026-11-09T10:00:00Z', row: rowId, field: 'on_screen', quote: 'sunlit', text: 'Real leaf?' };
  await openReview(page, { [`${COMMENTS}/20261109T100000Z_ana00000.json`]: JSON.stringify(ana) });
  const anaCard = page.getByRole('article', { name: 'Comment by Ana' });
  await expect(anaCard.getByRole('button', { name: 'Edit' })).toHaveCount(0);
  await expect(anaCard.getByRole('button', { name: 'Delete' })).toHaveCount(0);

  // Your reply on Ana's comment.
  await anaCard.getByRole('button', { name: 'Reply' }).click();
  await anaCard.getByLabel('Reply').fill('Yse.');
  await anaCard.getByRole('button', { name: 'Reply' }).click();
  await anaCard.getByRole('button', { name: 'Edit' }).click();
  await expect(anaCard.getByLabel('Edit reply')).toHaveValue('Yse.');
  await anaCard.getByLabel('Edit reply').fill('Yes.');
  await anaCard.getByRole('button', { name: 'Save' }).click();
  await expect(anaCard).toContainText('Yes.');
  await expect(anaCard).toContainText('edited');
  await anaCard.getByRole('button', { name: 'Delete' }).click();
  await expect(anaCard).toContainText('Reply deleted.');
  await anaCard.getByRole('button', { name: 'Undo' }).click();
  await expect(anaCard).toContainText('Yes.');

  // Your comment: an empty edit is refused, Esc cancels, Delete leaves Undo, and the open count follows.
  await page.getByRole('button', { name: 'Comment on row 3' }).click();
  await page.getByLabel('Comment', { exact: true }).fill('Too fsat?');
  await page.getByRole('form', { name: 'New comment' }).getByRole('button', { name: 'Add comment' }).click();
  const mine = page.getByRole('article', { name: 'Comment by Sam' });
  await mine.getByRole('button', { name: 'Edit' }).click();
  await mine.getByLabel('Edit comment').fill(' ');
  await mine.getByRole('button', { name: 'Save' }).click();
  await expect(mine.getByRole('alert')).toHaveText('Write something first, or Delete it.');
  await mine.getByLabel('Edit comment').press('Escape');
  await expect(mine).toContainText('Too fsat?');
  await mine.getByRole('button', { name: 'Edit' }).click();
  await mine.getByLabel('Edit comment').fill('Too fast?');
  await mine.getByRole('button', { name: 'Save' }).click();
  await expect(mine).toContainText('Too fast?');
  await expect(page.getByRole('heading', { name: 'Open · 2' })).toBeVisible();
  await mine.getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText('Comment deleted.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Open · 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(mine).toContainText('Too fast?');

  // Your suggestion: Edit changes the new words; once accepted, Edit and Delete go away.
  await suggestOn(page, 'Dialogue, row 3', 'catch', 'grab');
  const suggestion = page.getByRole('article', { name: 'Suggestion by Sam' });
  await suggestion.getByRole('button', { name: 'Edit' }).click();
  await suggestion.getByLabel('Replace with').fill('absorb');
  await suggestion.getByRole('button', { name: 'Save' }).click();
  await expect(suggestion).toContainText('Replace “catch” with “absorb”.');
  await suggestion.getByRole('button', { name: 'Accept' }).click();
  await expect(page.getByLabel('Dialogue, row 3')).toContainText('chloroplasts absorb the light');
  await expect(suggestion.getByRole('button', { name: 'Edit' })).toHaveCount(0);

  // Each change is a new file; nothing was rewritten.
  const files = await Promise.all((await listFiles(page, COMMENTS)).map(async (f) => JSON.parse(await readFile(page, `${COMMENTS}/${f}`))));
  expect(files.filter((f) => f.kind === 'edit').map((f) => f.text ?? f.replace).sort()).toEqual(['Too fast?', 'Yes.', 'absorb']);
  expect(files.filter((f) => f.kind === 'delete')).toHaveLength(2);
  expect(files.filter((f) => f.kind === 'undelete')).toHaveLength(2);
  expect(files.find((f) => f.kind === 'reply').text).toBe('Yse.');
});

test('rows changed since the last review are marked; the reviewer can show the edits, fold the rest or turn it off (RV-4)', async ({ page }) => {
  // When Ana sent it back: row 3 said "grab", row 4 wasn't written yet, and a row after row 2 has since gone.
  const before = example
    .replace('chloroplasts catch the light', 'chloroplasts grab the light')
    .replace(/## 4 <!-- id: b6n0w -->[\s\S]*?(?=# Wrap-up)/, '')
    .replace('# Inside the leaf', '## 6 <!-- id: gone1 -->\nDialogue:\nChlorophyll is what makes leaves green.\n\n# Inside the leaf');
  const sentBack = JSON.stringify({ v: 1, id: 'back0000', parents: [], who: 'Ana', when: '2026-11-10T09:12:00Z', kind: 'review', note: 'Sent back to writer', sha256: '', text: before });
  await openReview(page, { ...ALL_FILES, 'Episode 03/.studio/versions/20261110T091200Z_back0000.json': sentBack });
  const bar = page.getByRole('group', { name: "What's changed" });
  await expect(bar).toContainText('2 rows changed · 1 row removed since Ana sent it back');
  await expect(page.getByText('Changed', { exact: true })).toHaveCount(1);
  await expect(page.getByText('New', { exact: true })).toHaveCount(1);
  await expect(page.getByText('Chlorophyll is what makes leaves green.')).toBeVisible();
  // Show the edits: the old words struck through above the new, only in the field that changed.
  await expect(page.getByLabel('Dialogue before, row 3')).toHaveCount(0);
  await bar.getByLabel('Show the edits').check();
  await expect(page.getByLabel('Dialogue before, row 3')).toContainText('chloroplasts grab the light');
  await expect(page.getByLabel('On screen before, row 3')).toHaveCount(0);
  // Only changed rows: each run of unchanged rows is one line.
  await bar.getByLabel('Only changed rows').check();
  await expect(page.getByText('Rows 1–2 unchanged')).toBeVisible();
  await expect(page.getByText('Row 5 unchanged')).toBeVisible();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveCount(0);
  await expect(page.getByLabel('Dialogue, row 4')).toBeVisible();
  // Turned off: no marks, and it stays off after a reload (Show the edits is remembered too).
  await bar.getByLabel("What's changed").uncheck();
  await expect(bar).toContainText('Off: the script shows as it is');
  await expect(page.getByText('Changed', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: /^Review/ }).click();
  await expect(bar.getByLabel("What's changed")).not.toBeChecked();
  await bar.getByLabel("What's changed").check();
  await expect(bar.getByLabel('Show the edits')).toBeChecked();
  await expect(bar.getByLabel('Only changed rows')).not.toBeChecked();
  await expect(page.getByLabel('Dialogue before, row 3')).toBeVisible();
  // Approving ends the review: the marks start again from here.
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(bar).toContainText('Nothing changed since Sam approved it');
  await expect(page.getByText('Changed', { exact: true })).toHaveCount(0);
  await expect(bar.getByLabel('Show the edits')).toHaveCount(0);
});

test('a first review marks nothing (RV-4)', async ({ page }) => {
  await openReview(page);
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await expect(page.getByRole('group', { name: "What's changed" })).toHaveCount(0);
});
