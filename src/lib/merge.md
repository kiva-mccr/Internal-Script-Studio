# `src/lib/merge.ts`

Combines two saves made from the same starting text, row by row (docs/studio-folder.md, Conflicts). What only one
side changed is taken without asking; a field both sides changed differently is a clash the person picks for.

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/unit/merge.test.ts`, `tests/e2e/conflict.spec.ts`.

## Rules and pitfalls

- Rows are matched by id, so a moved row is never a clash. The result is laid out on whichever side moved rows
  (otherwise on "theirs").
- A row one side deleted and the other changed is kept: losing an edit is worse than an extra row.
- Rows the other side added go after the row (or section) that came before them on that side.
- Clash keys are `rowid:field` and `front:title` / `front:status`. Authors are the union of both sides.
- `text(picks)` writes into the merged rows: call it once, for the final save.
- Credits (AP-31) in the front matter are combined person by person (`mergeCredits` in `lib/people.ts`), never a clash.
