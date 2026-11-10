// What the browser remembers between visits: your name (localStorage) and the picked folder (IndexedDB, because
// a folder handle cannot be turned into text). Nothing here is ever written into the shared folder.

const NAME_KEY = 'studio.name';
const DB = 'script-studio';
const STORE = 'remembered';
const MODE = { mode: 'readwrite' } as const;

// Chrome and Edge have these; TypeScript's DOM types do not yet.
type Folder = FileSystemDirectoryHandle & {
  queryPermission(options: typeof MODE): Promise<PermissionState>;
  requestPermission(options: typeof MODE): Promise<PermissionState>;
};
type Picker = (options: { id: string; mode: 'readwrite' }) => Promise<FileSystemDirectoryHandle>;

// Only Chrome and Edge on a computer can open a folder (Safari, Firefox and phones cannot).
export function canOpenFolders(win: object = window): boolean {
  return 'showDirectoryPicker' in win;
}

export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

export function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, cleanName(name));
  } catch {
    // Storage blocked: the name lasts for this visit only.
  }
}

// The browser's folder picker. Null when the person closes it without picking.
export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as unknown as { showDirectoryPicker: Picker }).showDirectoryPicker;
  try {
    return await picker({ id: 'scripts', mode: 'readwrite' });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return null;
    throw error;
  }
}

// Whether the remembered folder can be used without asking. After a browser restart Chrome may ask again.
export async function hasAccess(folder: FileSystemDirectoryHandle): Promise<boolean> {
  return (await (folder as Folder).queryPermission(MODE)) === 'granted';
}

// Must run from a click: the browser shows "Allow this site to edit files?".
export async function askAccess(folder: FileSystemDirectoryHandle): Promise<boolean> {
  return (await (folder as Folder).requestPermission(MODE)) === 'granted';
}

export async function saveFolder(folder: FileSystemDirectoryHandle): Promise<void> {
  await done((await store('readwrite')).put(folder, 'folder'));
}

export async function loadFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return ((await done((await store('readonly')).get('folder'))) as FileSystemDirectoryHandle) ?? null;
  } catch {
    return null;
  }
}

function store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onsuccess = () => resolve(open.result.transaction(STORE, mode).objectStore(STORE));
    open.onerror = () => reject(open.error);
  });
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// A small choice kept in this browser (Print's choices, the teleprompter's speed …), or '' when there is none.
// A private window may refuse storage: then nothing is kept and the app goes on.
export function recall(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

export function keep(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not kept: the choice still works for now.
  }
}
