# `src/lib/cleanup.svelte.ts`

Clean-up for voice-over takes (AU-4, board 31): `cleaning` and `setCleaning` (the three switches in Settings, kept in
this browser), `measure` (where the speech is in a recording and how loud) and `span` (what of a take to play, and
how loud, as the switches say).

- **Used by:** `lib/voice.svelte.ts` (measures each new take; `Sound`, `takeLength`, `wpm`), `lib/voiceexport.ts`
  (`cleaned`), `screens/Settings.svelte`, `screens/Write.svelte`. **Tests:** `tests/unit/cleanup.test.ts`,
  `tests/e2e/cleanup.spec.ts`.

## Rules and pitfalls

- Never cut the recording itself: the webm stays whole and the crop and gain are notes in the take's JSON, so a crop
  that cuts too much is undone by a switch (the user's choice over rewriting the file).
- Crop and loudness apply when played, to every take that was measured; noise reduction is Chrome's own while
  recording, so it only changes later takes. Takes from before AU-4 have no measure and play whole.
- `measure`: loudness every 10 ms; "loud" is a tenth of the voice's level (the loudest 5 %) and 4x the quietest tenth.
  Loud bits less than 0.25 s apart join up; a sound shorter than 0.15 s on its own (a click, a breath) isn't speech.
  Only the start and end are cut, with 0.25 s kept either side: pauses in the middle stay.
- Bug fixed: "loud" used to be 3x the room's noise, so in a real room hiss, breaths and rustles counted as speech and
  next to nothing was cropped (the tests' tones were silent between words). Keep a noisy-room test.
- The gain brings the speech's loudness to about -20 dBFS, never pushes a sample past 0.9, and stays between 0.25 and 8.
- Tuned on made-up tones in tests only: never tried on a real voice or a noisy room.
