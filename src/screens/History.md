# `src/screens/History.svelte`

The History screen (mock-up 5): versions newest first (what changed, who, when); the picked one's changes, old
struck through and new in green, compared with the version it was made from; Restore this version. Publish
official version (mock-up 7): a named version, v1, v2 …; with any, the small saves between them fold into one line.

- **Used by:** `screens/Editor.svelte` (the Write · History switch). **Tests:** `tests/e2e/history.spec.ts`.

## Rules and pitfalls

- Old and new text show formatting, as Write does.
- A send for review with a note shows the note under its entry (`message`, RV-8), lines kept.
- The newest version is the current one: no Restore button on it.
- An official version is compared with the official one before it (v1 with the version it was made from).
- With official versions, History opens on the newest official one, not the newest save.
- The Publish button sits outside the `Versions` nav, so the nav's buttons are only versions (tests count them).
- Publishing goes through `Editor.svelte` (`onPublish`): what is waiting is saved first, then script.md as it is
  on disk is what gets published.
