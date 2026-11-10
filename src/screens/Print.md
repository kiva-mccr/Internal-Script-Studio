# `src/screens/Print.svelte`

The print version (EX-1, mock-up 9): title, authors, version and status, then every row in a table (formatting and
equations, files by name with image previews, links, "To find:" notes). Room for notes during production when
asked: a blank Notes column on each row and a lined Notes space at the end. A text size (`scale`). It is only seen
when printing; the browser's print window makes the PDF ("Save as PDF").

- **Used by:** `screens/Editor.svelte` (the Print button and its choices). **Tests:** `tests/e2e/print.spec.ts`.

## Rules and pitfalls

- It is mounted only while printing; when printing, `#app > :not(.print-view)` is hidden, so the editor, the
  messages and the GitHub link never print. It must stay a direct child of `#app` (Editor's top level).
- `onReady` waits for the image previews and equations, or the print window shows the page half drawn. A missing
  or broken image is hidden, never waited for.
- The footer (title, version, page N of M) is an `@page` margin box, so the title goes in as an escaped CSS string.
- `<thead>` repeats the headings on every page, and `break-inside: avoid` keeps a row on one page.
- Text sizes are in `em` from the page's font size, so the text size choice scales all of them; images don't.
- `white-space: pre-wrap` sits on an inner `.text` only: on the cell it printed the template's spaces before the text.
- Tests replace `window.print` and look at the page with `emulateMedia({ media: 'print' })`.
