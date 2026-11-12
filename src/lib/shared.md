# `src/lib/shared.ts`

The shared asset browser (AS-1, board 29): `sharedFiles` lists every other script's files (what is in its `assets/`
folder, then the links its rows use), with how many rows use each; `copyShared` gives the line to add to a row,
copying a file into this script's `assets/` first.

- **Used by:** `screens/SharedFiles.svelte`. **Tests:** `tests/e2e/shared.spec.ts`.

## Rules and pitfalls

- Reuse copies, never points at the other script's file: a script stays whole when the other is renamed or deleted
  (the user's choice on board 29). The copy goes through `addAsset`, so a name already there gets " 2".
- "To find" notes are left out; a script with no files is left out; one that can't be read is skipped quietly.
- Only the top of `assets/` is listed (no subfolders), and only scripts at the top of the picked folder, as `listScripts`.
- This script is skipped by its folder name, compared case-blind.
