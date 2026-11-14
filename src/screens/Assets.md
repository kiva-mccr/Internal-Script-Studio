# `src/screens/Assets.svelte`

The Assets tab (EX-6, board 12): every file, link and "still to find" note in the script, grouped by what needs
doing (missing, still to find, in the folder or linked) or by row under the section names. A row number goes to
that row in Write; a name opens the file or link.

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/e2e/assets.spec.ts`.

## Rules and pitfalls

- It is given `missing` by the Editor, which keeps it up to date, so the list and the tab's count always agree.
- "Order" is remembered in this browser (`assets-order`).
- Thumbnails (AP-19) are pictures, TIFFs, a PDF's page 1 or a video's still (AP-39), never a player, from the folder, as blob URLs
  revoked when the list changes; one that won't draw or play is hidden. Sound and text get none here.
- Text after an `{#if}` loses its leading space in Svelte: the " · " separators are written as strings.
