# `src/screens/Review.svelte`

The Review screen (mock-up 4): the script to read, and open comments beside it. Select text in a cell, or use
Comment on a row, to write a comment, or select text to suggest a change; reply, resolve and reopen comments; accept or reject
suggestions, with Undo. Edit and Delete your own (RV-7, mock-up 24). Approve / Send back (RV-3) are in `Header.svelte`.

- **Used by:** `Editor.svelte` (the Write · Review · History switch). **Tests:** `tests/e2e/review.spec.ts`.

## Rules and pitfalls

- Each card carries `data-id` (the comment's id): the list before Approve (RV-5) finds it by that.
- Read only: editing happens in Write. Comments come from `Editor.svelte`, which reloads them every 5 s.
- A selection counts only if it starts and ends inside one cell (`mouseup` on the cell).
- Images & files shows names, as Write does, so a quote there is of the name.
- Cells show formatting (`lib/format.ts`), so a quote is of the text as it reads, marks taken out. Quotes are
  marked with CSS highlights (`CSS.highlights`, Chrome and Edge), not by changing the page; tests read them there.
- Accepting goes through `Editor.svelte` (`onApply`): the quote is replaced in Write's text, then saved as usual. It
  only works if the quote is there as typed (not across formatting marks); otherwise a message, nothing changed.
- A suggestion decided here stays in the open list with Undo until the screen is left (`recent`).
- No browser dialogs: an empty comment shows "Write a comment first." in the form.
- Edit and Delete show only when `who` is `me` (the name in Settings) and the thread is open. A deleted one stays
  in place as "… deleted. Undo" while its id is in `gone`, which empties when Review is left. While a card's own
  edit box is open its other actions are hidden (the aside is narrow; they wrapped).
- Files on comments (RV-11): the comment, reply and edit boxes are wrapped in `AttachBox.svelte`; a suggestion
  (and its edit box) has none, and switching to Suggest a change drops any picked files. A comment or reply may be
  only files. Cards show them with `Attached.svelte`. Snippets in the boxes are named `typing`, not `text`: `text`
  is already the cell-text function here.
- A section's read time (AP-12) sits at the right of its title, as in Write.
- Flagged rows (AP-9) show their note under the row, with no buttons: flags are set and cleared in Write.
