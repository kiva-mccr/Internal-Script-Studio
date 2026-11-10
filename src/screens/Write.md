# `src/screens/Write.svelte`

The Write screen (mock-up 3): one script as rows of three columns. Edit in place, add, move and delete rows and
sections, add files, links and notes (`FilesCell.svelte`), and record a voice-over take for a row (AU-1).

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `format.spec.ts`, `voice.spec.ts`.

## Rules and pitfalls

- It changes the script it is given (`bind:script`) and calls `onChange`; saving is `Editor.svelte`'s.
- No browser dialogs (the user's rule): a delete is handed to the Editor with the blocks as they were
  (`onDeleted`), which shows the Undo bar.
- The column headings are `position: sticky`: no scrolling box (`overflow`) may wrap the table, or they stick to
  it instead of the window. A narrow window scrolls the page sideways instead.
- Row tools are placed over the number column so they never make a row taller.
- Dialogue and On screen are `TextField.svelte` (formatting toolbar, marks shown as formatting).
- Text areas grow with their text through `field-sizing: content` (Chrome and Edge only, like the app).
- The mic is its own grid column between the number and the dialogue, pulled into the gap (`translateX`), so a row
  with no take is no taller. It is drawn as an SVG in the shape the user picked, so it takes the text colour.
- The takes live in the Editor's `VoiceOver` (`lib/voice.svelte.ts`); a row with no id yet can't record.
