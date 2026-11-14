# `src/lib/comments.ts`

Review: comments, replies and resolving, one JSON file each in `.studio/comments/` (docs/studio-folder.md),
written once and never changed. Also gathers them into threads, and marks a comment's quote in its cell. Flags on
rows (AP-9) are kept here too (`flag`, `unflag`; `flags()` says which rows are flagged).

- `fieldText` is what a cell shows (files by their names); `quoteGone` says a quote is no longer in its field
  ("on text that has since changed"), through `plain` (needs the page, so no unit test).
- **Used by:** `screens/Editor.svelte`, `screens/Review.svelte`, `screens/ReviewComments.svelte`, `screens/Comments.svelte`, `screens/CommentCard.svelte`, `lib/forme.ts`. **Tests:** `tests/unit/comments.test.ts`,
  `tests/e2e/review.spec.ts`.

## Rules and pitfalls

- Resolve and reopen are new files about a comment; the newest counts. `when` keeps milliseconds, because a
  resolve and a reopen in the same second came out in a random order (bug found while building). File names keep
  seconds, like versions.
- `by` on a thread is who resolved, accepted or rejected it (History shows it, RV-6); a reopen clears it.
- Suggestions (`replace`) are threads too: the newest accept, reject or reopen about one decides it.
- A comment on a whole row has an empty `quote` (and `field` "dialogue").
- A quote is marked where it is first found in the cell; one no longer there is "on text that has since changed".
- A file that can't be read (half-synced) is skipped.
- Edit, delete and undelete (RV-7) count only when `who` is the author's. `threads()` returns copies with the
  newest text and `edited` (the time of the last edit); deleted ones are left out unless `withDeleted` (Review's
  Undo). `edited` and `deleted` are worked out, never written to a file.
- Files on comments (RV-11): `addNote(dir, entry, now, attach)` copies the new files into
  `.studio/files/<note id>/` before writing the note, so a note never names a file that isn't there, and appends
  them to `entry.files`. Two with the same name in one note become "image.png" and "image 2.png" (pasted screenshots
  are all "image.png"). An edit's `files` is the whole new list; an edit without `files` keeps them. Files are never
  deleted. Note `safeName` strips leading dots, so the extension is cleaned separately.
- On hold (RV-19): `hold` sets `held` (who, when); any later resolve, reopen or decision ends it, a reply doesn't.
  `threads(notes, withDeleted, ends)` ends a hold made before one of `ends` (sends for review and official versions,
  `holdEnds` in `lib/history.ts`), and marks the thread `back` with who had held it. Nothing is written when it
  comes back. Callers without `ends` see every hold as still on.
- Flags: the newest `flag` or `unflag` about a row wins, by `when` (file names keep only seconds, so a flag and its
  note written in the same second sort at random by name; a test caught this). Flags are not threads.
