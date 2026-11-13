import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { listFiles, readFile, setUp, writeFile } from './folder';

const example = readFileSync('docs/example/Episode 03 - How Photosynthesis Works/script.md', 'utf8');
const SCRIPT = 'Episode 03/script.md';
const VERSIONS = 'Episode 03/.studio/versions';

async function openExample(page: Page) {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
}

const versions = (page: Page) => page.getByRole('navigation', { name: 'Versions' }).getByRole('button');

test('History lists each version with who and what changed', async ({ page }) => {
  await openExample(page);
  await expect.poll(() => listFiles(page, VERSIONS)).toHaveLength(1); // "History starts here"
  await page.getByLabel('On screen, row 1').fill('Wide shot of a forest.');
  await page.getByRole('button', { name: 'History' }).click();
  await expect(versions(page)).toHaveCount(2);
  await expect(versions(page).first()).toContainText('Edited row 1');
  await expect(versions(page).first()).toContainText(/Sam · Today, /);
  await expect(versions(page).last()).toContainText('History starts here');
  const change = page.getByRole('region', { name: 'Changes' });
  await expect(change).toContainText('Row 1 · On screen');
  await expect(change).toContainText('Slow push-in on a sunlit leaf.');
  await expect(change).toContainText('Wide shot of a forest.');
  await expect(page.getByRole('button', { name: 'Restore this version' })).toHaveCount(0); // the current one
});

test('an earlier version can be restored, and the restore is in History', async ({ page }) => {
  await openExample(page);
  await page.getByLabel('Dialogue, row 1').fill('A different opening.');
  await page.getByRole('button', { name: 'History' }).click();
  await versions(page).last().click();
  await page.getByRole('button', { name: 'Restore this version' }).click();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf you have ever seen is running a tiny factory.');
  expect(await readFile(page, SCRIPT)).toBe(example);
  await page.getByRole('button', { name: 'History' }).click();
  await expect(versions(page)).toHaveCount(3);
  await expect(versions(page).first()).toContainText(/Restored the version from \w{3} \d+, \d{4}/);
});

test('saves inside five minutes share one entry; after five minutes a new one is made', async ({ page }) => {
  await page.clock.install();
  await openExample(page);
  await page.getByLabel('Dialogue, row 1').fill('One.');
  await expect(page.getByRole('status')).toHaveText('Saved');
  await page.getByLabel('Dialogue, row 1').fill('Two.');
  await expect(page.getByRole('status')).toHaveText('Saved');
  expect(await listFiles(page, VERSIONS)).toHaveLength(1);
  await page.clock.fastForward('05:01');
  await page.getByLabel('Dialogue, row 1').fill('Three.');
  await expect(page.getByRole('status')).toHaveText('Saved');
  await expect.poll(() => listFiles(page, VERSIONS)).toHaveLength(2);
});

test('a change made outside the app gets its own entry', async ({ page }) => {
  await openExample(page);
  await page.getByRole('link', { name: 'Video Scripts' }).click();
  await writeFile(page, SCRIPT, example.replace('Slow push-in on a sunlit leaf.', 'Typed in Notepad.'));
  await page.getByRole('link', { name: /How Photosynthesis Works/ }).click();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(versions(page).first()).toContainText('Changed outside the app');
  await expect(versions(page).first()).toContainText('Outside the app ·');
  await expect(page.getByRole('region', { name: 'Changes' })).toContainText('Typed in Notepad.');
});

test('a new script starts its History, and the list says who edited last', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'New script' }).click();
  await page.getByLabel('Name of the new script').fill('Trailer');
  await page.getByRole('button', { name: 'Create' }).click();
  await page.getByRole('button', { name: 'History' }).click();
  await expect(versions(page)).toHaveCount(1);
  await expect(versions(page).first()).toContainText('Created the script');
  await page.getByRole('link', { name: 'Video Scripts' }).click();
  await expect(page.getByRole('link', { name: /Trailer/ })).toContainText('Sam · just now');
});

test('versions made in the same second stay in order', async ({ page }) => {
  await openExample(page);
  await expect.poll(() => listFiles(page, VERSIONS)).toHaveLength(1); // History has started: an edit before that gets no entry of its own
  await page.getByLabel('Dialogue, row 3').fill('First change.');
  await page.getByRole('button', { name: 'History' }).click();
  await page.getByRole('button', { name: 'Write' }).click();
  await page.getByLabel('On screen, row 1').fill('Second change.');
  await page.getByRole('button', { name: 'History' }).click();
  await expect(versions(page)).toHaveCount(3);
  await expect(versions(page).nth(0)).toContainText('Edited row 1');
  await expect(versions(page).nth(1)).toContainText('Edited row 3');
  await expect(versions(page).nth(2)).toContainText('History starts here');
});

test('an official version is published by name, and the small saves before it fold away', async ({ page }) => {
  await openExample(page);
  await page.getByLabel('On screen, row 1').fill('Wide shot of a forest.');
  await page.getByRole('button', { name: 'History' }).click();
  await page.getByRole('button', { name: 'Publish official version' }).click();
  const form = page.getByRole('form', { name: 'Publish official version' });
  await form.getByRole('button', { name: 'Publish v1' }).click();
  await expect(form.getByRole('alert')).toHaveText('Give it a name first.');
  await form.getByLabel('Name it').fill('First draft');
  await form.getByRole('button', { name: 'Publish v1' }).click();
  await expect(form).toHaveCount(0);
  await expect(versions(page).first()).toContainText('v1First draft');
  await expect(versions(page).first()).toContainText('Published by Sam ·');
  await expect(page.getByRole('heading', { name: 'v1 · First draft' })).toBeVisible();
  const fold = page.getByRole('button', { name: '2 changes before v1' });
  await expect(fold).toHaveAttribute('aria-expanded', 'false');
  await expect(versions(page)).toHaveCount(2); // v1 and the folded line
  await fold.click();
  await expect(versions(page).getByText('History starts here')).toBeVisible();
  // Files made in the same second sort by their random id, so the official one is found by its kind.
  const saved = await Promise.all((await listFiles(page, VERSIONS)).map(async (f) => JSON.parse(await readFile(page, `${VERSIONS}/${f}`))));
  expect(saved.filter((v) => v.kind === 'official')).toMatchObject([{ note: 'First draft', who: 'Sam' }]);
});

test('the next official version is compared with the one before it', async ({ page }) => {
  await openExample(page);
  const publish = async (name: string) => {
    await page.getByRole('button', { name: 'History' }).click();
    await page.getByRole('button', { name: 'Publish official version' }).click();
    await page.getByLabel('Name it').fill(name);
    await page.getByRole('button', { name: /^Publish v\d$/ }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`· ${name}$`) })).toBeVisible();
    await page.getByRole('button', { name: 'Write' }).click();
  };
  await publish('First draft');
  await page.getByLabel('On screen, row 1').fill('Wide shot of a forest.');
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByRole('button', { name: '1 change since v1' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'v1 · First draft' })).toBeVisible(); // opens on the newest official
  await page.getByRole('button', { name: 'Write' }).click();
  await publish('Sent to the narrator');
  await page.getByRole('button', { name: 'History' }).click();
  await expect(page.getByText(/changes compared with v1/)).toBeVisible();
  await expect(page.getByRole('region', { name: 'Changes' })).toContainText('Wide shot of a forest.');
});

test('Send for review makes the next official version, and none when nothing changed since (RV-9)', async ({ page }) => {
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example.replace('status: in review', 'status: draft') });
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  const panel = page.getByRole('region', { name: 'Send for review' });
  const send = async () => {
    await page.getByRole('button', { name: 'Send for review' }).click();
    await panel.getByRole('button', { name: 'Send for review' }).click();
    await expect(page.getByText('In review', { exact: true })).toBeVisible();
  };
  const backToDraft = async () => {
    await page.getByRole('button', { name: 'Review', exact: true }).click();
    await page.getByRole('button', { name: 'Send back to writer' }).click();
    await page.getByRole('region', { name: 'Send back to writer' }).getByRole('button', { name: 'Send back to writer' }).click();
    await page.getByRole('button', { name: 'Write', exact: true }).click();
  };
  const officials = async () => (await Promise.all((await listFiles(page, VERSIONS)).map(async (f) => JSON.parse(await readFile(page, `${VERSIONS}/${f}`)))))
    .filter((v) => v.kind === 'official' || v.official);

  // A first send: v1, named "Sent for review", with the note.
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(panel).toContainText('It becomes v1 in History.');
  await panel.getByLabel('A note for the reviewers').fill('Check row 1.');
  await panel.getByRole('button', { name: 'Send for review' }).click();
  await expect.poll(officials).toMatchObject([{ kind: 'review', official: true, note: 'Sent for review', message: 'Check row 1.' }]);

  // Sent back, then sent again with no changes: still v1, no new version.
  await backToDraft();
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(panel).toContainText('Still v1: nothing has changed since it.');
  await panel.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('In review', { exact: true })).toBeVisible();
  expect(await officials()).toHaveLength(1);

  // Published by hand, then sent with no changes: no duplicate either.
  await backToDraft();
  await page.getByLabel('On screen, row 1').fill('Wide shot of a forest.');
  await page.getByRole('button', { name: 'History' }).click();
  await page.getByRole('button', { name: 'Publish official version' }).click();
  await page.getByLabel('Name it').fill('For the narrator');
  await page.getByRole('button', { name: 'Publish v2' }).click();
  await expect(page.getByRole('heading', { name: 'v2 · For the narrator' })).toBeVisible();
  await page.getByRole('button', { name: 'Write', exact: true }).click();
  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(panel).toContainText('Still v2');
  await panel.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('In review', { exact: true })).toBeVisible();
  expect(await officials()).toHaveLength(2);

  // Changed, then sent: v3, one line in History, compared with v2.
  await backToDraft();
  await page.getByLabel('On screen, row 1').fill('Wide shot of a meadow.');
  await send();
  await expect.poll(async () => (await officials()).length).toBe(3);
  await page.getByRole('button', { name: 'History' }).click();
  await expect(versions(page).first()).toContainText('v3Sent for review');
  await expect(versions(page).first()).not.toContainText('Published by');
  await expect(page.getByRole('heading', { name: 'v3 · Sent for review' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Changes' })).toContainText('compared with v2');
  await expect(versions(page).getByText('Sent for review (still v2)')).toBeVisible();
});
