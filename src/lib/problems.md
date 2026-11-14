# `src/lib/problems.ts`

Copy details (AP-41): when something goes wrong, the screen shows a plain message and calls `problem(message, doing,
error)`, which remembers what the app was doing and the browser's own error. The small copy icon beside the message
(`CopyDetails.svelte`) copies `problemDetails`: the message, what the app was doing, the error word for word, the
folder's name, the page, the app's version, the browser and the time, as plain text.

- **Used by:** `CopyDetails.svelte`, `App.svelte` (the folder's name), `saving.svelte.ts` and the screens that show
  errors. **Tests:** `tests/unit/problems.test.ts`, `tests/e2e/problems.spec.ts`.

## Rules and pitfalls

- Keyed by the message text, so screens keep their message as a plain string. A message never passed to `problem`
  (a hint such as "Give it a name first.") gets no icon: only call `problem` for something that went wrong.
- Only the folder's name goes in the details, never its full path, and nothing from the script itself.
- Messages say "the shared folder", never OneDrive, unless the app knows the folder is OneDrive (the team uses a
  network drive).
