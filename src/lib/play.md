# `src/lib/play.svelte.ts`

Play the script (AU-2, board 14): `plan` (the rows in order, each with how long it lasts and when it starts) and
`Player` (plays a plan: the step, playing or paused, the time; start, toggle, stop).

- **Used by:** `screens/Editor.svelte` (makes one), `screens/Write.svelte`, `screens/WriteRow.svelte`, `screens/Review.svelte` (AU-9). **Tests:** `tests/unit/play.test.ts`,
  `tests/e2e/play.spec.ts`.

## Rules and pitfalls

- A row with no take waits in silence for its read time (its words at the teleprompter's speed), so the timing
  stays true: the user's choice over skipping it. A row with no take and no dialogue is skipped. No gap between
  rows. An outdated take still plays.
- A take plays as `Sound` (cropped, at its gain, AU-4) and lasts `takeLength`; `start` is handed the takes for that.
- A take ends when its sound ends (`onended`), not when its noted length is up: the length in the JSON is timed
  by the clock while recording and can be a little off. The time shown is capped at the noted length meanwhile.
- A take that can't be read or played (still syncing) passes in silence for its noted length.
- Loading a take is awaited, and the person may stop or jump meanwhile: `#turn` goes up with every step and stop,
  and a take that arrives for an old turn is dropped.
- The plan is made when Play is pressed: rows changed while it plays are picked up on the next Play.
- Never heard with real takes here: tests play the fake WAV takes (see `voice.md`).
