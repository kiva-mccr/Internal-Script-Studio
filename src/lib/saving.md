# `src/lib/saving.svelte.ts`

One open script on disk (`Saving`, made by `screens/Editor.svelte` as `file`), saved as change files (FX-2,
docs/studio-folder.md): it opens the script, saves this person's typing as a change file within 30 s or on Ctrl+S,
folds in everyone else's every 5 s (`sync`), writes this person's "… is editing" file, and, on the keeper's computer,
writes script.md, the keeper's note and History. The page and its messages are the Editor's: `notice` hands a message
back, `onEntry` says a status change's entry was written. `script`, `dir`, `status`, `clash`, `editors`, `problem` and
`folding` are `$state`, so the Editor's page follows them.

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `conflict.spec.ts`, `handoff.spec.ts`,
  `history.spec.ts`, `review.spec.ts` (through the Editor; it needs a folder, so no unit test). The row-by-row work is
  `lib/changes.ts` (unit-tested).

## Rules and pitfalls

- Nothing but the keeper writes script.md, and no file is ever written by two computers (the field test on a Windows
  network drive: "Couldn't save" over and over, FX-1, then the user's design, FX-2). The user ruled out locking.
- `shared` is the script as everyone has it (script.md plus every change folded in, this person's saved ones too). A
  save is `diff(shared, page)`; a change from someone else is folded into `shared` as it is and into the page with
  this person's unsaved typing kept. Saves and `sync` run one at a time (`#saving`), since both change `shared`.
- The keeper is the earliest `since` among fresh editing files (this person included); it's worked out again at each
  check, so the next takes over when the keeper leaves or its laptop closes (2 min).
- `#show` replaces the page's script, which clears the save timer (`load`); it calls `changed()` again when the page
  still has unsaved typing. Restoring the old timer id instead left saves stuck at "Editing…".
- Saving waits up to 30 s from the first keystroke, not from the last: typing on doesn't put it off. Tests set
  `save-every` to 1.5 s in the browser's storage (playwright.config.ts); a test of the real 30 s removes it.
- Typing not saved yet is kept in the browser's storage (`unsaved:<folder>/<path>`, with the `shared` it was typed
  on) a second after each change, and folded back in on the next opening here.
- A change file over a minute older than script.md that the keeper's note doesn't list: the keeper closed between
  writing script.md and its note. Its clashes go to script.md's side without asking (see docs/studio-folder.md).
- History: entries are made by the keeper every 5 minutes, and by anyone on leaving, opening History, sending for
  review, restoring and publishing, each after the newest entry. `#record` waits for History to start (`#started`).
  Leaving, opening History, Print, the exports and Send for review go through `saveWaiting`, which also waits for a
  save already being written, and one queued behind it.
- A failed save tries again every 6 s, unless the browser took back its OK to edit the folder (`hasAccess` false):
  retrying can't fix that (the browser asks only from a click), so the status is `locked` and the top bar's Allow
  editing calls `allow()`. Writes are retried quietly first (`lib/files.ts`); a failed save names the browser's error
  (`problem`) for the top bar. Tests fake the lost OK (`fakeAccess` in `tests/e2e/editor.spec.ts`).
- A save leaves empty sections out of the file, on a copy: never out of `script`, or a section emptied while its
  title still has the cursor would vanish under it (AP-22; `screens/Write.svelte` removes it on blur).
- Review status (RV-3): Send for review, Approve, Send back to writer set `status:` and save at once (after
  `leave()`), then add a `review` History entry; a send's entry is also the next official version (`official: true`)
  unless `sendVersion` says nothing changed since the newest (RV-9). The button names contain "Write" (Send back
  to writer), so tests pick the Write tab with `exact: true`.
