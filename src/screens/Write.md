# `src/screens/Write.svelte`

The Write screen (mock-up 3): one script as rows of three columns. Edit in place, add, move and delete rows and
sections, add files, links and notes (`FilesCell.svelte`, with files from other scripts, AS-1), record a voice-over take for a row (AU-1), and follow the
script as it plays (AU-2). Each row is `WriteRow.svelte`; Write keeps what spans rows (adding, moving,
deleting, keys, the flag bar, find, quotes marked, removed rows). Any column but the last one open folds to a thin strip (AP-17).

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `format.spec.ts`, `voice.spec.ts`, `play.spec.ts`.

## Rules and pitfalls

- It changes the script it is given (`bind:script`) and calls `onChange`; saving is `Editor.svelte`'s.
- Split up (the user asked for the large screen files to be split): one row is `WriteRow.svelte`, with its own
  rules. Write keeps everything that changes the blocks round a row (move, add, delete, § and ¶, paste) and the mic
  (stopping a take on another row needs that row's dialogue), and hands them to the row as callbacks.
- No browser dialogs (the user's rule): a delete is handed to the Editor with the blocks as they were
  (`onDeleted`), which shows the Undo bar.
- The column headings are `position: sticky`: no scrolling box (`overflow`) may wrap the table, or they stick to
  it instead of the window. A narrow window scrolls the page sideways instead.
- Add section (AP-22) goes after the box in use: the button keeps the cursor on a click (`mousedown`
  preventDefault) so `document.activeElement` still says where, through `data-block` (the block's index). From a
  section's title it goes after that section's rows. A new section starts empty (grey "New section" placeholder)
  and takes the cursor (`focusIf`); an empty one is removed on blur, never while it has the cursor. The Editor
  leaves empty sections out of the file but not out of the page, so a save can't pull one from under the cursor.
- Paste a draft (AP-13): two or more paragraphs pasted into Dialogue (`TextField`'s `onparagraphs`, split by
  `paragraphs` in `lib/script.ts`) make rows (`pasteRows`); one line pastes as usual. It goes through the Undo bar
  (`onDeleted`), not Ctrl+Z, so the row pasted into is copied for Undo, not kept by reference. New rows are set up
  in full before going into `script.blocks`: changing the plain object afterwards would not show (Svelte's proxy).
- Keyboard flow (AP-14) is one `keydown` on the table (`keys`), for its text boxes only (section titles and
  textareas). Tab goes to the next box in the page, past the buttons and files; from the last box the browser carries
  on. Moving a row takes its box out of the page for a moment, so the cursor (box and selection) is put back after
  `tick()`, found again by `data-block`. Alt+Up/Down swaps with the block next to it, a section too, like ↑ and ↓.
  Shortcuts (AP-44) go through `shortcuts.match` (`lib/shortcuts.svelte.ts`), so changed keys work: Ctrl+Up/Down go
  to the same column (`.dialogue` / `.screen`) in the row above or below, skipping sections; Ctrl+Shift+Enter adds a
  row above; Ctrl+Shift+Backspace is `remove` (the Undo bar), then the cursor goes to the block now at that place.
- Text areas grow with their text through `field-sizing: content` (Chrome and Edge only, like the app).
- Folded columns are this browser's choice (`write-folded`, a `Folds` from `lib/folds.svelte.ts`; headings `FoldHeads.svelte`), for every
  script; never in the script, so nothing syncs. The grid's columns are set on each row (`columns`), not in the CSS.
- Review comments (RV-13, board 37; the bubble and the quote click are `WriteRow.svelte`'s): a row with open ones (`talk`, from the Editor) shows a blue bubble with the count
  under its number (`.bubble`, `display: flex` or it sat over the number); the row tools, flag and § move down to
  clear it (`--down`), so such a row is a little taller. Quotes are marked with CSS highlights on the field's
  formatted text (`.shown`), so not while that box is focused; the effect reruns when those rows' text changes
  (`quoted`). A click in Dialogue or On screen with the cursor in a quote's words (found in the raw text, so not
  across marks) opens its card (`onTalk`). The row of the card being read is tinted (`.talking`).
- Find and replace (AP-32): `Find.svelte` sits above the table in a sticky wrapper; the column headings stick below
  it (`--find-h`, its height). Ctrl+F is caught on the window (`findKey`): it opens the bar, or comes back to it, but
  from inside the bar it is left to the browser. ⋯ › Find and replace opens it through the Editor (`finding`).
- Changed since you last looked (RV-15, board 45; the marks are `WriteRow.svelte`'s): `visit` (from the Editor) marks a row with RV-4's blue bar,
  "Changed"/"New", who and a ✓ Seen under the number (`.mark`, `.seen`); `data-visit` is what the bar's ‹ › scroll to,
  `.visit-on` the row stepped to. The row tools, flag and § sit below the bubble and the mark through `--down` (px,
  set on the row), which also makes the row's min-height. The row stays fully editable: Show the edits puts the old
  Dialogue or On screen in its own `.was` line above the box, never in it (Images & files shows no old names here;
  Review does). Removed rows are a grey line after the row they followed (`removedRows`).
- A section's read time (AP-12) sits after its title: its rows' dialogue at the speaking speed, hidden when 0.
- Before you started (AP-38): `started` (the Editor's `file.started.rows`) goes to each row as `start`; Put it back
  (`putBack`) copies the row for the Undo bar (`onDeleted`) before setting the field, like a paste.
