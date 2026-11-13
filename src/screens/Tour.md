# `src/screens/Tour.svelte`

The guided tour's card and dimming (AP-34, board 53): a ring round the part a step points at, the rest dimmed and
not clickable, and a card beside it (below, above, right or left, whichever fits) with Skip tour, Back and Next,
ending on "Your turn". → and ← step, Esc skips. The steps are `lib/tour.ts`.

- **Used by:** `screens/Editor.svelte`, only in the example (App.svelte passes `tour`, which goes up when Take the
  tour is clicked). **Tests:** `tests/e2e/tour.spec.ts`.

## Rules and pitfalls

- A tab's tour waits for its first part to be drawn (the script takes a moment to open). A part that isn't on the
  page then (a hidden note) is left out of that run.
- Parts that only show on hover (a row's tools) are shown with the `tour-on` class (`app.css`). Siblings marked the
  same are ringed together: a row's tools, flag and § are three elements.
- `again` is read once when it mounts, so opening another script after Take the tour doesn't play it again.
