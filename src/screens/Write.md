# `src/screens/Write.svelte`

The Write screen (mock-up 3): one script as rows of three columns. Edit in place, add, move and delete rows and
sections, add files, links and notes (`FilesCell.svelte`, with files from other scripts, AS-1), record a voice-over take for a row (AU-1), and follow the
script as it plays (AU-2). Any column but the last one open folds to a thin strip (AP-17).

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `format.spec.ts`, `voice.spec.ts`, `play.spec.ts`.

## Rules and pitfalls

- It changes the script it is given (`bind:script`) and calls `onChange`; saving is `Editor.svelte`'s.
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
- Row tools are placed over the number column so they never make a row taller.
- Dialogue and On screen are `TextField.svelte` (formatting toolbar, marks shown as formatting).
- Text areas grow with their text through `field-sizing: content` (Chrome and Edge only, like the app).
- The mic is its own grid column between the number and the dialogue, pulled into the gap (`translateX`), so a row
  with no take is no taller. It is drawn as an SVG in the shape the user picked, so it takes the text colour.
- Folded columns are this browser's choice (`write-folded` in localStorage, through `recall`/`keep`), for every
  script; never in the script, so nothing syncs. The grid's columns are set on each row (`columns`), not in the CSS.
- A folded column's cells are not drawn at all (no hidden text fields); a grey dot marks a row with something there.
- Recording (AU-4): the mic records from the click; while `voice.cue` (the first second) a red ring fills round it and the
  line says "Getting ready…", then ■ and "● Recording". Esc then throws the take away (the Editor's keys). The ▶ shows the
  cropped length (`span`), its title how much was cut. The take line is `Take.svelte`, shared with Review.
- The mic has no `title` (no hover text) in any state: it covered the line being read (user asked twice). Its
  name is only the `aria-label`. A test checks this.
- The takes live in the Editor's `VoiceOver` (`lib/voice.svelte.ts`); a row with no id yet can't record.
- Play the script (AU-2): the Editor's `Player` says which row is playing; that row is tinted (`.here`), scrolled
  to, and its take's bar fills (a row with no take shows a grey bar and "No take yet"). A row's number is a button
  ("Play from row n") only while there is something to play (`canPlay`). It shows ▶ while the mouse is anywhere on
  the row (AU-7, CSS only: `.n` and `.go`), and ❚❚ ("Pause at row n", pauses) on the row playing. A row's own ▶ pauses the script when it
  is the row being played, so its name is "Pause row n" then: tests tell it from the top bar's "Pause the script".
- Flags (AP-9, mock-up 22): the flag button sits in the third slot of the row tools' top line (left 50px, clear of
  the mic), seen on hover and focus and always once flagged. A new flag puts the cursor in its note; the note is
  written on blur or Enter (`onchange`), not per key. "Needs a source" is offered while the note is empty. ‹ › above
  the table step in row order (`current`, tinted `.stepped`). The flag's Clear has no aria-label (the flag button
  already says "Clear the flag on row n"), so tests find it inside the row. Saving is the Editor's (`onFlag`).
- Row to section and back (AP-30, mock-up 39): § sits under the flag (`.promote`, placed like the flag), ¶ in a
  section's tools. Both go through the Undo bar (`onDeleted`). The Undo message is worked out before the splice: after
  it the row has no number. A section turned into a row gets a fresh id (no take, flag or comments).
- A section's read time (AP-12) sits after its title: its rows' dialogue at the speaking speed, hidden when 0.
- Review comments (RV-13, board 37): a row with open ones (`talk`, from the Editor) shows a blue bubble with the count
  under its number (`.bubble`, `display: flex` or it sat over the number); the row tools, flag and § move down to
  clear it (`--down`), so such a row is a little taller. Quotes are marked with CSS highlights on the field's
  formatted text (`.shown`), so not while that box is focused; the effect reruns when those rows' text changes
  (`quoted`). A click in Dialogue or On screen with the cursor in a quote's words (found in the raw text, so not
  across marks) opens its card (`onTalk`). The row of the card being read is tinted (`.talking`).
- Find and replace (AP-32): `Find.svelte` sits above the table in a sticky wrapper; the column headings stick below
  it (`--find-h`, its height). Ctrl+F is caught on the window (`findKey`): it opens the bar, or comes back to it, but
  from inside the bar it is left to the browser. ⋯ › Find and replace opens it through the Editor (`finding`).
- Changed since you last looked (RV-15, board 45): `visit` (from the Editor) marks a row with RV-4's blue bar,
  "Changed"/"New", who and a ✓ Seen under the number (`.mark`, `.seen`); `data-visit` is what the bar's ‹ › scroll to,
  `.visit-on` the row stepped to. The row tools, flag and § sit below the bubble and the mark through `--down` (px,
  set on the row), which also makes the row's min-height. The row stays fully editable: Show the edits puts the old
  Dialogue or On screen in its own `.was` line above the box, never in it (Images & files shows no old names here;
  Review does). Removed rows are a grey line after the row they followed (`removedRows`).
