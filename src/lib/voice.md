# `src/lib/voice.svelte.ts`

Voice-over per line (AU-1, board 13): `record` (the microphone through MediaRecorder), `VoiceOver` (the takes by row
id as state, with start, stop, play, remove and load), `readTakes` (a folder's takes, also for the script list's lengths), `takesSpeed` (all takes' words a minute, offered in Settings), `wpm`, `outdated` and `takeFile` (a take's sound, also for Play the script, `lib/play.svelte.ts`).

- **Used by:** `screens/Editor.svelte` (makes one), `screens/Write.svelte`, `lib/play.svelte.ts`. **Tests:** `tests/unit/voice.test.ts`,
  `tests/e2e/voice.spec.ts`.

## Rules and pitfalls

- A take is voice/row-<id>.webm plus voice/row-<id>.json (by, at, seconds, text). The length is timed while
  recording and kept in the JSON: Chrome's recorded webm has no duration in it.
- `text` is the dialogue as it was read; the take is "Outdated" once the line no longer matches it.
- `wpm` counts the take's `text`, never the row's current dialogue: it used to, so typing in a recorded row changed
  the figure against the old recording.
- These files are rewritten when a take is recorded again (unlike `.studio/`, which is written once).
- `record` uses the mic picked in Settings (`lib/mic.ts`); `start` returns true when that mic was unplugged and the
  default recorded instead, and Write says so.
- Tests replace the microphone with `window.studioRecord`, which returns a short real WAV so playback works.
- AU-4: `start` sets `cue` for a second (the ring in Write); `cancel` throws a take away. `stop` decodes the take and
  `measure`s it (`lib/cleanup.svelte.ts`): `from`, `to` and `gain` go in the JSON beside `seconds` (still the whole
  recording, as timed). Nothing heard, or a take from before: none, and it plays whole.
- Everything that times or plays a take goes through `span`/`takeLength`/`Sound`, never `take.seconds` alone: Write's
  ▶, wpm, the top bar, the script list, Play the script and the joined WAV (`voiceexport.cleaned`).
- `Sound` plays through Web Audio (its own AudioContext), not an <audio>: the crop is exact and the gain can go over 1.
  Pause suspends that context.
- Never tried with a real microphone here: the test browser has none.
