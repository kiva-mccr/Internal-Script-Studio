# `src/screens/Settings.svelte`

The Settings window (AU-3, mock-up 19), opened from ⋯ in the top bar. Drawn in the page (no browser dialog). Each
kind of setting has its own small heading; the first is Voice-over, with the Microphone drop-down (`lib/mic.ts`) and the three clean-up switches (AU-4, board 31, `lib/cleanup.svelte.ts`); then Read time (AP-12, board 21), the speaking
speed with − and + (10 at a time) and "Use N", the takes' speed, when the script has takes and N isn't the speed already.
A choice takes effect at once and is kept in this browser only.

- **Used by:** `screens/Header.svelte`. **Tests:** `tests/e2e/settings.spec.ts`.

## Rules and pitfalls

- A new setting goes under its own heading here. If the window grows long, the headings become a list down the
  left (the agreed way to grow it).
- Closes with ×, Done, Esc or a click on the dimmed page around it.
- The picked mic stays in the drop-down while it is unplugged, so it still shows as picked.
- The Write screen has a file chip called "leaf-closeup.jpg": tests pick ×'s "Close" with `exact: true`.
- The speed box sets the speed on change (leaving the box or Enter), then shows the speed as kept (60 to 400).
