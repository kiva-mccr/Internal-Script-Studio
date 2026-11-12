# `src/screens/Review.svelte`

The Review screen (mock-up 4): the script to read, and open comments beside it. Select text in a cell, or use
Comment on a row, to write a comment, or select text to suggest a change; reply, resolve and reopen comments; accept or reject
suggestions, with Undo. Approve / Send back (RV-3) are in `Header.svelte`.

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
- A section's read time (AP-12) sits at the right of its title, as in Write.
