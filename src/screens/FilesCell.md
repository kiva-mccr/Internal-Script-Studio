# `src/screens/FilesCell.svelte`

A row's "Images & files" column: a chip for each line (a file in the script's folder opens in a new tab, a link
opens its page, plain words are shown in italics), × to remove, and + Add (choose a file, paste a link, or
describe something still to find, or pick from other scripts: `SharedFiles.svelte`, AS-1). Files in the folder show a preview above their chip (`Preview.svelte`, AP-19:
picture, PDF page 1, video, sound, first lines of text or Word); linked images show a thumbnail. Files with no
preview get their kind and size on the chip.

- **Used by:** `screens/WriteRow.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `shared.spec.ts`, `previews.spec.ts`.

## Rules and pitfalls

- Previews (`lib/preview.ts`) are made from the folder's files, their blob URLs revoked when the row's files change
  or it closes. A file that is missing or not really its kind shows no preview, only its chip. A picture that won't
  draw just hides (no kind on the chip); a video or sound that won't play falls back to the chip with kind and size.
- A file that is not there (still syncing, or renamed) gives a plain message, not an error.
- "From Sam's comment" (`came`, RV-12) works like "Copied from …".
- "Copied from …" under a chip is only kept while the cell is shown; the script does not record where a file came from.
