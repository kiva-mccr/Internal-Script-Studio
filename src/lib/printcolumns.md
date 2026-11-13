# `src/lib/printcolumns.ts`

Which of the three columns print (EX-16, board 38) and how wide each printed column is.

- **Used by:** `screens/Export.svelte` (the ticks, remembered as `print-hide`) and `screens/Print.svelte` (the widths).
  **Tests:** `tests/unit/printcolumns.test.ts`, `tests/e2e/print.spec.ts`.

## Rules and pitfalls

- The user's rule: the first column unticked gives its room to Dialogue, the next one to the Notes column, taking
  turns. So `hidden` keeps the order the columns were unticked in; don't sort it.
- With neither Dialogue nor Notes printing, the room goes to the first column that prints. Widths always add up to 100.
- One column always prints: a remembered value hiding all three keeps Dialogue.
