# `src/screens/Review.svelte`

The Review screen (mock-up 4): the script to read, and open comments beside it. Select text in a cell, or use
Comment on a row, to write a comment; reply, resolve and reopen. Suggestions (RV-2) and Approve / Send back
(RV-3) are not built yet.

- **Used by:** `Editor.svelte` (the Write · Review · History switch). **Tests:** `tests/e2e/review.spec.ts`.

## Rules and pitfalls

- Read only: editing happens in Write. Comments come from `Editor.svelte`, which reloads them every 5 s.
- A selection counts only if it starts and ends inside one cell (`mouseup` on the cell).
- Images & files shows names, as Write does, so a quote there is of the name.
- Cells show formatting (`lib/format.ts`), so a quote is of the text as it reads, marks taken out. Quotes are
  marked with CSS highlights (`CSS.highlights`, Chrome and Edge), not by changing the page; tests read them there.
- No browser dialogs: an empty comment shows "Write a comment first." in the form.
