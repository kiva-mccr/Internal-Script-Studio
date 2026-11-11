# `src/App.svelte`

The app's one page: finds the remembered folder (`lib/remember.ts`), shows the first-time screen if there is none,
then the screen the link names (`lib/route.ts`): the list for `#/`, a script for `#/<folder name>`.

- **Tests:** `tests/e2e/app.spec.ts`, `tests/e2e/setup.spec.ts`.

## Rules and pitfalls

- Colours come from the variables in `app.css`, never copied into a component.
- The link's `#/…` is never touched by the first-time screen, so a link still opens its script after set-up.
- A small GitHub link sits in the bottom right corner of every screen (asked by the user), clear of the messages
  at the bottom centre.
- The editor is keyed by the script's path, so following a link to another script starts it fresh.
- A link ending in `?review` (a shared link, RV-10) opens the script on Review. The mark is taken out of the address
  with `history.replaceState` (no hashchange), so a reload after moving to Write stays in Write.
