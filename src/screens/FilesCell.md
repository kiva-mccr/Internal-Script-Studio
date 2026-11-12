# `src/screens/FilesCell.svelte`

A row's "Images & files" column: a chip for each line (a file in the script's folder opens in a new tab, a link
opens its page, plain words are shown in italics), × to remove, and + Add (choose a file, paste a link, or
describe something still to find, or pick from other scripts: `SharedFiles.svelte`, AS-1). Images (a file in the folder, or a link ending in an image type) show a
thumbnail above their chip; clicking it opens the image.

- **Used by:** `screens/Write.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `shared.spec.ts`.

## Rules and pitfalls

- Thumbnails are blob URLs made from the folder's files and revoked when the row's files change or it closes.
  A file that is missing or not a real image shows no thumbnail, only its chip.
- A file that is not there (still syncing, or renamed) gives a plain message, not an error.
- "Copied from …" under a chip is only kept while the cell is shown; the script does not record where a file came from.
