# `src/screens/AfterEditor.svelte`

The editing of a hold or placeholder (SB-1): seconds with − and + (half seconds for a hold, whole for a
placeholder), and a placeholder's words. Shown under a bar in the script and in the timeline's panel.

- **Used by:** `screens/TimelineBar.svelte`, `screens/Timeline.svelte`. **Tests:** `tests/e2e/timeline.spec.ts`.

## Rules and pitfalls

- The words save as they are typed (`onSet` on every input), like a field; the line keeps no `"` (`writeChoices`
  turns one into ”).
