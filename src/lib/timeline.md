# `src/lib/timeline.ts`

The storyboard timeline (SB-1, mock-up 63): reads and writes a row's `Timeline:` line (`readChoices`,
`writeChoices`, `changeChoices`), lists a row's pictures (`pictureFiles`, `picks`), and lays the script out in time
(`layout`): rows, then the hold or placeholder after each, and the sections' spans. `shots` splits a sequence's
time between its pictures, on the cut words when the take's word timings are known (`cutTimes`), else equally.

- **Used by:** the Timeline panel (from PR 2 of SB-1). **Tests:** `tests/unit/timeline.test.ts`.

## Rules and pitfalls

- The line holds only what differs from the default; `writeChoices` of the default is '' (no line at all).
- Parts it doesn't understand are kept in `rest` and written back, so a later feature's parts survive older apps.
- Keep `layout`'s lengths the same as Play the script's plan (`lib/play.svelte.ts`), or the playhead drifts.
- A cut word is matched by `plain` (lower case, letters and digits only), the first match after the previous cut.
