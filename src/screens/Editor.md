# `src/screens/Editor.svelte`

The Write screen (mock-up 3): one script as rows of three columns. Edit in place, add, move and delete rows and
sections, add files, links and notes (`FilesCell.svelte`), Copy link. Saves on its own.

- **Used by:** `App.svelte`. **Tests:** `tests/e2e/editor.spec.ts`.

## Rules and pitfalls

- Saves 1.5 s after the last change, when the tab is hidden, and when the page closes.
- Before writing, `script.md` is read again: if it is not what this page last read or wrote, someone else saved,
  and nothing is written until the person picks theirs or mine (the side-by-side merge is AP-7).
- With nothing waiting to save, `script.md` is checked every 5 s and someone else's change is shown quietly.
- The column headings are `position: sticky`: no scrolling box (`overflow`) may wrap the table, or they stick to
  it instead of the window. A narrow window scrolls the page sideways instead.
- Row tools are placed over the number column so they never make a row taller.
- Text areas grow with their text through `field-sizing: content` (Chrome and Edge only, like the app).
