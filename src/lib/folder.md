# `src/lib/folder.ts`

Everything read or written inside the picked folder: the list of scripts, one script's `script.md`, a new script,
and the files in its `assets/`.

- **Used by:** `lib/scriptlist.svelte.ts`, `lib/people.ts`, `lib/shared.ts`, `screens/Editor.svelte`, `screens/FilesCell.svelte`. **Tests:**
  `tests/unit/folder.test.ts`, and the e2e tests through the stand-in folder (`tests/e2e/folder.ts`).

## Rules and pitfalls

- `readScript` and `writeScriptFile` try again quietly for about 5.5 s (`patiently`, `lib/files.ts`) before throwing.
  Only the keeper writes script.md (FX-2, `lib/saving.svelte.ts`).
- Names are checked case-blind (Windows and OneDrive treat `Trailer` and `trailer` as the same folder) and lose
  the characters OneDrive refuses (`safeName`).
- `isCopyOf` tells whether a Files line is a copy `addAsset` made of a file of that name (RV-12's "In row").
- A file picked for a row is copied into `assets/`, never moved; a name already there gets " 2", " 3" …
- `scriptHead` is one folder's line in the list (title, status, last edit, editor); `listScripts` is every folder's.
  The script list itself goes through `lib/scriptlist.svelte.ts` (AP-40), which calls `scriptHead` only for scripts
  the browser hasn't seen or whose files changed.
