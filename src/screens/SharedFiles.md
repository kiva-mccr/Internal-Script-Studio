# `src/screens/SharedFiles.svelte`

Files from other scripts (AS-1, board 29): a window in the page, opened from "From other scripts…" in a row's + Add.
Every other script's files and links as tiles, grouped by script, newest edited first; Find narrows by name; pick one
and "Add to row N" (or double-click it) adds it to the row.

- **Used by:** `screens/FilesCell.svelte`. **Tests:** `tests/e2e/shared.spec.ts`.

## Rules and pitfalls

- Built like the Settings window: a backdrop in the page, Esc or × closes it, no browser dialogs.
- Thumbnails are blob URLs of images in other scripts' folders, revoked when the window closes; a linked image uses
  its link. One that won't draw is hidden and the tile is plain.
- A file that can't be copied (still syncing, removed) says so in the footer; the window stays open.
