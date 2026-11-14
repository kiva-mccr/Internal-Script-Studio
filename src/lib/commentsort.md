# `src/lib/commentsort.ts`

The order of the comment lists (RV-16, board 55): Line (the default), Time or Type. The switch is
`screens/SortSwitch.svelte`.

- **Used by:** `screens/Review.svelte`, `screens/Comments.svelte`. **Tests:** `tests/unit/commentsort.test.ts`,
  `tests/e2e/comments.spec.ts`.

## Rules and pitfalls

- Line: by row; within a row a comment on the whole row first, then comments on words in column order (Dialogue, On
  screen, Images & files) and by where the quote stands in the cell; a quote no longer found goes last in its cell,
  a deleted row's comments last of all. Ties keep `threads()`'s order (newest first).
- Time is `threads()`'s own order (newest first): nothing is sorted.
- Type: suggestions, comments on words, comments on a whole row (the user's order), each in line order. Only the open
  list shows the headings with counts; On hold and Resolved are sorted the same way without them.
- The choice is one `recall`/`keep` key (`comment-sort`) shared by Review and Write's Comments tab.
