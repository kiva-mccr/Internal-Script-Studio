# `src/lib/linger.svelte.ts`

`Linger`: the ids of cards kept in place with Undo for 5 seconds (RV-18: decided or resolved in Write; RV-19: put on
hold, in Write and Review), each on its own timer, then let go so the card moves into Resolved or On hold.

- **Used by:** `screens/Comments.svelte`, `screens/ReviewComments.svelte`. **Tests:** `tests/e2e/comments.spec.ts` (RV-18),
  `tests/e2e/hold.spec.ts`.

## Rules and pitfalls

- Adding the same id again restarts its wait. Call `clear()` when the screen unmounts, or a timer fires after it.
- Tests drive the wait with `page.clock`.
