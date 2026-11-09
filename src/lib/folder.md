# `src/lib/folder.ts`

Everything read or written inside the picked folder: the list of scripts, one script's `script.md`, a new script,
and the files in its `assets/`.

- **Used by:** `screens/List.svelte`, `screens/Editor.svelte`, `screens/FilesCell.svelte`. **Tests:**
  `tests/unit/folder.test.ts`, and the e2e tests through the stand-in folder (`tests/e2e/folder.ts`).

## Rules and pitfalls

- Names are checked case-blind (Windows and OneDrive treat `Trailer` and `trailer` as the same folder) and lose
  the characters OneDrive refuses (`safeName`).
- A file picked for a row is copied into `assets/`, never moved; a name already there gets " 2", " 3" …
