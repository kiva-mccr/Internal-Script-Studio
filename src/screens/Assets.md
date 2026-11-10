# `src/screens/Assets.svelte`

The Assets tab (EX-6, board 12): every file, link and "still to find" note in the script, grouped by what needs
doing (missing, still to find, in the folder or linked) or by row under the section names. A row number goes to
that row in Write; a name opens the file or link.

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/e2e/assets.spec.ts`.

## Rules and pitfalls

- It is given `missing` by the Editor, which keeps it up to date, so the list and the tab's count always agree.
- "Order" is remembered in this browser (`assets-order`).
- Thumbnails are blob URLs of images in the folder, revoked when the list changes; one that won't draw is hidden.
- Text after an `{#if}` loses its leading space in Svelte: the " · " separators are written as strings.
