# `src/lib/format.ts`

Formatting (AP-11, mock-up 8): the marks in a field (`**bold**`, `*italic*`, `<u>underline</u>`, `~~strike~~`,
`[words](https://…)`, `$equation$`) as HTML, putting a mark on or off a selection, clearing marks, and finding a
quote in formatted text.

Also lists for the planning panel (AP-24): `showLists` shows `- `, `1. ` and `- [ ] ` / `- [x] ` as • 1. ☐ ☑,
`toggleList` puts lines in or out of a list (a tick box line is ticked instead), `continueList` carries a list on
with Enter.

- **Used by:** `screens/TextField.svelte`, `screens/Review.svelte`, `screens/History.svelte`. **Tests:**
  `tests/unit/format.test.ts`, `tests/unit/planning.test.ts`, `tests/e2e/format.spec.ts`.

## Rules and pitfalls

- `toHtml` escapes everything it doesn't make itself; links only for `http(s)://`, so `javascript:` stays text.
- `**` must not be followed by another `*`, or `**bold *italic***` closed too early (bug found while building).
- Italic or bold is told apart by counting the stars on both sides of a selection (1 or 3 italic, 2 or 3 bold).
- KaTeX is imported only when an equation is on screen, so scripts without one never load it.
- `toggleList` on a caret puts it at the end of the line, ready to type; on a selection it keeps the lines selected.
- `plain` needs a DOM (it reads the HTML's text): browser only, not unit tests.
