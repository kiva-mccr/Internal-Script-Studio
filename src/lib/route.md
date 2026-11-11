# `src/lib/route.ts`

Turns the link's `#/…` part into the path of a script inside the picked folder, and back. Shared links (RV-10:
Copy link, Copy for Teams) come from `shareLink` and end in `?review`, which `opensReview` reads.

- **Used by:** `App.svelte`, `Header.svelte`, `Editor.svelte`. **Tests:** `tests/unit/route.test.ts`, `tests/e2e/app.spec.ts`.

## Rules and pitfalls

- `.` and `..` are dropped, so a link can never reach outside the picked folder.
- `?review` is cut off before the path is read, so it never becomes part of a folder name.
