# `src/screens/Header.svelte`

The bar at the top of a script: the folder name (back to the list) and the title, the Write · Review · History · Assets
switch with the number of open comments and of missing files, "… is editing", the review buttons (Send for review, Send back to writer,
Approve), the save status, and two menus (asked by the user, to keep the bar short): Export, with Print… (its choices),
Fountain, Final Draft and later exports, and ⋯ with Teleprompter and Copy link.

- **Used by:** `screens/Editor.svelte`. **Tests:** `tests/e2e/editor.spec.ts`, `review.spec.ts`, `print.spec.ts`,
  `conflict.spec.ts`.

## Rules and pitfalls

- One menu is open at a time (`menu`). It closes on Esc, on a click outside both menus, after choosing, and a
  moment after Copy link. Tests open ⋯ with the "More" button, and Print with "Export" then "Print…".
- A new export goes in the Export menu, and `onExport` grows a new `to`.

- It only shows and asks: switching tabs, the status and printing are done by `Editor.svelte` (`onMode`,
  `onStatus`, `onPrompt`, `onPrint`, `onExport`), which saves what is waiting first.
- The button names contain "Write" (Send back to writer), so tests pick the Write tab with `exact: true`.
- Print's choices (notes column, notes space, text size) are remembered with `recall`/`keep` (`lib/remember.ts`).
