# `src/lib/follow.ts`

Following a voice through the script (EX-8): `follow(script, heard, at)` matches the last words heard to the
script's words near the marker and gives the word the speaker is at. `normal` and `wordsOf` make words comparable.

- **Used by:** `screens/Teleprompter.svelte`. **Tests:** `tests/unit/follow.test.ts`.

## Rules and pitfalls

- Looks 15 words back and 80 ahead (a repeated phrase, a skipped line), matching the last 8 words heard. A missing
  or extra word counts half. At least 3 words must match (2 if only 2 were heard): one word alone, like "tiny",
  is too often somewhere else in the script. A place more than 6 words away needs 4: in a script full of "The …"
  sentences a few words fit many places and it skipped ahead (found by the user).
- Each word away costs a fiftieth of a match, so the nearer of two about equal places wins and a repeated phrase
  doesn't jump ahead. The teleprompter also follows a far place only when two hearings in a row agree.
- Between hearings (EX-12): hearings come about 4 times a second and each ends a word early or late, so following
  the last one alone made the marker jerk (found by the user). `addMark` keeps the last 4 s of places heard
  (afresh after a step back of more than `LEAD` (3) words or a jump), `voiceAt` fits a straight line through them
  (where the voice is now, and its pace), at most `LEAD` words past the last place heard, and `move` goes there at
  that pace, a little faster when behind and slower when ahead, never snapping. Tuned in a simulation (noisy
  hearings at 150 words a minute): the speed's wobble went from 1.8 to 0.3 words a second, with no stops.
- The script's words must be counted exactly as `countWords` counts them (split on spaces after `clearMarks`),
  or the marker drifts from the line it shows: keep empty normal words, don't filter them out.
