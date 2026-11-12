# `src/screens/Write.svelte`

The Write screen (mock-up 3): one script as rows of three columns. Edit in place, add, move and delete rows and
sections, add files, links and notes (`FilesCell.svelte`), record a voice-over take for a row (AU-1), and follow the
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
- Row tools are placed over the number column so they never make a row taller.
- Dialogue and On screen are `TextField.svelte` (formatting toolbar, marks shown as formatting).
- Text areas grow with their text through `field-sizing: content` (Chrome and Edge only, like the app).
- The mic is its own grid column between the number and the dialogue, pulled into the gap (`translateX`), so a row
  with no take is no taller. It is drawn as an SVG in the shape the user picked, so it takes the text colour.
- Folded columns are this browser's choice (`write-folded` in localStorage, through `recall`/`keep`), for every
  script; never in the script, so nothing syncs. The grid's columns are set on each row (`columns`), not in the CSS.
- A folded column's cells are not drawn at all (no hidden text fields); a grey dot marks a row with something there.
- The takes live in the Editor's `VoiceOver` (`lib/voice.svelte.ts`); a row with no id yet can't record.
- Play the script (AU-2): the Editor's `Player` says which row is playing; that row is tinted (`.here`), scrolled
  to, and its take's bar fills (a row with no take shows a grey bar and "No take yet"). A row's number is a button
  ("Play from row n") only while there is something to play (`canPlay`). A row's own ▶ pauses the script when it
  is the row being played, so its name is "Pause row n" then: tests tell it from the top bar's "Pause the script".
