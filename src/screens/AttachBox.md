# `src/screens/AttachBox.svelte`

Files on a comment or reply being written or edited (RV-11, mock-up 25): wraps the text box (`children`) and the
buttons (`actions`), and adds the list of attached files with ×, Attach file, and dropping or pasting files on it.
`files` are new ones (saved with the note by `lib/comments.ts`), `kept` ones already saved (when editing).

- **Used by:** `screens/Review.svelte`. **Tests:** `tests/e2e/attach.spec.ts`.

## Rules and pitfalls

- A paste takes only files; pasted text goes into the box as usual. Drag-over is accepted only when it carries files.
- Files over 50 MB are refused with the message in the box (`tooBig`), never a browser dialog.
- Previews are blob URLs (new files directly, kept ones read from the folder), revoked when the list changes.
