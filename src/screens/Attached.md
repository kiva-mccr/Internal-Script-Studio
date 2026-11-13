# `src/screens/Attached.svelte`

A comment's or reply's files on its card (RV-11, mock-up 25): files with a preview (`Preview.svelte`, AP-19) show
it with the name and size under it, other files a chip with the size. Clicking opens one in a new tab. Also exports `IMAGE` (which names are images), used by
`AttachBox.svelte` and `SharedFiles.svelte`.

With `use` (Write's Comments tab only, RV-12, board 49) each file
has "Use in script" under it, or "In row N" once it is in the comment's row.

- **Used by:** `screens/CommentCard.svelte` (Review and Write). **Tests:** `tests/e2e/attach.spec.ts`.

## Rules and pitfalls

- Files the browser can show (images, PDF, text, audio, video) open in a new tab; others (Word, zip) download under
  their own name, since a blob tab would show nothing useful.
- A file not there yet (still syncing) shows a plain message under the files, and no preview until it arrives.
- "In row" is worked out from the row's Files lines, never stored: a line with the copy's name (`isCopyOf`) and the
  attachment's size. So an older file of the same name already in assets/ doesn't count, and taking the line off the
  row brings the button back.
- Tests can't read a new tab's address when it is opened with `noopener`, so they watch `window.open` instead.
