# `src/screens/Setup.svelte`

The first-time screen (mock-up 1): your name, Choose folder, and the "Before you start" OneDrive steps. Also the
"Welcome back" screen when the browser wants permission for the remembered folder again, and the Chrome-or-Edge
note for other browsers.

- **Used by:** `App.svelte`. **Tests:** `tests/e2e/setup.spec.ts`.

## Rules and pitfalls

- The folder picker and the permission prompt only open from a click, so both are called straight from the
  button's handler, before anything else is awaited.
- A missing name is said in the page (`novalidate`), not by the browser's bubble.
- Closing the picker is not an error (no message).
