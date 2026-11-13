# `src/screens/Find.svelte`

The find and replace bar in Write (AP-32, board 44): Find, the count ("2 of 4"), ↑ ↓, Match case, Whole words,
Replace with, Replace, Replace all, ×. The logic is `lib/find.ts`.

- **Used by:** `screens/Write.svelte` (open while `finding`). **Tests:** `tests/e2e/find.spec.ts`.

## Rules and pitfalls

- Matches are CSS highlights (`find`, `find-on` in `app.css`) on the fields' formatted text (`.shown`) and the Files
  chips' words, so not inside a box while it is being typed in (as with RV-13's quotes). Section titles are boxes,
  which highlights can't reach: their marks go back to Write (`titles`), which tints the box.
- The marks are set again after every change to the script (`JSON.stringify(script.blocks)`), and removed with the bar.
- Replace goes on to the first match not before the words just put in, so replacing "leaf" with "leaves" never stops on
  its own replacement.
- Replace all hands the Editor copies of the blocks it changes (files arrays too, they are changed in place) for Undo.
- A match in a folded column opens that column when stepped to (`onUnfold`).
- Enter in Find steps, in Replace with replaces; Esc in either closes. The focus stays in the bar while stepping.
