# `src/lib/remember.ts`

What the browser remembers between visits: your name (localStorage) and the picked folder (IndexedDB). Also the
browser check, the folder picker and the permission calls. `recall` and `keep`: small choices (Print's, the
teleprompter's, the Write screen's folded columns, the microphone in Settings) in localStorage.

- **Used by:** `App.svelte`, `lib/example.ts`, `screens/Setup.svelte`, `screens/Header.svelte`, `screens/Teleprompter.svelte`, `screens/Write.svelte`. **Tests:** `tests/unit/remember.test.ts`,
  `tests/e2e/setup.spec.ts`.

## Rules and pitfalls

- A folder handle can only be stored in IndexedDB, never as text.
- The Chromium used for tests here crashes when it reads a folder handle back out of IndexedDB. The e2e tests
  swap that for the folder's name (`tests/e2e/folder.ts`); the real round trip is only confirmed in real Chrome.
- After a browser restart Chrome may ask for permission again (`hasAccess` false): that is the "Welcome back"
  screen, not the first-time one.
