# `src/screens/TextField.svelte`

A Write cell (Dialogue, On screen) with formatting (mock-up 8): while typing you see the marks; elsewhere they
show as formatting. Selecting text shows a toolbar: Bold, Italic, Underline, Strikethrough, Link, Equation, Clear.
Ctrl+B, I, U and K work too.

- **Used by:** `Editor.svelte`. **Tests:** `tests/e2e/format.spec.ts`, `tests/e2e/editor.spec.ts`.

## Rules and pitfalls

- The text box is always there (tests and screen readers use it); when not focused it is see-through, with the
  formatted text over it (`pointer-events: none`, `aria-hidden`), so a click still lands in the box. Links in it
  are not clickable in Write; they are in Review.
- Changes go through `document.execCommand('insertText')`, so the browser's Ctrl+Z undoes them.
- Toolbar buttons keep the focus (`mousedown` prevented), or the selection would be lost before the click.
- A link wraps the selection and selects `https://`, ready to type the address over (no browser dialog).
