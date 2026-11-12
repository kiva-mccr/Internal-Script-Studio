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
- It opens at the first line from block `from` on (AU-7; the Editor works out where you were), so the lines before
  count as read and Follow my voice listens from there (`heardAt` starts at `read`). ⤒ From the top sets `read` to 0
  and clears the voice's marks; it is greyed while already at the top. At the top the scroll isn't 0 (the section
  heading's margin), so tests compare the line with the marker.
- Its choices (size, mirror, cues) are kept with `recall`/`keep`. The speed is the speaking speed shared with read time
  (AP-12, `speaking` in `lib/readtime.svelte.ts`), so ↑ ↓ here change Settings' speed too.
- It asks for full screen; a refusal (tests, some browsers) is ignored. In full screen the first Esc is the
  browser's (leaves full screen), the next one closes it.
- Space would also press a focused button: the key handler prevents the default.
- Each dialogue word is wrapped in a span (`wordSpans`, after `{@html}`), numbered like `read`, so the words
  already said are greyed out one by one (asked by the user); only the ones that change are touched each frame.
- `listen()` must be called straight from the click, before any await (it makes the AudioContext there).
- Follow my voice hides Start and the speed. Each hearing adds a mark; the marker moves smoothly to where the
  marks say the voice is now (EX-12, `voiceAt` and `move` in `lib/follow.ts`). A far place is followed only when
  the next hearing agrees (`jump`). A hand scroll clears the marks, so it waits there for the voice.
- The page behind loses its scroll bar while the teleprompter is open (`overflow: hidden` on the html element, put
  back on close): it used to show one that moved nothing (found by the user). The teleprompter's own is thin. A failed start unticks the box by hand: the
  click ticked it while `voice` stayed ''.
