# `src/screens/Teleprompter.svelte`

The teleprompter (EX-2, mock-up 10): full screen, the dialogue big and section names small, scrolling past a marker a
third of the way down at a speed in words a minute. Start/Pause, speed, text size, Mirror (for a teleprompter
glass), On-screen cues (the On screen column, small), time left, Exit. Keys: Space, ↑ ↓ (speed), Esc. Follow my
voice (EX-8, `lib/listen.ts`, `lib/follow.ts`): the marker follows the words heard instead of the speed.

- **Used by:** `screens/Editor.svelte` (the Teleprompter button in `Header.svelte`). **Tests:**
  `tests/e2e/teleprompter.spec.ts`.

## Rules and pitfalls

- Where it is, is a number of words read (`read`), not a scroll position: each frame adds speed × time, then
  scrolls so that word sits at the marker (interpolated inside its line). Text size, cues and mirror move the
  lines, so it is placed again after each change. Lines are measured with getBoundingClientRect (the mirror's
  transform must not change offsets).
- Scrolling by hand: any scroll it didn't make itself (more than 2 px from the last one it set) moves `read` to the
  word now at the marker.
- Rows with no dialogue have no line. Lines already read are dimmed.
- Its choices (speed, size, mirror, cues) are kept with `recall`/`keep`; read time (AP-12) is to share the speed.
- It asks for full screen; a refusal (tests, some browsers) is ignored. In full screen the first Esc is the
  browser's (leaves full screen), the next one closes it.
- Space would also press a focused button: the key handler prevents the default.
- Each dialogue word is wrapped in a span (`wordSpans`, after `{@html}`), numbered like `read`, so the words
  already said are greyed out one by one (asked by the user); only the ones that change are touched each frame.
- Follow my voice hides Start and the speed. The marker glides to where the voice was heard (and snaps the last
  bit, or it would never quite arrive and the line would never dim). A failed start unticks the box by hand: the
  click ticked it while `voice` stayed ''.
