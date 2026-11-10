# `src/screens/Editor.svelte`

One script: the Write screen (mock-up 3) and, through the Write · Review · History switch, `Review.svelte` and
`History.svelte`. Write: one script as rows of three columns. Edit in place, add, move and delete rows and
sections, add files, links and notes (`FilesCell.svelte`), Copy link. Saves on its own, shows who else is
editing, and combines saves made at the same time (`Conflict.svelte`).

- **Used by:** `App.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `history.spec.ts`, `conflict.spec.ts`.

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
- In tests the person is Sam: a test version by "Sam" counts as yours (a test failed on this).
- With nothing waiting to save, `script.md` is checked every 5 s and someone else's change is shown quietly.
- The column headings are `position: sticky`: no scrolling box (`overflow`) may wrap the table, or they stick to
  it instead of the window. A narrow window scrolls the page sideways instead.
- Row tools are placed over the number column so they never make a row taller.
- Dialogue and On screen are `TextField.svelte` (formatting toolbar, marks shown as formatting).
- Text areas grow with their text through `field-sizing: content` (Chrome and Edge only, like the app).
