# `src/lib/follow.ts`

Following a voice through the script (EX-8): `follow(script, heard, at)` matches the last words heard to the
script's words near the marker and gives the word the speaker is at. `normal` and `wordsOf` make words comparable.

- **Used by:** `screens/Teleprompter.svelte`. **Tests:** `tests/unit/follow.test.ts`.

## Rules and pitfalls

- Looks 15 words back and 80 ahead (a repeated phrase, a skipped line), matching the last 8 words heard. A missing
  or extra word counts half. At least 3 words must match (2 if only 2 were heard): one word alone, like "tiny",
  is too often somewhere else in the script.
- Between hearings (EX-12) `aim` sends the marker on at the reading pace, at most `LEAD` (4) words past the word
  heard, so a pause stops it soon. `paceFrom` learns the pace from the voice, ignoring a step back or a move after
  more than 3 s, and caps one move at 6 words a second (a skipped line isn't fast reading).
- Of two equally good places, the nearer wins, so a phrase that comes twice doesn't jump ahead.
- The script's words must be counted exactly as `countWords` counts them (split on spaces after `clearMarks`),
  or the marker drifts from the line it shows: keep empty normal words, don't filter them out.
