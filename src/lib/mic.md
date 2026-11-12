# `src/lib/mic.ts`

Pick the microphone (AU-3, mock-up 19): `chosenMic`/`chooseMic` (the mic's id and name, kept in this browser with
`recall`/`keep`), `listMics`/`micsFrom` (the browser's microphones, the computer's default marked `isDefault`, AU-5) and `openMic` (the stream from the picked mic, or the
default when it isn't there).

- **Used by:** `lib/voice.svelte.ts` (`record`), `screens/Settings.svelte`, `screens/Write.svelte` (the unplugged
  notice). **Tests:** `tests/unit/mic.test.ts`, `tests/e2e/settings.spec.ts`.

## Rules and pitfalls

- Chrome hides the microphones' names and ids until the page may use the mic, so before the first take
  `listMics` lists none and Settings shows one "Computer's microphone (default)" row. The "default" and
  "communications" entries Chrome and Edge add are left out; "default" marks the real mic with the same `groupId`
  (by name when one device has two mics). With no "default" entry the first mic is taken as the default.
- '' (no id) means follow the default, so picking the "(default)" row keeps following it if the computer's changes.
- The id is asked for `exact`, so a mic that's gone fails with OverconstrainedError (not always a DOMException) or
  NotFoundError; `openMic` then records with the default and says `fellBack`. Any other error (blocked) is thrown.
- The name is kept beside the id so the notice and the drop-down can name a mic that is unplugged.
- `openMic`'s `noise` turns the browser's noise reduction on or off (Settings, AU-4); echo cancellation stays on.
- Tests stand in with `window.studioMics` (the browser's device list, run through `micsFrom`); `window.studioRecord` is handed the picked id.
- Never tried with real microphones here: the test browser has none.
