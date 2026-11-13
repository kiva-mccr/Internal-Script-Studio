# `src/screens/Comments.svelte`

Write's Comments tab (RV-13, board 37 idea A): the open comments and suggestions as cards (`CommentCard.svelte`) to
reply to, resolve and accept or reject while editing, then Resolved. The send back's note sits at the top while
the script is a draft again. New comments are started in Review only.

- **Used by:** `Editor.svelte`, inside the side panel (`Planning.svelte`). **Tests:** `tests/e2e/comments.spec.ts`.

## Rules and pitfalls

- `active` is bound to the Editor (`talking`): a bubble or a quote in Write sets it and this scrolls that card into
  view; clicking a card sets it and asks the Editor to scroll Write to its row (`onShow`).
- Decided and resolved cards stay in place with Undo (`recent`) until the tab is left (it is unmounted then).
- "Use in script" (RV-12) is on open cards whose row still exists; the Editor copies the file (`onUse`).
- Where a card is: "row 3, Dialogue", or "row 3" for a comment on the whole row.
