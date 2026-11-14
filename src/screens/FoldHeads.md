# `src/screens/FoldHeads.svelte`

The three column headings with their fold buttons (AP-17, RV-23): ‹ beside a heading folds that column to a thin
strip, whose › brings it back. Which are folded is a `Folds` from `lib/folds.svelte.ts`.

- **Used by:** `Write.svelte`, `Review.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `review.spec.ts`.

## Rules and pitfalls

- It renders three grid cells and no wrapper: the screen puts it inside its own heading grid, after `#`.
- The last column open has no ‹, so a screen never shows no columns.
