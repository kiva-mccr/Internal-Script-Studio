# `src/lib/mic.ts`

Pick the microphone (AU-3, mock-up 19): `chosenMic`/`chooseMic` (the mic's id and name, kept in this browser with
`recall`/`keep`), `listMics` (the browser's microphones) and `openMic` (the stream from the picked mic, or the
default when it isn't there).

- **Used by:** `lib/voice.svelte.ts` (`record`), `screens/Settings.svelte`, `screens/Write.svelte` (the unplugged
  notice). **Tests:** `tests/unit/mic.test.ts`, `tests/e2e/settings.spec.ts`.

## Rules and pitfalls

- Chrome hides the microphones' names and ids until the page may use the mic, so before the first take
  `listMics` lists none and Settings shows only Default. The "default" and "communications" entries Chrome adds
  are left out: Default already stands for them.
- The id is asked for `exact`, so a mic that's gone fails with OverconstrainedError (not always a DOMException) or
  NotFoundError; `openMic` then records with the default and says `fellBack`. Any other error (blocked) is thrown.
- The name is kept beside the id so the notice and the drop-down can name a mic that is unplugged.
- Tests stand in with `window.studioMics`; `window.studioRecord` is handed the picked id.
- Never tried with real microphones here: the test browser has none.
