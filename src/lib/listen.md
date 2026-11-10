# `src/lib/listen.ts` and `src/lib/whisper.worker.ts`

Listening for the teleprompter (EX-8). `listen` opens the microphone, starts Whisper in a worker (download
progress), then sends the last 4 s of sound about once a second and hands back what was heard. The worker runs
`Xenova/whisper-base.en` at 8 bits (about 75 MB) through transformers.js, on WebAssembly.

- **Used by:** `screens/Teleprompter.svelte`. **Tests:** `tests/e2e/teleprompter.spec.ts` (with a stand-in).

## Rules and pitfalls

- Nothing is uploaded: the model comes from Hugging Face once and the browser keeps it; sound stays in the page.
- The microphone is asked for first, so a refusal doesn't cost a 75 MB download. Errors are `ListenError`
  ('microphone' or 'download') and the teleprompter shows a plain message for each.
- The AudioContext runs at the device's rate and `resample` brings it to 16 kHz: some phones refuse a 16 kHz
  microphone. It is resumed after it is made (made after the download, it has lost the click that allows sound,
  and phones start it paused), and the tap is connected to the speakers (silent) so every browser runs it.
- Three failed hearings in a row, or the worker dying (a phone out of memory), call `onFail`: the teleprompter
  says so and goes back to Start. Before this, a phone just didn't move (found by the user).
- A second of silence is not sent: Whisper makes up words ("Thank you.") in silence.
- Only one piece is heard at a time; sound that arrives meanwhile waits for the next one.
- GitHub Pages can't send the headers for threads (cross-origin isolation), so ONNX runs on one thread: slower.
- Tests can't use a microphone or download the model: `window.studioListen`, when a test sets it, stands in for
  `listen`. This container can't reach Hugging Face either, so real hearing is checked by the user.
- The pipeline's own types are too large for svelte-check, so the worker types `pipeline` loosely.
