# `src/lib/near.ts`

A Svelte action, `use:near={callback}`: calls back once when the element comes within two screens of the window
(AP-39). File previews in a long script are made as their rows come near, so opening it doesn't make every preview
at once and the rows on screen get theirs first.

- **Used by:** `screens/FilesCell.svelte`, `screens/Timeline.svelte` (its pictures and waveforms). **Tests:** `tests/e2e/previews.spec.ts` (a far row's preview waits).

## Rules and pitfalls

- One `IntersectionObserver` for the page, on the window (the Write table has no scrolling box of its own). An
  element stops being watched once called back or destroyed.
- A hidden element (`display: none`) never comes near: it is called back when it is shown and scrolled to.
