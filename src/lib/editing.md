# `src/lib/editing.ts`

"Sam is editing": a small file per person in `.studio/editing/` (docs/studio-folder.md), a new one every 30 s while
the script is open (the person's older ones removed), all removed on leaving. `writerOf` says whose a script.md is.

- **Used by:** `lib/saving.svelte.ts`, `screens/Editor.svelte` (removes yours on leaving). **Tests:** `tests/unit/editing.test.ts`, `tests/e2e/conflict.spec.ts`.

## Rules and pitfalls

- Never rewritten (FX-2): a new `sam_<time>.json` each time, since a network drive refuses to replace a file another
  computer is reading. The newest per person counts; `sam.json` from before is read and removed too.
- `since` is when the person opened the script: the earliest among fresh files is the keeper (`lib/saving.svelte.ts`).
- A file whose `seen` is over 2 minutes old means the person has gone (closed laptop); it is not shown, but its
  `last_written` still credits their last save to them when the script is opened.
- File names come from the person's name, lowercased, with anything but letters and digits made `-`; your own file
  is matched by that name, not by exact spelling.
- A half-synced file that can't be read is skipped.
