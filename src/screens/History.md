# `src/screens/History.svelte`

The History screen (mock-up 5): versions newest first (what changed, who, when); the picked one's changes, old
struck through and new in green, compared with the version it was made from; Restore this version.

- **Used by:** `screens/Editor.svelte` (the Write · History switch). **Tests:** `tests/e2e/history.spec.ts`.

## Rules and pitfalls

- The newest version is the current one: no Restore button on it.
