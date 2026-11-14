# `src/lib/waveform.ts`

A take's waveform for the storyboard timeline (SB-1): the take decoded at 8 kHz, cropped and made louder as it plays
(`cleaned`), then the loudest sample in each of 200 parts (`peaksOf`), drawn as an SVG path (`wavePath`).

- **Used by:** `screens/Timeline.svelte`. **Tests:** `tests/unit/waveform.test.ts` (the decoding only in e2e).

## Rules and pitfalls

- Made once per take for the visit (keyed by row, recording time and crop); a take that can't be read gives null
  and the timeline shows no waveform for it.
