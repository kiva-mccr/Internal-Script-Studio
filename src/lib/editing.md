# `src/lib/editing.ts`

"Sam is editing": one small file per person in `.studio/editing/` (docs/studio-folder.md), rewritten every 30 s
while the script is open and removed on leaving.

- **Used by:** `lib/saving.svelte.ts`, `screens/Editor.svelte` (removes yours on leaving). **Tests:** `tests/unit/editing.test.ts`, `tests/e2e/conflict.spec.ts`.

## Rules and pitfalls

- The only rewritten files in `.studio/`; each is written only by its own person, so they never clash in OneDrive.
- A file whose `seen` is over 2 minutes old means the person has gone (closed laptop); it is not shown, but its
  `last_written` still credits their last save to them when the script is opened.
- File names come from the person's name, lowercased, with anything but letters and digits made `-`; your own file
  is matched by that name, not by exact spelling.
- A half-synced file that can't be read is skipped.
