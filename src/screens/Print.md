# `src/screens/Print.svelte`

The print version (EX-1, mock-up 9): title, authors, version and status, then every row in a table (formatting and
equations, files by name with image previews, links, "To find:" notes). Room for notes during production when
asked: a blank Notes column on each row and 2 to 8 Notes lines at the foot of every page (`lines`, EX-15). A text size (`scale`). Columns can be
left out (`hidden`, EX-16); widths come from `lib/printcolumns.ts`. It is seen when
printing (the browser's print window makes the PDF, "Save as PDF"), and with `onScreen` as the export screen's preview (EX-9).

- **Used by:** `screens/Editor.svelte` (to print) and `screens/Export.svelte` (the preview, and Print's choices). **Tests:** `tests/e2e/print.spec.ts`.

## Rules and pitfalls

- `onScreen` drops the `print-view` class (so it shows on screen and never prints) and the `@page` footer style.
- For printing it is mounted only while printing; when printing, `#app > :not(.print-view)` is hidden, so the editor, the
  messages and the GitHub link never print. It must stay a direct child of `#app` (Editor's top level).
- `onReady` waits for the image previews and equations, or the print window shows the page half drawn. A missing
  or broken image is hidden, never waited for.
- The footer (title, version, page N of M) is an `@page` margin box, so the title goes in as an escaped CSS string.
- `<thead>` repeats the headings on every page, and `break-inside: avoid` keeps a row on one page.
- Text sizes are in `em` from the page's font size, so the text size choice scales all of them; images don't.
- `white-space: pre-wrap` sits on an inner `.text` only: on the cell it printed the template's spaces before the text.
- Column widths are set on the `<th>`s (`table-layout: fixed` takes them from the first row); a row's note goes in
  the first column that prints, and a section's `colspan` follows the columns printed.
- The Notes lines (EX-15) are `position: fixed` when printing, which Chrome repeats at the bottom of every page;
  a `<tfoot>` row just as tall (`.room`, same `--lines` height) repeats too and keeps the rows clear of them, also on
  the last page. Both heights come from one CSS rule, so they can't drift apart. On screen they show once, after the rows.
- Tests replace `window.print` and look at the page with `emulateMedia({ media: 'print' })`.
