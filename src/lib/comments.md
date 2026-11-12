# `src/lib/comments.ts`

Review: comments, replies and resolving, one JSON file each in `.studio/comments/` (docs/studio-folder.md),
written once and never changed. Also gathers them into threads, and marks a comment's quote in its cell. Flags on
rows (AP-9) are kept here too (`flag`, `unflag`; `flags()` says which rows are flagged).

- **Used by:** `screens/Editor.svelte`, `screens/Review.svelte`. **Tests:** `tests/unit/comments.test.ts`,
  `tests/e2e/review.spec.ts`.

## Rules and pitfalls

- Resolve and reopen are new files about a comment; the newest counts. `when` keeps milliseconds, because a
  resolve and a reopen in the same second came out in a random order (bug found while building). File names keep
  seconds, like versions.
- Suggestions (`replace`) are threads too: the newest accept, reject or reopen about one decides it.
- A comment on a whole row has an empty `quote` (and `field` "dialogue").
- A quote is marked where it is first found in the cell; one no longer there is "on text that has since changed".
- A file that can't be read (half-synced) is skipped.
- Edit, delete and undelete (RV-7) count only when `who` is the author's. `threads()` returns copies with the
  newest text and `edited` (the time of the last edit); deleted ones are left out unless `withDeleted` (Review's
  Undo). `edited` and `deleted` are worked out, never written to a file.
- Flags: the newest `flag` or `unflag` about a row wins, by `when` (file names keep only seconds, so a flag and its
  note written in the same second sort at random by name; a test caught this). Flags are not threads.
