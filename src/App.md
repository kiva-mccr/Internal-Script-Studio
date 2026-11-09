# `src/App.svelte`

The app's one page: finds the remembered folder (`lib/remember.ts`), shows the first-time screen if there is none,
then the screen the link names (`lib/route.ts`). The list and the script are placeholders until AP-4 and AP-5.

- **Tests:** `tests/e2e/app.spec.ts`, `tests/e2e/setup.spec.ts`.

## Rules and pitfalls

- Colours come from the variables in `app.css`, never copied into a component.
- The link's `#/…` is never touched by the first-time screen, so a link still opens its script after set-up.
