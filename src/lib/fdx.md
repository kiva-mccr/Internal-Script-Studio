# `src/lib/fdx.ts`

The script as a Final Draft file (EX-4): `toFdx(script, title, stand, date, how)` gives the .fdx XML (`how`: the export screen's settings, shared with Fountain); `runs` turns a
line's marks into Final Draft's styled `<Text>` runs.

- **Used by:** `screens/Export.svelte`. **Tests:** `tests/unit/fdx.test.ts`,
  `tests/e2e/editor.spec.ts` (parses the download as XML).

## Rules and pitfalls

- Laid out as `lib/fountain.ts` (shares `Screenplay` and `speakerName`): a section is a Scene Heading, On screen is Action, Dialogue is
  spoken by NARRATOR. Keep the two in step when one changes.
- The row number, note and files are a General paragraph, not a Final Draft ScriptNote: those are pinned to
  character ranges, easy to get wrong without Final Draft to check against.
- Each line of a field is its own paragraph; blank lines are dropped.
- Every piece of text goes through `escape`: one stray `&` or `<` and Final Draft won't open the file.
- The unit tests run in Node, which has no DOMParser; the e2e test is the one that parses the XML.
