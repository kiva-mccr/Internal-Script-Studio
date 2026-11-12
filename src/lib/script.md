# `src/lib/script.ts`

Reads `script.md` into sections and rows and writes it back (docs/script-format.md), plus the front matter helpers
and how a Files line is read (a path, a link, or plain words). `paragraphs` splits pasted text into lines for
Paste a draft (AP-13).

- **Used by:** `lib/folder.ts`, `screens/Editor.svelte`, `screens/FilesCell.svelte`. **Tests:**
  `tests/unit/script.test.ts` (including: the example script is written back byte for byte).

## Rules and pitfalls

- Never drop text: anything the format does not describe is kept as a note and written back as it was.
- Rows are renumbered on every write; ids never change. Give missing ids when a script is loaded, not when it is
  written, or a row that has not been saved yet gets a new id on each save.
- A line inside a field that starts with a label or `#` is written with a backslash in front, or it would read
  back as a label or a heading.
