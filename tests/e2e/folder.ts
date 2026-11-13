import type { Page } from '@playwright/test';

// The real folder picker can't be clicked in a test, so it is swapped for a folder in the browser's private
// storage (a real folder handle: it can be remembered and reopened like a OneDrive one). `files` maps paths inside
// the folder to their text; text starting "base64:" is written as the bytes it stands for.
export async function fakeFolder(page: Page, files: Record<string, string> = {}) {
  await rememberByName(page);
  await page.addInitScript((files) => {
    (window as unknown as { showDirectoryPicker: () => Promise<FileSystemDirectoryHandle> }).showDirectoryPicker =
      async () => {
        const root = await navigator.storage.getDirectory();
        const folder = await root.getDirectoryHandle('Video Scripts', { create: true });
        for (const [path, text] of Object.entries(files)) {
          const parts = path.split('/');
          let dir = folder;
          for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
          const writable = await (await dir.getFileHandle(parts.at(-1)!, { create: true })).createWritable();
          await writable.write(text.startsWith('base64:') ? Uint8Array.from(atob(text.slice(7)), (c) => c.charCodeAt(0)) : text);
          await writable.close();
        }
        return folder;
      };
  }, files);
}

// The Chromium used for tests crashes when it reads a folder handle back out of IndexedDB (real Chrome and Edge do
// not). So in tests the stored folder is its name in sessionStorage, which a reload keeps, and reading it back
// finds that folder again in private storage.
async function rememberByName(page: Page) {
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) {
      if (value instanceof FileSystemDirectoryHandle) {
        sessionStorage.setItem('test-folder', value.name);
        value = 'test-folder';
      }
      return put.call(this, value, key);
    };
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (key: IDBValidKey) {
      const request = get.call(this, key);
      if (key !== 'folder') return request;
      const fake = { result: undefined as unknown, error: null, onsuccess: null as null | (() => void), onerror: null };
      request.addEventListener('success', async () => {
        const name = sessionStorage.getItem('test-folder');
        fake.result = name ? await (await navigator.storage.getDirectory()).getDirectoryHandle(name) : undefined;
        fake.onsuccess?.();
      });
      return fake as unknown as IDBRequest;
    };
  });
}

// Goes through the first-time screen: name, then Choose folder.
export async function setUp(page: Page, hash = '', files: Record<string, string> = {}) {
  await fakeFolder(page, files);
  await page.goto('./' + hash);
  await page.getByLabel('Your name').fill('Sam');
  await page.getByRole('button', { name: 'Choose folder' }).click();
}

// Reads or writes a file in the stand-in folder, as another person's OneDrive would.
export async function readFile(page: Page, path: string): Promise<string> {
  return page.evaluate(async (path) => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Video Scripts');
    const parts = path.split('/');
    for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part);
    // While the app is saving the file, a read can fail (NotReadableError), and while the save closes the name is
    // briefly gone (NotFoundError): find the file again and try a moment later.
    for (let tries = 0; ; tries++) {
      try {
        return await (await (await dir.getFileHandle(parts.at(-1)!)).getFile()).text();
      } catch (e) {
        if (tries >= 40) throw e;
        await new Promise((r) => setTimeout(r, 50));
      }
    }
  }, path);
}

// Every JSON file in a folder of the stand-in folder, as parsed objects, in file-name order. A file the app is still
// writing is listed but empty (or half written, or briefly gone): this waits up to 3 s for each to be whole, then
// leaves out any that still isn't, so a count checked with expect.poll only passes once the files are complete.
export async function readJsonFiles<T = any>(page: Page, path: string): Promise<T[]> {
  return page.evaluate(async (path) => {
    let dir: FileSystemDirectoryHandle;
    try {
      dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Video Scripts');
      for (const part of path.split('/')) dir = await dir.getDirectoryHandle(part);
    } catch {
      return [];
    }
    const read = async (name: string) => {
      try {
        return JSON.parse(await (await (await dir.getFileHandle(name)).getFile()).text());
      } catch {
        return undefined;
      }
    };
    const names: string[] = [];
    for await (const name of dir.keys()) if (name.endsWith('.json')) names.push(name);
    names.sort();
    let found: unknown[] = [];
    for (let tries = 0; tries < 60; tries++) {
      found = await Promise.all(names.map(read));
      if (found.every((f) => f !== undefined)) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    return found.filter((f) => f !== undefined);
  }, path) as Promise<T[]>;
}

export async function writeFile(page: Page, path: string, text: string) {
  await page.evaluate(
    async ([path, text]) => {
      let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Video Scripts');
      const parts = path.split('/');
      for (const part of parts.slice(0, -1)) dir = await dir.getDirectoryHandle(part, { create: true });
      const writable = await (await dir.getFileHandle(parts.at(-1)!, { create: true })).createWritable();
      await writable.write(text);
      await writable.close();
    },
    [path, text],
  );
}

// The names of the files in a folder of the stand-in folder (empty if it isn't there).
export async function listFiles(page: Page, path: string): Promise<string[]> {
  return page.evaluate(async (path) => {
    try {
      let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle('Video Scripts');
      for (const part of path.split('/')) dir = await dir.getDirectoryHandle(part);
      const names: string[] = [];
      // A file being written shows as "name.crswap" until it is closed, then is gone: never list it.
      for await (const name of dir.keys()) if (!name.endsWith('.crswap')) names.push(name);
      return names.sort();
    } catch {
      return [];
    }
  }, path);
}
