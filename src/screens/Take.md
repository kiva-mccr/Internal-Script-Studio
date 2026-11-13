# `src/screens/Take.svelte`

A row's voice-over take under its dialogue (AU-1): ▶ and its cropped length, the bar, Outdated, words a minute, who
and when. Write passes `onCurrent` (× on Outdated, AU-8) and `onDrop` (× to delete); Review leaves them out and only
listens (AU-9).

- **Used by:** `WriteRow.svelte`, `Review.svelte`. **Tests:** `tests/e2e/voice.spec.ts`, `play.spec.ts`.

## Rules and pitfalls

- Tests find it by its classes (`.take .about`, `.old`): keep them.
- The delete × shows on hover of the row (`:global(.row:hover)`), so the parent's row must have the class `row`.
- `at` (0 to 1) is the parent's choice: the script's place when Play the script is on that row, else the take's own.
