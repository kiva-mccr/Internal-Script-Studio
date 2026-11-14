# `src/screens/SelectionComment.svelte`

The small dark Comment button just above words selected in Review (RV-22, board 56). Selecting only shows it; the
comment box opens when it is pressed (`onComment`), so a double-click or selecting to copy starts nothing.

- **Used by:** `Review.svelte` (calls `look` on a cell's `mouseup`). **Tests:** `tests/e2e/review.spec.ts`,
  `tests/e2e/attach.spec.ts`.

## Rules and pitfalls

- Placed inside Review's `.script` (`position: relative`), from the selection's last line box, and kept 48 px inside
  its edges; it scrolls with the script.
- `mousedown` is prevented, or pressing it would clear the selection (and the button) before the click.
- It goes when the selection does (`selectionchange` with nothing selected) or on Esc. A selection across two cells
  shows nothing.
- Its name is "Comment on the selected words": the compose box's switch already has a "Comment" button.
