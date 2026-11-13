# `src/lib/slide.ts`

`slideAway`, the out transition for a comment card leaving its list (RV-19, the user's ask): it slides right and
fades, then its height closes so the cards below slide up. On the wrapper of each card in `Review.svelte` and
`Comments.svelte` (open, On hold and Resolved lists).

- **Used by:** `screens/Review.svelte`, `screens/Comments.svelte`. **Tests:** `tests/e2e/hold.spec.ts`.

## Rules and pitfalls

- Svelte runs it with the Web Animations API. With Playwright's `page.clock` paused it only moves while the test
  runs the clock, a frame at a time (one big `runFor` isn't enough): poll `runFor(100)` until the card is gone.
- The flex `gap` stays until the element is removed, so a negative bottom margin closes it too (no jump at the end).
- Reduced motion: no animation, the card goes at once.
- Transitions are local: closing a dropdown, or leaving the tab, removes cards without it.
