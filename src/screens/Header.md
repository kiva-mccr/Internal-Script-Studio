# `src/screens/Header.svelte`

The bar at the top of a script: the folder name (back to the list) and the title, the Write · Review · History
switch with the number of open comments, "… is editing", the review buttons (Send for review, Send back to writer,
Approve), the save status, and a ⋯ menu (asked by the user, to keep the bar short) with Teleprompter, Print… (its choices)
and Copy link.

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `review.spec.ts`, `print.spec.ts`,
  `conflict.spec.ts`.

## Rules and pitfalls

- The ⋯ menu closes on Esc, on a click outside it, after choosing, and a moment after Copy link. Tests open it
  with the "More" button first.

- It only shows and asks: switching tabs, the status and printing are done by `Editor.svelte` (`onMode`,
  `onStatus`, `onPrompt`, `onPrint`), which saves what is waiting first.
- The button names contain "Write" (Send back to writer), so tests pick the Write tab with `exact: true`.
- Print's choices (notes column, notes space, text size) are remembered with `recall`/`keep` (`lib/remember.ts`).
