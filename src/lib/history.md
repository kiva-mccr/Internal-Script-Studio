# `src/lib/history.ts`

A script's history: one JSON file per version in `.studio/versions/` (docs/studio-folder.md), written once and
never changed. Also what changed between two versions: a title ("Edited rows 3 and 4") and each changed field.

- **Used by:** `lib/folder.ts`, `lib/saving.svelte.ts`, `screens/Editor.svelte`, `screens/History.svelte`, `screens/Print.svelte` (through Editor). **Tests:**
  `tests/unit/history.test.ts`, `tests/e2e/history.spec.ts`.

## Rules and pitfalls

- File names only sort to the second. Versions made in the same second are ordered parent first (by how many
  versions lie before them); sorting by name alone put them in a random order (bug found while building).
- A file that can't be read (half-synced) is skipped, never an error.
- Rows are matched by id, so a moved row is not "edited".
- A row's `Change` carries its `row` id and `field` (as comments name it, `on_screen`), so History can put a comment
  under it (RV-6); a removed row has only `row`.
- Official versions (kind `official`, or a send for review with `official: true`, RV-9: `isOfficial`) get their
  number from `officialNumbers`, by the order they were made; never stored. `officialNumber` says which one the
  script still is (printing), or 0 once anything has changed since the newest. "Changed" is `sameScript`: the
  `status` and `authors` lines are left out, since a send, approve or a save by someone new changes them.
- `sendVersion` decides what a send makes: the next number, or `still` the newest one when nothing changed, however
  that one was made (the user's rule: never a duplicate).
- `message` (RV-8, RV-13) is written only when there is one. `reviewNote` is the newest review change, if it was a send
  with a note; sent back or approved since means none. `backNote` is the newest review change if it was a send back
  (note or not), for the top of Write's Comments tab.
- `reviewEnd` is the newest `review` entry whose note starts "Sent back" or "Approved" (also "Approved, 2 still
  open"), never a send: a second round compares with when the first ended. `sinceReview` matches rows by id, like
  `describe`, so a moved row is not changed (RV-4).
- `heads` are the versions nothing was made from: two mean two saves at the same time, and `ancestor` is the
  newest version both came from (what `lib/merge.ts` compares them with). A merge version has two parents.
