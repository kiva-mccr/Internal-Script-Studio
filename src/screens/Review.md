# `src/screens/Review.svelte`

The Review screen (mock-up 4): the script to read, and open comments beside it. Select text in a cell and press its
small Comment button (RV-22, `SelectionComment.svelte`), or use Comment on a row, to write a comment, or select text to suggest a change; reply, resolve and reopen comments; accept or reject
suggestions, with Undo. Edit and Delete your own (RV-7, mock-up 24). The cards are `CommentCard.svelte`, shared with Write's
Comments tab (RV-13). Approve / Send back (RV-3) are in `Header.svelte`.

- **Used by:** `Editor.svelte` (the Write · Review · History switch). **Tests:** `tests/e2e/review.spec.ts`, `play.spec.ts` (AU-9).

## Rules and pitfalls

- Each card carries `data-id` (the comment's id): the list before Approve (RV-5) finds it by that.
- What's changed (RV-4, mock-up 28): rows changed since `reviewedAt` (the last Sent back or Approved, from
  `Editor.svelte`) get `.changed` and a "Changed"/"New" tag; removed rows a grey line after the row they followed.
  On by default; "What's changed" off and "Show the edits" are kept per computer (`review-changes`, `review-edits`),
  "Only changed rows" is not. Show the edits puts the old text in its own element above the cell, never inside it,
  so quotes and highlights still match the cell. The highlights effect reruns on each toggle (the cells are redrawn).
- Read only: editing happens in Write. Comments come from `Editor.svelte`, which reloads them every 5 s.
- A selection counts only if it starts and ends inside one cell (`mouseup` on the cell). Selecting never opens the
  box by itself (RV-22): it only shows the Comment button (`SelectionComment.svelte`), so a double-click or selecting
  to copy starts nothing. `.script` is `position: relative` for that button.
- Images & files shows names, as Write does, so a quote there is of the name.
- Cells show formatting (`lib/format.ts`), so a quote is of the text as it reads, marks taken out. Quotes are
  marked with CSS highlights (`CSS.highlights`, Chrome and Edge), not by changing the page; tests read them there.
  Their colours are in `app.css`, shared with Write (RV-13).
- Accepting goes through `Editor.svelte` (`onApply`): the quote is replaced in Write's text, then saved as usual. It
  only works if the quote is there as typed (not across formatting marks); otherwise a message, nothing changed.
- A suggestion decided here stays in the open list with Undo until the screen is left (`recent`).
- On hold (RV-19): Put on hold keeps the card with Undo for 5 seconds (`holding`, a `Linger`), then it slides into
  "On hold · n" between the open cards and Resolved. "Open · n" leaves held ones out. Every card is in a `.slot`
  wrapper carrying `out:slideAway`.
- No browser dialogs: an empty comment shows "Write a comment first." in the form.
- Edit and Delete show only when `who` is `me` (the name in Settings) and the thread is open. A deleted one stays
  in place as "… deleted. Undo" while its id is in `gone`, which empties when Review is left. While a card's own
  edit box is open its other actions are hidden (the aside is narrow; they wrapped).
- Files on comments (RV-11): the comment, reply and edit boxes are wrapped in `AttachBox.svelte`; a suggestion
  (and its edit box) has none, and switching to Suggest a change drops any picked files. A comment or reply may be
  only files. Cards show them with `Attached.svelte`. Snippets in the boxes are named `typing`, not `text`: `text`
  is already the cell-text function here.
- A section's read time (AP-12) sits at the right of its title, as in Write.
- The note sent for review (RV-8) shows at the top (`sent`, read by `Editor.svelte` from History while the script is
  in review); Hide folds it to a "Sam's note" button until Review is left.
- Takes and Play the script (AU-9, board 36): only to listen. The take line is `Take.svelte` with no `onCurrent` or
  `onDrop` (no × on Outdated, no delete); no mic. The Editor's `Player` and `VoiceOver` are shared with Write, so
  Play carries on across the switch. The number button is `.playfrom`, not `.from`: `.sent .from` is the note's line.
  The row carries `data-play` for the page to follow it; `data-row` is the cells' (the highlights look them up).
- Flagged rows (AP-9) show their note under the row, with no buttons: flags are set and cleared in Write.
- Changed since you last looked (RV-15): with no `reviewedAt` the Editor passes `visit`, and its marks are drawn as
  RV-4's (`marks`), plus who and ✓ Seen under the tag. Show the edits then follows the Editor's bar (`edits`), not
  Review's own tick. The bar itself is the Editor's (`VisitBar.svelte`), so the RV-4 bar and it never show together.
