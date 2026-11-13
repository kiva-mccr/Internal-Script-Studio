# `src/lib/visit.ts`

What changed since you last looked (RV-15, board 45): the rows other people changed since this person last opened
the script on this computer, each with who changed it last and when, worked out from History. Also the
localStorage key for the last visit, and names as a sentence ("Ana, Jo and Sam").

- **Used by:** `screens/Editor.svelte`, `screens/Write.svelte`, `screens/Review.svelte`, `screens/VisitBar.svelte`.
  **Tests:** `tests/unit/visit.test.ts`, `tests/e2e/visit.spec.ts`.

## Rules and pitfalls

- The last visit is kept per browser (never in the shared folder): a new computer, or a cleared browser, marks nothing.
- Compared with the newest version made at or before the last visit; none (History began later) marks nothing.
- Who: each version after the visit is compared with its first parent, the later one winning. A merge is skipped
  (its changes were made in the versions it joins, and crediting it would hide others' edits as the merger's own).
- A row whose last change was this person's own is left out, even from another computer; so is a row no version
  accounts for (better a missed mark than marking someone's own unsaved work).
- Rows are matched by id (`sinceReview`), so a moved row is not marked.
- Version times come from each person's own clock: a computer whose clock is off can shift what counts.
