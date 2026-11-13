# `src/lib/fountain.ts`

The script as a Fountain screenplay (EX-3, board 11), for Trelby, Highland and other screenplay programs:
`toFountain(script, title, stand, date, how)` gives the whole file (`how`: the export screen's settings, EX-9); `marks` turns the app's text marks into Fountain's.

- **Used by:** `screens/Export.svelte`. **Tests:** `tests/unit/fountain.test.ts`,
  `tests/e2e/editor.spec.ts`.

## Rules and pitfalls

- Fountain has no columns, so: a section is a forced scene heading (`.TITLE`), the On screen column is the action,
  the dialogue is spoken by `SPEAKER` (NARRATOR), and the row number, the row's note and its files are `[[notes]]`.
  These are the defaults (`SCREENPLAY`); the export screen can name the speaker (always in capitals, `speakerName`,
  or Fountain wouldn't read it as one), make sections `# Fountain sections`, and leave numbers or files out.
- Action lines that Fountain would read as something else (INT./EXT., a leading `.>!@#=~`, "… TO:", all caps) are
  forced with `!`.
- A blank line inside dialogue would end it, so it becomes a line of two spaces.
- Underline is `_x_`; strike has no Fountain mark and is dropped; a link becomes "words (address)"; `$tex$` is left
  as its TeX.
- Credits (AP-31) go on the title page as an indented `Credits:` value, one "Name, blurb" a line (`creditLine`,
  shared with `lib/fdx.ts` and `lib/share.ts`). Whether screenplay apps show that key is unseen.
