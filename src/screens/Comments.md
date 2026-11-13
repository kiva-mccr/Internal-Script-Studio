# `src/screens/Comments.svelte`

Write's Comments tab (RV-13, board 37 idea A): the open comments and suggestions as cards (`CommentCard.svelte`) to
reply to, resolve and accept or reject while editing, then Resolved. The send back's note sits at the top while
the script is a draft again. New comments are started in Review only.

- **Used by:** `Editor.svelte`, inside the side panel (`Planning.svelte`). **Tests:** `tests/e2e/comments.spec.ts`.

## Rules and pitfalls

- `active` is bound to the Editor (`talking`): a bubble or a quote in Write sets it and bumps `goTo`, and this
  scrolls that card into view and flashes it. The scroll follows `goTo`, not `active`, so asking for the card that is
  already selected scrolls back to it (RV-17); clicking a card sets it and asks the Editor to scroll Write to its
  row (`onShow`).
- Decided, resolved and held cards stay in place with Undo (`recent`, a `Linger`) for 5 seconds, each on its own
  timer, then move into Resolved or On hold (RV-18, RV-19), sliding away (`out:slideAway` on the `.slot` wrapper).
  Deciding the same one again restarts its timer; the timers are cleared when the tab unmounts. Tests drive the
  wait with `page.clock`: wait for "On hold." (the note written) before running it, since the wait starts only then.
- On hold (RV-19): a folded "On hold · n" between the open cards and Resolved; `ends` comes from the Editor.
- "Use in script" (RV-12) is on open cards whose row still exists; the Editor copies the file (`onUse`).
- Where a card is: "row 3, Dialogue", or "row 3" for a comment on the whole row.
