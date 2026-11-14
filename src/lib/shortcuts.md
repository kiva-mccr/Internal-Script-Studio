# `src/lib/shortcuts.svelte.ts`

Keyboard shortcuts (AP-44, board 65): the nine keys that can be changed (rows in Write, next and previous comment),
their defaults, the ones changed in this browser (`shortcuts.changed`, localStorage `shortcuts`), matching a key press
(`match`, `comboOf`), showing a key (`show`) and stepping through comments (`stepComment`).

- **Used by:** `screens/Write.svelte`, `WriteRow.svelte`, `Comments.svelte`, `ReviewComments.svelte`, `Shortcuts.svelte`.
  **Tests:** `tests/unit/shortcuts.test.ts`, `tests/e2e/shortcuts.spec.ts`.

## Rules and pitfalls

- No key switches between Write, Review, History or Assets (the user's rule): never add one here.
- Next and previous comment only move: replying, resolving, accepting and rejecting stay clicks, so each person
  engages with each comment (the user's rule; accepting many at once is rejected in ROADMAP.md).
- A combo is "Ctrl+Alt+Shift+Key". Ctrl stands for ⌘ too. Letters and digits come from `e.code`, because Alt on a Mac
  changes the letter typed (Alt+N is "˜"); a test checks this.
- A saved key that is no longer an action is dropped on reading, so renaming an action resets it to the default.
