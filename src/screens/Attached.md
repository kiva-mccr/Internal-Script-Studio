# `src/screens/Attached.svelte`

A comment's or reply's files on its card (RV-11, mock-up 25): images as a small preview with the name, other files
as a chip with the size. Clicking opens one in a new tab. Also exports `IMAGE` (which names are images), shared with
`FilesCell.svelte` and `AttachBox.svelte`.

- **Used by:** `screens/Review.svelte`. **Tests:** `tests/e2e/attach.spec.ts`.

## Rules and pitfalls

- Files the browser can show (images, PDF, text, audio, video) open in a new tab; others (Word, zip) download under
  their own name, since a blob tab would show nothing useful.
- A file not there yet (still syncing) shows a plain message under the files, and no preview until it arrives.
- Tests can't read a new tab's address when it is opened with `noopener`, so they watch `window.open` instead.
