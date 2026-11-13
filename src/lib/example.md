# `src/lib/example.ts`

The example to try (AP-33): the made-up script in `docs/example/` copied into the browser's private storage as a
folder called "Example", with its made-up files in `assets/` (one of each kind the app previews, AP-34), a
voice-over take on every row in `voice/`, two History entries and two comments by made-up people. Also
Start over and its Undo, and whether the offer on the first-time screen is folded.

- **Used by:** `App.svelte`, `screens/Setup.svelte`. **Tests:** `tests/e2e/example.spec.ts`.

## Rules and pitfalls

- The example's files are bundled at build time: a change in `docs/example/` alone is a docs-only push, which
  doesn't redeploy (it waits for the next code change). Many tests read its `script.md`: change its words with care.
- It is made only once; later visits get it back as they left it. Start over keeps the old copy (in "Example before
  start over") until the next Start over, so Undo can bring it back.
- The History and comments are written through `addVersion` and `addNote`, so they stay in the real format.
- Start over and Undo remove the example while its script is open, and the open script may be writing a file in it
  just then: removing fails while a file is being written, so `removeWhenFree` tries again (Undo did nothing now and
  then, seen as a flaky test under load).
- Many tests list the example's files (review.spec.ts reads its `assets/` folder): adding a file to a row means
  updating the tests that expect that row's Files lines.
- The takes are a made-up voice (espeak-ng with the MBROLA us2 voice, then Opus in webm); each JSON's `text` is the
  row's dialogue exactly, or the take shows Outdated. Accepting Ana's suggestion on row 2 makes its take Outdated.
- An example made before files were added keeps its old copy until Start over.
