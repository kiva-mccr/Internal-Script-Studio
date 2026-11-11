import { expect, test } from '@playwright/test';
import { fakeFolder, setUp } from './folder';

test('asks for a name and the folder, then remembers both', async ({ page }) => {
  await setUp(page);
  await expect(page.getByText('Video Scripts')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Video Scripts')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Choose folder' })).toHaveCount(0);
});

test('needs a name before choosing the folder', async ({ page }) => {
  await fakeFolder(page);
  await page.goto('./');
  await page.getByRole('button', { name: 'Choose folder' }).click();
  await expect(page.getByRole('heading', { name: 'Open your scripts folder' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveText('Type your name first.');
  await expect(page.getByLabel('Your name')).toBeFocused();
});

test('the first line does not name OneDrive', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.lead')).toHaveText(/^Pick the shared folder your team keeps scripts in\./);
});

test('shows the OneDrive steps', async ({ page }) => {
  await page.goto('./');
  await page.getByText('Before you start').click();
  await expect(page.getByText('Add shortcut to My files')).toBeVisible();
});

test('closing the picker leaves you on the screen', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { showDirectoryPicker: () => Promise<never> }).showDirectoryPicker = async () => {
      throw new DOMException('closed', 'AbortError');
    };
  });
  await page.goto('./');
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'Choose folder' }).click();
  await expect(page.getByRole('heading', { name: 'Open your scripts folder' })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('a folder that fails to open says so plainly', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { showDirectoryPicker: () => Promise<never> }).showDirectoryPicker = async () => {
      throw new DOMException('system folder', 'SecurityError');
    };
  });
  await page.goto('./');
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'Choose folder' }).click();
  await expect(page.getByRole('alert')).toHaveText(/couldn't be opened/);
});

test('when the browser asks again, one click reopens the folder', async ({ page }) => {
  await setUp(page);
  await expect(page.getByText('Video Scripts')).toBeVisible();
  await page.addInitScript(() => {
    const proto = FileSystemHandle.prototype as unknown as Record<string, () => Promise<string>>;
    proto.queryPermission = async () => 'prompt';
    proto.requestPermission = async () => 'granted';
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Welcome back, Sam' })).toBeVisible();
  await page.getByRole('button', { name: 'Open Video Scripts' }).click();
  await expect(page.getByRole('button', { name: 'Change folder' })).toBeVisible();
});

test('change folder goes back to the first-time screen', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'Change folder' }).click();
  await expect(page.getByLabel('Your name')).toHaveValue('Sam');
});

test('other browsers are told to use Chrome or Edge', async ({ page }) => {
  await page.addInitScript(() => delete (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker);
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Open this in Chrome or Edge' })).toBeVisible();
});
