# `src/screens/VisitBar.svelte`

The bar of "Changed since you last looked" (RV-15, board 45): "3 changes since Tuesday by Ana and Jo · 1 row
removed" (or "2 changes left" once a row is ticked Seen), ‹ › through the changed rows with "1 of 3", Show the edits
and Got it.

- **Used by:** `screens/Editor.svelte` (above Write, and above Review when it has no RV-4 round). **Tests:** `tests/e2e/visit.spec.ts`.

## Rules and pitfalls

- Stepping and Got it are the Editor's (`onStep`, `onDone`): the marks and the row stepped to live there, so they
  carry over between Write and Review.
- Svelte drops the space at the start of an `{#if}` block, so the " · " before "1 row removed" is `{' · '}`.
- With only removed rows, there is nothing to step to: the count says "1 row removed since …" and only Got it shows.
