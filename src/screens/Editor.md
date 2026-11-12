# `src/screens/Editor.svelte`

One script: opens it, saves it on its own, keeps its History, shows who else is editing, and combines saves made
at the same time (`Conflict.svelte`). The screens themselves are separate files: the bar at the top
(`Header.svelte`), Write (`Write.svelte`), Review (`Review.svelte`), History (`History.svelte`), Assets (`Assets.svelte`), the print
version (`Print.svelte`) and the teleprompter (`Teleprompter.svelte`, saves what is waiting first).

- **Used by:** `App.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `history.spec.ts`, `conflict.spec.ts`, `print.spec.ts`,
  `teleprompter.spec.ts`, `assets.spec.ts`.

## Rules and pitfalls

- Review's note (RV-8) and the version when the last review ended (RV-4) are read from History when Review opens
  and again after a status change's entry is written (`readReview`): the status changes before its entry exists,
  so reading only on the status change missed the new entry. Only the newest read counts.
- A status change (`setStatus`) is awaited by `leave()`: a tab switched before its History entry was written made a
  second entry, "Changed the status", beside it (found building RV-8, failed once in CI).
- A save leaves empty sections out of the file, on a copy: never out of `script`, or a section emptied while its
  title still has the cursor would vanish under it (AP-22; `Write.svelte` removes it on blur).
- No browser dialogs (the user's rule): deleting shows an Undo bar; messages sit at the bottom of the window.
  Only a failed save keeps the browser's "Leave site?" prompt, because leaving then would lose work.
- History: on opening, a script.md that doesn't match the newest version gets an "outside" entry (no versions:
  "History starts here"). While editing, an entry at most every 5 minutes; also on leaving and on opening History.
  Leaving by closing the tab is best effort (the browser may not wait for the write).
  `record` waits for History to start (`started`): an edit saved before `last` was set got no entry (seen as a
  flaky "versions made in the same second" test on CI, where the version file was there before `last`).
- Saves 1.5 s after the last change, when the tab is hidden, and when the page closes.
- A failed save tries again every 6 s, unless the browser took back its OK to edit the folder (`hasAccess` false):
  retrying can't fix that (the browser asks only from a click), so the status is `locked` and the top bar's Allow
  editing calls `allow()`. Changes go on in the page meanwhile and are saved once allowed. The 5 s check and coming
  back to the tab look for this too (`checkAccess`), so it shows before a save fails. Tests fake the lost OK
  (`fakeAccess` in `editor.spec.ts`).
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
- Flags (AP-9): `flagged` comes from the comment notes (`flags()`), read every 5 s like comments; `flag` writes a
  `flag` or `unflag` note. Before Approve they come first, as `flag:<row id>`, and `showLoose` takes them back to
  Write, to that row's note.
- Before Approve (RV-5): `loose` lists open comments and suggestions, then missing files, for the Header's panel;
  `showLoose` scrolls to and clicks that card in Review (`article[data-id]`), or opens Assets for the files.
- In tests the person is Sam: a test version by "Sam" counts as yours (a test failed on this).
- With nothing waiting to save, `script.md` is checked every 5 s and someone else's change is shown quietly.
- Split up (cleanup asked by the user): the header and Print's choices are `Header.svelte`, the rows are
  `Write.svelte`, and finding two saves' heads and ancestor is `lib/history.ts`. Saving and History stay here;
  put a new screen or panel in its own file, not in this one.
- Deleting happens in Write, but the Undo bar and its 10 s timer are here, so it stays up across the tabs.
- `Print.svelte` is mounted here, at the top level, never inside another element (its print CSS needs that).
- Print saves what is waiting first. Its choices come from `Export.svelte`. It shows "v3" only while the newest version is
  official and script.md still matches it (`officialNumber`, through `version()`); otherwise "Draft".
- Copy for Teams (`shareNow`, EX-10) saves what is waiting, then gives `lib/share.ts` the shared link (`?review`, RV-10), the version, the newest History
  entry's person and time (none for "Outside the app"), open comments and rows with a take.
- Exports (`openExport`, EX-9) save what is waiting, use the same `version()`, and show `Export.svelte` in place of
  the top bar and the tabs (the messages, the teleprompter and the print version stay outside it, so printing from
  it works). It makes and downloads the files itself.
- Missing files (`lostFiles`) are worked out here, not in `Assets.svelte`, so the tab's count shows in every tab. They
  are checked when the Files lines change (`untrack`, or every keystroke would re-check), when the tab opens and with
  the 5 s check. `jump` goes back to Write and focuses that row's Dialogue.
- The top bar's length (`voiceText`, AP-12) is Play's total: takes, plus read time for rows with none. Play is
  offered from the rows with a take (`taken`), not from that text, which shows with no take too.
- `voice` (a `VoiceOver`) holds the voice-over takes for Write and the top bar's total; it is read at open and with
  the 5 s check (not while recording), so someone else's take appears.
- `player` (a `Player`, `lib/play.svelte.ts`) plays the script (AU-2): the top bar's Play, and a row's number in
  Write plays from that row. It is offered in Write and Review (AU-9) with at least one take (`canPlay`), and stops when that
  ends, when a recording or a single take starts, and when the teleprompter opens. Space pauses and Esc stops, but
  not from a text field (and Space on a button stays that button's, or Play would toggle twice).
- The teleprompter opens at the block the cursor was last in (`cursorBlock`, from `focusin` on `[data-block]`), else
  the first one on screen (AU-7, `whereAmI`). The cursor's block counts even off screen: ⋯ is at the top of the page
  (the top bar is sticky only while playing), so reaching it scrolls back up and "on screen" would always be the top.
- The planning panel (`Planning.svelte`, AP-24) sits beside `main` in a flex row (`.page`), on Write and Review only;
  it reads and saves plan.md itself, apart from the script's saving and History.
- `review` (a shared link, RV-10) only sets the first tab; nothing is left to save at that point, so no `leave()`.
