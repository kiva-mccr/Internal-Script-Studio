# `src/lib/historycomments.ts`

Comments in History (RV-6, board 48): `placeComments` puts each comment and suggestion on one version, under the
cell it led to change, or on the version current when it was made if nothing has changed it since. `stateText` is
the label History shows (Open, Resolved by Sam, Accepted by Sam …).

- **Used by:** `screens/History.svelte`. **Tests:** `tests/unit/historycomments.test.ts`, `tests/e2e/history.spec.ts`.

## Rules and pitfalls

- A comment goes on the first version made after it that changed its cell (row and field), compared with the
  version that one was made from. Any change to the cell counts, not only to the quoted words.
- Versions are written at most every 5 minutes, with the text as it is then: a comment made just after an edit
  but before its version was written lands on that version. Accepted, as the edit came close to it anyway.
- Comment times keep milliseconds and version times seconds: both are compared as times, never as strings.
- A comment made before the first version (the folder had comments before History) goes on the first version.
- Nothing is stored: it is all worked out from the versions and the comments each time History opens.
