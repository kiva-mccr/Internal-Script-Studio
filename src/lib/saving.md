# `src/lib/saving.svelte.ts`

One open script on disk (`Saving`, made by `screens/Editor.svelte` as `file`): opens it, saves it on its own, keeps
its History, writes this person's "… is editing" file, and combines saves made at the same time. The page and its
messages are the Editor's: `notice` hands a message back, `onEntry` says a status change's entry was written.
`script`, `dir`, `status`, `clash` and `editors` are `$state`, so the Editor's page follows them.

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `history.spec.ts`, `conflict.spec.ts`,
  `review.spec.ts` (through the Editor; it needs a folder, so no unit test).

## Rules and pitfalls

- Split out of `Editor.svelte` (the user asked for the large screen files to be split): same behaviour, moved as
  it was. `name` is a getter, since the Editor's props can be gone before leaving is done.
- A status change (`setStatus`) is awaited by `leave()`: a tab switched before its History entry was written made a
  second entry, "Changed the status", beside it (found building RV-8, failed once in CI).
- A save leaves empty sections out of the file, on a copy: never out of `script`, or a section emptied while its
  title still has the cursor would vanish under it (AP-22; `screens/Write.svelte` removes it on blur).
- History: on opening, a script.md that doesn't match the newest version gets an "outside" entry (no versions:
  "History starts here"). While editing, an entry at most every 5 minutes; also on leaving and on opening History.
  Leaving by closing the tab is best effort (the browser may not wait for the write).
  `record` waits for History to start (`started`): an edit saved before `last` was set got no entry (seen as a
  flaky "versions made in the same second" test on CI, where the version file was there before `last`).
  Leaving, opening History, Print, the exports and Send for review go through `saveWaiting`, which also waits for a
  save already being written: checking only for `waiting` skipped one mid-save, so it got no History entry (the same
  test, flaky again under load).
- Saves 1.5 s after the last change, when the tab is hidden, and when the page closes.
- A failed save tries again every 6 s, unless the browser took back its OK to edit the folder (`hasAccess` false):
  retrying can't fix that (the browser asks only from a click), so the status is `locked` and the top bar's Allow
  editing calls `allow()`. Changes go on in the page meanwhile and are saved once allowed. The 5 s check and coming
  back to the tab look for this too (`checkAccess`), so it shows before a save fails. Tests fake the lost OK
  (`fakeAccess` in `tests/e2e/editor.spec.ts`).
- Before writing, `script.md` is read again: if it is not what this page last read or wrote, someone else saved,
  and the two are combined row by row (`lib/merge.ts`); only a field both changed
  becomes a `clash`, which the Editor shows with `screens/Conflict.svelte`.
- On opening, two newest versions (heads) or a OneDrive copy (`script-*.md`) are combined the same way, and the
  merge version gets both as parents. A copy is removed only after the combined script is saved.
- "… is editing": your `editing/` file is written on opening and after each save (`here`; the Editor also calls it
  every 30 s and removes the file on leaving). A script.md that matches someone's `last_written` is credited to
  them, not "Outside the app".
- Review status (RV-3): Send for review, Approve, Send back to writer set `status:` and save at once (after
  `leave()`), then add a `review` History entry; a send's entry is also the next official version (`official: true`)
  unless `sendVersion` says nothing changed since the newest (RV-9). The button names contain "Write" (Send back
  to writer), so tests pick the Write tab with `exact: true`.
- With nothing waiting to save, `script.md` is checked every 5 s (`lookOutside`) and someone else's change is shown
  quietly; History then follows their newest version, if it has synced.
