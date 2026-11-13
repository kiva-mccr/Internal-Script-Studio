# `src/screens/FlagIcon.svelte`

The flag drawn for flags on rows (AP-9, mock-up 22): filled for a flagged row, an outline for the button on one
that isn't. It takes the text's colour, so the amber comes from where it is used.

- **Used by:** `Write.svelte`, `WriteRow.svelte`, `Review.svelte`, `List.svelte`. **Tests:** `tests/e2e/flags.spec.ts`.

## Rules and pitfalls

- Hidden from screen readers (`aria-hidden`): the button or text beside it says what it is.
