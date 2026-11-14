# `src/screens/Shortcuts.svelte`

The Keyboard shortcuts part at the bottom of Settings (AP-44, board 65): every key the app knows, by where it works.
The nine in `lib/shortcuts.svelte.ts` are buttons: click one, press the new key, and it is kept in this browser;
Reset (shown only when changed) puts the default back. The rest (Tab, Ctrl+B …, Ctrl+F, Ctrl+S, Space / Esc) are
listed as they are.

- **Used by:** `screens/Settings.svelte`. **Tests:** `tests/e2e/shortcuts.spec.ts`.

## Rules and pitfalls

- While a key is being changed, its button has the keyboard and stops the key (`stopPropagation`), so the page's own
  window keys (Alt+N in Comments, Esc closing Settings, Ctrl+S) don't also act on it. Esc stops changing, Tab or a
  click away gives up.
- Refused with a message under the line, never a browser dialog: no Ctrl or Alt (typing would break), a key another
  action has, or one in `TAKEN` (the browser's and the app's own).
- When a key is a list entry here, keep its words in step with README.md and the roadmap.
