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
  await page.getByRole('button', { name: 'Delete row 6' }).click();
  await expect(page.getByText('Row 6 deleted.')).toBeVisible();
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

test('a link to a script that is not there says so', async ({ page }) => {
  await setUp(page, '#/Episode%2099');
  await expect(page.getByRole('heading', { name: 'No script called "Episode 99"' })).toBeVisible();
});

test('the save status sits beside the title, and the bar stays on one line at 1280 px with Play and a draft (AP-16)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await setUp(page, '#/Episode%2003', {
    'Episode 03/script.md': example.replace('status: in review', 'status: draft'), // shows Send for review, the widest
    'Episode 03/voice/row-k3f9a.json': JSON.stringify({ by: 'Alex', at: 1, seconds: 14, text: 'x' }),
  });
  await expect(page.getByRole('button', { name: 'Send for review' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play the script' })).toBeVisible();
  await expect(page.locator('header .voice')).toHaveText('1 of 5 · 0:14');
  await expect(page.locator('header .crumbs').getByRole('status')).toHaveText('Saved');
  const middles = await page.locator('header > *, header .right > *').evaluateAll((els) =>
    els.map((el) => { const r = el.getBoundingClientRect(); return r.top + r.height / 2; }));
  expect(Math.max(...middles) - Math.min(...middles)).toBeLessThan(2); // everything shares one line
  // The name stays readable: the bar wraps before the title shrinks to a stub.
  expect((await page.locator('header .title').boundingBox())!.width).toBeGreaterThan(100);
});

test('the column headings stay in view while scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await openExample(page);
  await page.mouse.wheel(0, 800);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
  const box = await page.locator('.head').boundingBox();
  expect(box?.y).toBeLessThan(5);
});

test('a delete can be undone, without any browser dialog', async ({ page }) => {
  page.on('dialog', () => {
    throw new Error('a browser dialog was shown');
  });
  await openExample(page);
  await page.getByRole('button', { name: 'Delete row 1' }).click();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue(/It needs three simple ingredients/);
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByLabel('Dialogue, row 1')).toHaveValue('Every leaf you have ever seen is running a tiny factory.');
  await saved(page);
  expect(await readFile(page, SCRIPT)).toBe(example);
});

test('images show a preview', async ({ page }) => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><rect width="80" height="40" fill="green"/></svg>';
  await setUp(page, '#/Episode%2003', { [SCRIPT]: example, 'Episode 03/assets/icons-ingredients.svg': svg });
  const thumb = page.getByRole('button', { name: 'Open icons-ingredients.svg' });
  await expect(thumb).toBeVisible();
  expect(await thumb.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(80);
  // A file that is missing, or not a real image, shows no preview.
  await expect(page.getByRole('button', { name: 'Open glucose-model.png' })).toHaveCount(0);
});

test('Export / Share holds Copy link above the exports; menus close on Esc or a click elsewhere', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openExample(page);
  const exportButton = page.getByRole('button', { name: 'Export / Share' });
  await exportButton.click();
  await expect(exportButton).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('.menu > button')).toHaveText(
    ['Copy link', 'Copy for Teams', 'Print…', 'Fountain (.fountain)', 'Final Draft (.fdx)', 'Voice-over (.wav)']);
  await expect(page.locator('.menu .group')).toHaveText(['Share', 'Export']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu')).toHaveCount(0);
  await exportButton.click();
  await page.getByLabel('Dialogue, row 1').click();
  await expect(page.locator('.menu')).toHaveCount(0);
  await exportButton.click();
  await page.getByRole('button', { name: 'Copy link' }).click();
  await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/#\/Episode%2003\?review$/);
  await expect(page.locator('.menu')).toHaveCount(0); // closes a moment later
});

test('a shared link opens the script on Review; the mark leaves the address, and a plain link opens Write', async ({ page }) => {
  await setUp(page, '#/Episode%2003?review', { 'Episode 03/script.md': example });
  await expect(page.getByRole('button', { name: /^Review/ })).toHaveAttribute('aria-current', 'page');
  expect(new URL(page.url()).hash).toBe('#/Episode%2003');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Write' })).toHaveAttribute('aria-current', 'page');
});

test('the ⋯ menu holds the Teleprompter; only one menu is open at a time', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'More' }).click();
  await expect(page.locator('.menu > button')).toHaveText(['Teleprompter']);
  await page.keyboard.press('Escape');
  await expect(page.locator('.menu')).toHaveCount(0);
});

test('Copy for Teams puts the title, status and facts on the clipboard, formatted and as plain text', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await openExample(page);
  await page.getByRole('button', { name: 'Export / Share' }).click();
  await page.getByRole('button', { name: 'Copy for Teams' }).click();
  await expect(page.getByRole('button', { name: 'Copied, paste it in Teams' })).toBeVisible();
  const [html, text] = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    return Promise.all(['text/html', 'text/plain'].map(async (type) => (await item.getType(type)).text()));
  });
  expect(html).toMatch(/<a href="[^"]*#\/Episode%2003\?review"><b>How Photosynthesis Works<\/b><\/a>/);
  expect(html).toContain('<b>In review</b>');
  expect(html).toContain('Open in Script Studio</a>');
  const lines = text.split('\n');
  expect(lines[0]).toBe('How Photosynthesis Works');
  expect(lines[1]).toMatch(/^In review · \d+ rows · \d+:\d\d read aloud$/);
  expect(lines.at(-1)).toMatch(/#\/Episode%2003\?review$/);
  await expect(page.locator('.menu')).toHaveCount(0);
});

test('Fountain downloads the script as a .fountain file named after it', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Export' }).click();
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Fountain (.fountain)' }).click()]);
  expect(file.suggestedFilename()).toBe('How Photosynthesis Works.fountain');
  const text = readFileSync(await file.path(), 'utf8');
  expect(text).toMatch(/^Title: How Photosynthesis Works\n/);
  expect(text).toContain('Draft date: Draft');
  expect(text).toContain('[[Row 1]]');
  expect(text).toContain('\nNARRATOR\n');
  await expect(page.locator('.menu')).toHaveCount(0);
});

test('Final Draft downloads the script as an .fdx file that is well-formed XML', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Export' }).click();
  const [file] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Final Draft (.fdx)' }).click()]);
  expect(file.suggestedFilename()).toBe('How Photosynthesis Works.fdx');
  const text = readFileSync(await file.path(), 'utf8');
  const parsed = await page.evaluate((xml) => {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    return { error: !!doc.querySelector('parsererror'), types: [...doc.querySelectorAll('Content > Paragraph')].map((p) => p.getAttribute('Type')) };
  }, text);
  expect(parsed.error).toBe(false);
  expect(parsed.types.slice(0, 5)).toEqual(['Scene Heading', 'General', 'Action', 'Character', 'Dialogue']);
  expect(text).toContain('<Text>Draft · In review · ');
});

test('columns fold away and come back, remembered in this browser', async ({ page }) => {
  await openExample(page);
  await page.getByRole('button', { name: 'Fold On screen away' }).click();
  await page.getByRole('button', { name: 'Fold Images & files away' }).click();
  await expect(page.getByLabel('On screen, row 1')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'leaf-closeup.jpg', exact: true })).toHaveCount(0);
  // A row with something in a folded column shows a dot; the dialogue takes the width.
  await expect(page.getByTitle('On screen has something here').first()).toBeVisible();
  const wide = (await page.getByLabel('Dialogue, row 1').boundingBox())!.width;
  expect(wide).toBeGreaterThan(700);
  // The last column open can't fold.
  await expect(page.getByRole('button', { name: 'Fold Dialogue away' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel('Dialogue, row 1')).toBeVisible();
  await expect(page.getByLabel('On screen, row 1')).toHaveCount(0);
  await page.getByRole('button', { name: 'Show On screen' }).click();
  await expect(page.getByLabel('On screen, row 1')).toHaveValue('Slow push-in on a sunlit leaf.');
  await expect(page.getByRole('button', { name: 'Fold Dialogue away' })).toBeVisible();
});

// Chrome and Edge take back the OK to edit the folder after a while in the background. The test's folder stands in:
// `lose()` makes the browser say "prompt" and refuse writes until Allow editing asks again.
async function fakeAccess(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { noAccess: boolean; asked: number };
    w.noAccess = false;
    w.asked = 0;
    const proto = FileSystemHandle.prototype as unknown as Record<string, (o: unknown) => Promise<string>>;
    proto.queryPermission = async () => (w.noAccess ? 'prompt' : 'granted');
    proto.requestPermission = async () => (w.asked++, (w.noAccess = false), 'granted');
    const write = FileSystemFileHandle.prototype.createWritable;
    FileSystemFileHandle.prototype.createWritable = function (...args) {
      if (w.noAccess) return Promise.reject(new DOMException('No access', 'NotAllowedError'));
      return write.apply(this, args);
    };
  });
}
const lose = (page: Page) => page.evaluate(() => ((window as unknown as { noAccess: boolean }).noAccess = true));

test('when the browser takes back access, a save waits for Allow editing and then saves what was typed', async ({ page }) => {
  await fakeAccess(page);
  await openExample(page);
  await lose(page);
  await page.getByLabel('Dialogue, row 1').fill('Typed after access ran out.');
  const status = page.getByRole('status');
  await expect(status).toHaveText('Not saved: the browser needs your OK to edit the folder', { timeout: 10000 });
  // More typing is kept in the page, and no retries pile up.
  await page.getByLabel('Dialogue, row 2').fill('And more.');
  await expect(status).toHaveText('Not saved: the browser needs your OK to edit the folder');
  expect(await readFile(page, SCRIPT)).toBe(example);
  await page.getByRole('button', { name: 'Allow editing' }).click();
  await saved(page);
  await expect(page.getByRole('button', { name: 'Allow editing' })).toHaveCount(0);
  const text = await readFile(page, SCRIPT);
  expect(text).toContain('Dialogue:\nTyped after access ran out.\n');
  expect(text).toContain('Dialogue:\nAnd more.\n');
});

test('lost access shows before a save fails, with the 5 s check', async ({ page }) => {
  await fakeAccess(page);
  await openExample(page);
  await lose(page);
  await expect(page.getByRole('button', { name: 'Allow editing' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Allow editing' }).click();
  await saved(page);
  expect(await page.evaluate(() => (window as unknown as { asked: number }).asked)).toBe(1);
});

test("a save that fails with access still there says Couldn't save and tries again", async ({ page }) => {
  await openExample(page);
  await page.evaluate(() => {
    const write = FileSystemFileHandle.prototype.createWritable;
    let fails = 1;
    FileSystemFileHandle.prototype.createWritable = function (...args) {
      if (this.name === 'script.md' && fails-- > 0) return Promise.reject(new DOMException('Busy', 'NoModificationAllowedError'));
      return write.apply(this, args);
    };
  });
  await page.getByLabel('Dialogue, row 1').fill('Saved on the second try.');
  await expect(page.getByRole('status')).toHaveText("Couldn't save, trying again", { timeout: 10000 });
  await saved(page);
  expect(await readFile(page, SCRIPT)).toContain('Dialogue:\nSaved on the second try.\n');
});

test('a new section starts with a stand-in, goes after the box in use, and an emptied one goes only on leaving it (AP-22)', async ({ page }) => {
  await openExample(page);
  const titles = page.getByLabel('Section title');
  // No box in use: at the end, empty with a grey stand-in, and the cursor in it.
  await page.getByRole('button', { name: '+ Add section' }).click();
  await expect(titles).toHaveCount(4);
  await expect(titles.nth(3)).toHaveValue('');
  await expect(titles.nth(3)).toHaveAttribute('placeholder', 'New section');
  await expect(titles.nth(3)).toBeFocused();
  await expect(page.getByLabel('Dialogue, row 6')).toBeVisible();
  // Still in it while empty: it stays, even after a save.
  await saved(page);
  await expect(titles).toHaveCount(4);
  expect(await readFile(page, SCRIPT)).not.toMatch(/^# *$/m);
  // Leaving it removes it.
  await page.getByLabel('Dialogue, row 1').click();
  await expect(titles).toHaveCount(3);
  // In row 1's dialogue: right after row 1, taking the rows that follow (no extra row).
  await page.getByRole('button', { name: '+ Add section' }).click();
  await expect(titles).toHaveCount(4);
  await page.keyboard.type('Why leaves are green');
  await saved(page);
  const text = await readFile(page, SCRIPT);
  expect(text.indexOf('# Why leaves are green')).toBeGreaterThan(text.indexOf('## 1 '));
  expect(text.indexOf('# Why leaves are green')).toBeLessThan(text.indexOf('## 2 '));
  expect(text.match(/^## /gm)).toHaveLength(6);
  // In a section's title: after that section's rows, just before the next section.
  await titles.nth(2).click();
  await page.getByRole('button', { name: '+ Add section' }).click();
  await page.keyboard.type('Recap');
  await expect.poll(() => titles.evaluateAll((all) => all.map((t) => (t as HTMLInputElement).value)))
    .toEqual(['Intro', 'Why leaves are green', 'Inside the leaf', 'Recap', 'Wrap-up']);
  // With a section next instead of rows, it gets an empty row to write in.
  await saved(page);
  expect((await readFile(page, SCRIPT)).match(/^## /gm)).toHaveLength(7);
});
