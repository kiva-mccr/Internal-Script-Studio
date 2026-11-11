# `src/lib/voiceexport.ts`

The voice-over as one file (EX-11, asked by the user for their work): `readClips` (each row's take, in row order,
decoded to mono), `join` (one after another) and `wav` (a 16-bit WAV).

- **Used by:** `screens/Editor.svelte` (Export → Voice-over). **Tests:** `tests/unit/voiceexport.test.ts`,
  `tests/e2e/voice.spec.ts`.

## Rules and pitfalls

- WAV, not webm: video editors don't take the browser's recordings.
- Decoding uses an `OfflineAudioContext` at the output rate: it needs no click and resamples every take to 48 kHz.
- A row with no take, or a take that can't be read, is left out; the Editor says how many rows are missing.
- No gap between takes (`join`'s `gap` is 0): the user asked for the takes joined, nothing more.
- Never tried on Chrome's real webm takes here: tests record a WAV.
