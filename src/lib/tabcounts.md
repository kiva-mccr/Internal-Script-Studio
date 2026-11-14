# `src/lib/tabcounts.ts`

Tab counts that show what's new for you (RV-21, board 57). Review's number: the rows others changed since the
script was last sent back, while it is in review. Write's number: others' open comments and suggestions made since
it was sent for review, once it is sent back. Each counts only what is new since this person last had that tab
open on this computer (`seenKey`, localStorage).

- **Used by:** `screens/Editor.svelte` (shown by `screens/Header.svelte`).
  **Tests:** `tests/unit/tabcounts.test.ts`, `tests/e2e/tabcounts.spec.ts`.

## Rules and pitfalls

- Review's rows are `sinceVisit` (lib/visit.ts) from the later of the round's end (`reviewEnd`, as RV-4) and the
  last look, so they are the rows "What's changed" marks; a removed row counts. A first review shows nothing.
- Your own edits and comments never count. Replies, resolves, held and resolved comments don't either.
- Seen times are whole seconds (`stamp`), like History's, because versions are compared with them as text; notes
  (milliseconds) are compared with `Date.parse`.
- Nothing goes in the shared folder: a new computer starts from the round's full count.
- Times come from each person's own clock: a computer whose clock is off can shift what counts.
