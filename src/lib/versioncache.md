# `src/lib/versioncache.ts`

History files are written once and never changed, so `listVersions` (lib/history.ts) reads each one only once
(HI-3): kept in memory for this visit (per script folder, by file name) and in this browser's IndexedDB
(`script-studio-history`) for later visits. Nothing is written to the shared folder.

- **Used by:** `lib/history.ts`. **Tests:** `tests/unit/versioncache.test.ts`, `tests/e2e/history.spec.ts`.

## Rules and pitfalls

- The browser's key is the file's name, size and time (`fileKey`): test scripts reuse short ids across scripts,
  so the name alone could mix two scripts' files. Memory is per folder handle, so the name is enough there.
- Only whole, readable versions are kept: a half-synced file is read again next time.
- Storage refused (a private window) or missing (unit tests run in Node): nothing is kept and the files are read.
- A first visit on a computer still reads every file; only "chapters" (index files, left for later in HI-3) would
  change that.
