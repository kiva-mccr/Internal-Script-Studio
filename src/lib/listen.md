# `src/lib/listen.ts` and `src/lib/speech.worker.ts`

Listening for the teleprompter (EX-8, EX-12). `listen` opens the microphone, starts speech recognition in a worker
(download progress), then sends the last 4 s of sound as soon as the last hearing is done (at most 4 times a second)
and hands back what was heard. The worker runs `onnx-community/moonshine-base-ONNX` through transformers.js: on the
graphics card (WebGPU) when there is one, otherwise on WebAssembly.

- **Used by:** `screens/Teleprompter.svelte`. **Tests:** `tests/e2e/teleprompter.spec.ts` (with a stand-in).

## Rules and pitfalls

- Nothing is uploaded: the model comes from Hugging Face once and the browser keeps it; sound stays in the page.
- The microphone is asked for first, so a refusal doesn't cost a 75 MB download. Errors are `ListenError`
  ('microphone' or 'download') and the teleprompter shows a plain message for each.
- The AudioContext runs at the device's rate and `resample` brings it to 16 kHz: some phones refuse a 16 kHz
  microphone. It is made at once, inside the click
  that switched it on, and resumed: made after the download, it had lost that click, and Chrome on Android kept
  it paused (a Pixel 8 didn't move), and the tap is connected to the speakers (silent) so every browser runs it.
- Three failed hearings in a row, or the worker dying (a phone out of memory), call `onFail`: the teleprompter
  says so and goes back to Start. Before this, a phone just didn't move (found by the user).
- A last second of silence is not sent: speech models make up words ("Thank you.") in silence.
- Only one piece is heard at a time; sound that arrives meanwhile waits for the next one.
- Why Moonshine (EX-12, agreed with the user): Whisper always works through 30 s of sound, padding a 4 s clip with
  silence, so each hearing cost as much as 30 s of speech (the delay was Whisper itself, not the cutting up or the
  matching, which takes 0.03 ms). Moonshine's work grows with the clip. If it mishears the user more than Whisper
  did, the agreed fallback is `Xenova/whisper-base.en` on WebGPU (it can also take the coming script as a hint).
- WebGPU is tried first and the model run once on a second of silence: a graphics card that can't run it fails
  there, and the processor takes over (its download counted afresh). Headless test Chromium has no adapter.
- GitHub Pages can't send the headers for threads (cross-origin isolation), so ONNX runs on one thread: slower.
- Tests can't use a microphone or download the model: `window.studioListen`, when a test sets it, stands in for
  `listen`. This container can't reach Hugging Face either, so real hearing is checked by the user.
- The pipeline's own types are too large for svelte-check, so the worker types `pipeline` loosely.
