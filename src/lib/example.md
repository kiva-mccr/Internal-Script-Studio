# `src/lib/example.ts`

The example to try (AP-33): the made-up script in `docs/example/` copied into the browser's private storage as a
folder called "Example", with its drawings in `assets/`, two History entries and two comments by made-up people. Also
Start over and its Undo, and whether the offer on the first-time screen is folded.

- **Used by:** `App.svelte`, `screens/Setup.svelte`. **Tests:** `tests/e2e/example.spec.ts`.

## Rules and pitfalls

- The example's files are bundled at build time: a change in `docs/example/` alone is a docs-only push, which
  doesn't redeploy (it waits for the next code change). Many tests read its `script.md`: change its words with care.
- It is made only once; later visits get it back as they left it. Start over keeps the old copy (in "Example before
  start over") until the next Start over, so Undo can bring it back.
- The History and comments are written through `addVersion` and `addNote`, so they stay in the real format.
