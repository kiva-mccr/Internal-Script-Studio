# `src/screens/TextField.svelte`

A Write cell (Dialogue, On screen) with formatting (mock-up 8): while typing you see the marks; elsewhere they
show as formatting. Selecting text shows a toolbar: Bold, Italic, Underline, Strikethrough, Link, Equation, Clear.
Ctrl+B, I, U and K work too.

With `lists` (the planning panel, AP-24) it also shows Bulleted list, Numbered list and Tick box buttons above the
box at all times and shows the marks as • ☐ ☑. In every field (AP-29) Enter carries a list on or splits a list line,
Backspace just after a mark takes it off, and numbered lists renumber after every change.

- **Used by:** `WriteRow.svelte`, `Planning.svelte`. **Tests:** `tests/e2e/format.spec.ts`, `tests/e2e/editor.spec.ts`,
  `tests/e2e/lists.spec.ts`.

## Rules and pitfalls

- The text box is always there (tests and screen readers use it); when not focused it is see-through, with the
  formatted text over it (`pointer-events: none`, `aria-hidden`), so a click still lands in the box. Links in it
  are not clickable in Write; they are in Review.
- Changes go through `document.execCommand('insertText')`, so the browser's Ctrl+Z undoes them.
- Toolbar buttons keep the focus (`mousedown` prevented), or the selection would be lost before the click.
- Pasting two or more paragraphs calls `onparagraphs` instead of pasting (only Dialogue passes it, AP-13).
- A link wraps the selection and selects `https://`, ready to type the address over (no browser dialog).
- Renumbering runs after the input, as a second typed change, and never after Ctrl+Z or Ctrl+Y (`historyUndo`,
  `historyRedo`): otherwise undoing it would renumber again and Ctrl+Z could never go back past it. So Ctrl+Z takes
  two presses after a delete: numbers first, then the line.
- `put` types over only the stretch that differs (`changed`), not the whole box, so the box doesn't jump.
- `value` is read back from the box at the start of `input`, so renumbering never works on a stale copy.
