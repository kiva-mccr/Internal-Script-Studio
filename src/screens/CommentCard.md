# `src/screens/CommentCard.svelte`

One comment or suggestion with its replies, as a card: reply, resolve and reopen, accept or reject with Undo, and edit
or delete your own (RV-7), with files (RV-11). Taken out of Review for Write's Comments tab (RV-13), so both show
the same card.

- **Used by:** `Review.svelte`, `Comments.svelte`. **Tests:** `tests/e2e/review.spec.ts`, `attach.spec.ts`, `comments.spec.ts`.

## Rules and pitfalls

- It writes nothing itself: every change is a note through `onAdd`; an accept or Undo changes Write's text through
  `onApply` first (false: the words changed, nothing written).
- The lists are the parent's: `onDecided` keeps a decided one in place with Undo (`recent`), `onGone` keeps a
  deleted one as "… deleted. Undo". With `undoResolve` (Write) Resolve does the same; Review moves it to Resolved.
- Carries `data-id` (the comment's id): Approve's list (RV-5) and the Comments tab find a card by it.
- Reply and edit boxes are each card's own, so two cards can have a box open at once.
- Edit and Delete show only on `me`'s own while open. While its own edit box is open its other actions are hidden.
- `use` (Write only, RV-12) passes "Use in script" to its files and its replies' files, naming who it came from.
- A click anywhere on it calls `onActivate` (marks it, and in Write goes to its row), buttons included.
- `active` is a solid blue outline, ring and tint (RV-20): a pale border alone was too hard to see.
