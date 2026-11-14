# `src/lib/started.ts`

The line before you started (AP-38, board 54): `Started` keeps each row's Dialogue and On screen as they were when
the script was opened, so Write can show them under a cell you have changed ("▸ Before you started", Put it back).

- **Used by:** `lib/saving.svelte.ts` (a `Saving` holds one as `started`), read by `screens/Editor.svelte` →
  `Write.svelte` → `WriteRow.svelte`. **Tests:** `tests/unit/started.test.ts`, `tests/e2e/started.spec.ts`.

## Rules and pitfalls

- Taken from the page's script right after opening (`take`), not from the text: rows with no id in the file get one
  only on loading.
- Only your own changes may show, so `Saving` calls `follow(before, after)` wherever someone else's change goes into
  `shared` (a change file in `sync`, an edit outside the app in the keeper's work): a field they changed takes their
  words; a row they added starts with their words. Your own saves never go through it, so they never move "before".
- Rows you add have no entry, so they show no "Before you started". Leaving the script (or reloading) starts afresh.
- `rows` is a `SvelteMap`, so Write follows a change made by `follow`.
