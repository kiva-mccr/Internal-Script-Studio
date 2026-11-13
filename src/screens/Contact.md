# `src/screens/Contact.svelte`

One person's contact details (AP-31, board 50): Email and LinkedIn (agreed: no phone), shared by every script.

- **Used by:** `screens/Credits.svelte`, `screens/People.svelte`. **Tests:** `tests/e2e/credits.spec.ts`.

## Rules and pitfalls

- Done saves only when something changed (a new people file), then hands the person back with `onSaved`. The
  windows call `done()` before closing, so typed details aren't lost; it returns false (and shows why) on a failure.
- The form starts from the person as they were when it opened; it isn't refreshed while open.
