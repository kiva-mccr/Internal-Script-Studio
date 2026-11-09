# `src/lib/route.ts`

Turns the link's `#/…` part into the path of a script inside the picked folder, and back.

- **Used by:** `App.svelte`. **Tests:** `tests/unit/route.test.ts`, `tests/e2e/app.spec.ts`.

## Rules and pitfalls

- `.` and `..` are dropped, so a link can never reach outside the picked folder.
