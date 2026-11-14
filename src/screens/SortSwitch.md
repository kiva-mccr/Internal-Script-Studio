# `src/screens/SortSwitch.svelte`

The "Sort Line · Time · Type" switch above the comment lists (RV-16, board 55). Sorting itself is `lib/commentsort.ts`.

- **Used by:** `Review.svelte` (beside "Open · n"), `Comments.svelte` (top of Write's Comments tab).
  **Tests:** `tests/e2e/comments.spec.ts`.

## Rules and pitfalls

- `sort` is bound; a click also keeps it (`comment-sort`), so the other screen opens with the same choice.
- Buttons with `aria-pressed`, like the panel's Planning · Comments switch; tests find them by name in the
  "Sort comments" group.
