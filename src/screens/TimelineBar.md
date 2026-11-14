# `src/screens/TimelineBar.svelte`

A hold or placeholder after a row (SB-1), shown in the script as a full-width bar between rows (the user's ask on
board 63). A click opens the same editing as the timeline's panel (`AfterEditor.svelte`) under it; ✕ removes it at
once, with Undo in the Undo bar. Orange while it plays.

- **Used by:** `screens/Write.svelte`. **Tests:** `tests/e2e/timeline.spec.ts`.

## Rules and pitfalls

- It holds nothing itself: open is Write's `chosen` (the same as the timeline's pick), and changes go to the row's
  Timeline line through Write.
- No browser dialog for ✕ (the user's rule): Write hands the blocks as they were to the Editor's Undo bar.
