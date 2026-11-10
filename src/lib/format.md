# `src/lib/format.ts`

Formatting (AP-11, mock-up 8): the marks in a field (`**bold**`, `*italic*`, `<u>underline</u>`, `~~strike~~`,
`[words](https://…)`, `$equation$`) as HTML, putting a mark on or off a selection, clearing marks, and finding a
quote in formatted text.

- **Used by:** `screens/TextField.svelte`, `screens/Review.svelte`, `screens/History.svelte`. **Tests:**
  `tests/unit/format.test.ts`, `tests/e2e/format.spec.ts`.

## Rules and pitfalls

- `toHtml` escapes everything it doesn't make itself; links only for `http(s)://`, so `javascript:` stays text.
- `**` must not be followed by another `*`, or `**bold *italic***` closed too early (bug found while building).
- Italic or bold is told apart by counting the stars on both sides of a selection (1 or 3 italic, 2 or 3 bold).
- KaTeX is imported only when an equation is on screen, so scripts without one never load it.
- `plain` needs a DOM (it reads the HTML's text): browser only, not unit tests.
