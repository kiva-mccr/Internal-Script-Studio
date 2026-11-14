# `src/lib/tour.ts`

The guided tour in the example (AP-34, board 53): the steps of each tab's tour (`TOURS`), the "Your turn" words, and
what this browser remembers: which tabs' tours were seen, and Skip tour (no tab's tour plays by itself again).

- **Used by:** `screens/Tour.svelte`. **Tests:** `tests/e2e/tour.spec.ts`.

## Rules and pitfalls

- A step points at a part of the page by its `data-tour="…"` mark, never by a class or text. When a feature in the
  tour changes, moves or goes, change its step and its mark: `tour.spec.ts` plays every tour and fails when a
  step's part is gone or off screen.
- Keep each step to one sentence or two, and each tab to a handful: the user asked for a fast tour.
- Write may have 8 cards (agreed on board 66, AP-47); other tabs keep to 3 to 7.
- Every other e2e test starts with the tour skipped (`storageState` in `playwright.config.ts`), since it covers the page.
