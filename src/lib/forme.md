# `src/lib/forme.ts`

What in one script waits for you (RV-14, board 43): `review` (In review and someone else sent it), `replies` (open
comments you wrote in whose newest word is someone else's) and `back` (a draft whose newest review change sent back
a send of yours). `waiting` says whether any of them is true. The script list labels rows with them and filters on
them ("For me").

- **Used by:** `screens/List.svelte`. **Tests:** `tests/unit/forme.test.ts`, `tests/e2e/list.spec.ts`.

## Rules and pitfalls

- Nothing is stored per person: it comes from History and the comment files, so it is the same on every computer
  and drops off by itself (Approved or Sent back ends a review; answering or resolving ends a reply).
- No reviewers are assigned (roles on trust): everyone but the sender counts. A script In review with no "Sent for
  review" in History (status typed by hand) waits for everyone.
- Names are compared trimmed and ignoring case; with no name, nothing waits.
- `threads()` already leaves out deleted comments and replies, and keeps the newest text.
- Comments on hold (RV-19) don't count as answered replies until a send or a version brings them back
  (`holdEnds(versions)`).
