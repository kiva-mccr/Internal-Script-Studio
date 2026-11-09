# `src/lib/history.ts`

A script's history: one JSON file per version in `.studio/versions/` (docs/studio-folder.md), written once and
never changed. Also what changed between two versions: a title ("Edited rows 3 and 4") and each changed field.

- **Used by:** `lib/folder.ts`, `screens/Editor.svelte`, `screens/History.svelte`. **Tests:**
  `tests/unit/history.test.ts`, `tests/e2e/history.spec.ts`.

## Rules and pitfalls

- File names only sort to the second. Versions made in the same second are ordered parent first (by how many
  versions lie before them); sorting by name alone put them in a random order (bug found while building).
- A file that can't be read (half-synced) is skipped, never an error.
- Rows are matched by id, so a moved row is not "edited".
