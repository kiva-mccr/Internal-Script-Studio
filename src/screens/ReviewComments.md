# `src/screens/ReviewComments.svelte`

Review's comments beside the script (mock-up 4), split out of `Review.svelte` (AP-42): the new comment box (Comment
or Suggest a change, files through `AttachBox.svelte`), "Open · n" with the sort switch, then "On hold · n" and
"Resolved · n". The cards are `CommentCard.svelte`, shared with Write's Comments tab.

- **Used by:** `Review.svelte` (opens the box with `start`, binds `active`). **Tests:** `tests/e2e/review.spec.ts`,
  `hold.spec.ts`, `comments.spec.ts`.

## Rules and pitfalls

- Each card carries `data-id` (the comment's id): the list before Approve (RV-5) finds it by that.
- A suggestion decided here stays in the open list with Undo until the screen is left (`recent`).
- On hold (RV-19): Put on hold keeps the card with Undo for 5 seconds (`holding`, a `Linger`), then it slides into
  "On hold · n" between the open cards and Resolved. "Open · n" leaves held ones out. Every card is in a `.slot`
  wrapper carrying `out:slideAway`.
- No browser dialogs: an empty comment shows "Write a comment first." in the form.
- Edit and Delete show only when `who` is `me` (the name in Settings) and the thread is open. A deleted one stays
  in place as "… deleted. Undo" while its id is in `gone`, which empties when Review is left. While a card's own
  edit box is open its other actions are hidden (the aside is narrow; they wrapped).
- Files on comments (RV-11): the comment, reply and edit boxes are wrapped in `AttachBox.svelte`; a suggestion
  (and its edit box) has none, and switching to Suggest a change drops any picked files. A comment or reply may be
  only files. Cards show them with `Attached.svelte`. Snippets in the boxes are named `typing`.
- Sorted (RV-16): `lib/commentsort.ts`; the switch (`SortSwitch.svelte`) is beside "Open · n", sharing Write's
  remembered choice. By Type, an `h3.kind` heading starts each kind in the open list.
