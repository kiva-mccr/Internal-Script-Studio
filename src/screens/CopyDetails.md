# `src/screens/CopyDetails.svelte`

The small grey copy icon after an error message (AP-41, board 61, look A picked by the user). Clicking it copies the
details `problemDetails` builds (see `lib/problems.md`); the icon turns into a tick for a moment.

- **Used by:** every screen that shows an error, the bottom message in `Editor.svelte` and the top bar's
  "Couldn't save". **Tests:** `tests/e2e/problems.spec.ts`.

## Rules and pitfalls

- Shows nothing for a message that wasn't given to `problem()`, so it can sit beside any message (the bottom
  message shows hints too).
- Takes the colour of the text around it, faded, so it works on the dark bottom message and the red error text.
- No browser dialogs: a failed copy shows "Couldn't copy" beside the icon.
