# `src/screens/Editor.svelte`

One script: opens it, saves it on its own, keeps its History, shows who else is editing, and combines saves made
at the same time (`Conflict.svelte`). The screens themselves are separate files: the bar at the top
(`Header.svelte`), Write (`Write.svelte`), Review (`Review.svelte`), History (`History.svelte`), the print
version (`Print.svelte`) and the teleprompter (`Teleprompter.svelte`, saves what is waiting first).

- **Used by:** `App.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `history.spec.ts`, `conflict.spec.ts`, `print.spec.ts`,
  `teleprompter.spec.ts`.

## Rules and pitfalls

- No browser dialogs (the user's rule): deleting shows an Undo bar; messages sit at the bottom of the window.
  Only a failed save keeps the browser's "Leave site?" prompt, because leaving then would lose work.
- History: on opening, a script.md that doesn't match the newest version gets an "outside" entry (no versions:
  "History starts here"). While editing, an entry at most every 5 minutes; also on leaving and on opening History.
  Leaving by closing the tab is best effort (the browser may not wait for the write).
- Saves 1.5 s after the last change, when the tab is hidden, and when the page closes.
- Before writing, `script.md` is read again: if it is not what this page last read or wrote, someone else saved,
  and the two are combined row by row (`lib/merge.ts`); only a field both changed shows `Conflict.svelte`.
- On opening, two newest versions (heads) or a OneDrive copy (`script-*.md`) are combined the same way, and the
  merge version gets both as parents. A copy is removed only after the combined script is saved.
- "… is editing": your `editing/` file is written on opening and every 30 s, removed on leaving. A script.md that
  matches someone's `last_written` is credited to them, not "Outside the app".
- Comments are read on opening and every 5 s (`lib/comments.ts`); the Review tab shows how many are open.
- Review status (RV-3): Send for review, Approve, Send back to writer set `status:` and save at once (after
  `leave()`), then add a `review` History entry. The button names contain "Write" (Send back to writer), so tests
  pick the Write tab with `exact: true`.
- In tests the person is Sam: a test version by "Sam" counts as yours (a test failed on this).
- With nothing waiting to save, `script.md` is checked every 5 s and someone else's change is shown quietly.
- Split up (cleanup asked by the user): the header and Print's choices are `Header.svelte`, the rows are
  `Write.svelte`, and finding two saves' heads and ancestor is `lib/history.ts`. Saving and History stay here;
  put a new screen or panel in its own file, not in this one.
- Deleting happens in Write, but the Undo bar and its 10 s timer are here, so it stays up across the tabs.
- `Print.svelte` is mounted here, at the top level, never inside another element (its print CSS needs that).
- Print saves what is waiting first. Its choices come from `Header.svelte`. It shows "v3" only while the newest version is
  official and script.md still matches it (`officialNumber`); otherwise "Draft".
