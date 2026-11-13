# `src/screens/Setup.svelte`

The first-time screen (mock-up 1): your name, Choose folder, and the "Before you start" OneDrive steps. Also the
"Welcome back" screen when the browser wants permission for the remembered folder again, and the Chrome-or-Edge
note for other browsers. Under the folder steps, the offer of the example to try (AP-33, board 46), which the – folds
to one line, remembered by the browser (`lib/example.ts`).

- **Used by:** `App.svelte`. **Tests:** `tests/e2e/setup.spec.ts`, `tests/e2e/example.spec.ts`.

## Rules and pitfalls

- The folder picker and the permission prompt only open from a click, so both are called straight from the
  button's handler, before anything else is awaited.
- A missing name is said in the page (`novalidate`), not by the browser's bubble.
- Closing the picker is not an error (no message).
- The first line doesn't name OneDrive (AP-20): a team may sync another way. Only "Before you start" is about OneDrive.
- The example is not offered on "Welcome back" (a real folder is already picked) nor in other browsers.
