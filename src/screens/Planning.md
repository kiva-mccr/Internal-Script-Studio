# `src/screens/Planning.svelte`

The planning panel (AP-24, mock-up 23): a "Planning" tab on the right edge of Write and Review opens a 380 px panel
beside the columns for learning goals, an outline and notes. One `TextField` with `lists` (bullets, numbers, tick
boxes). Kept in `plan.md` beside script.md (`lib/planning.ts`).

In Write the same panel has a second tab, Comments (RV-13, board 37): the edge shows "Planning" and "Comments · 3"
when closed, and a Planning · Comments switch when open. Review keeps only Planning (its comments are beside the
script already).

- **Used by:** `Editor.svelte`. **Tests:** `tests/e2e/planning.spec.ts`, `comments.spec.ts`, `tests/unit/planning.test.ts`.

## Rules and pitfalls

- It saves itself, apart from the Editor: 1.5 s after typing, when the tab is hidden and on leaving; a failed save
  tries again every 6 s. No History versions: the plan is notes, not the script.
- Before writing, plan.md is read again; someone else's save meanwhile is combined (`combinePlans`), so their new
  lines are kept after yours. With nothing waiting, it looks every 5 s and shows their change quietly.
- The panel pushes the columns (a flex item, `position: sticky`), never covers them. Its height is set from where it
  starts (`fit`), so the bottom line shows below the top bar too. In Review at 1280 px the comments go under the
  script while it is open.
- Open or closed and the tab are this browser's (`planning-open`, `side-tab`), like folded columns. Both are bound to
  the Editor (`sideOpen`, `sideTab`), which opens it on Comments from a bubble or after a send back. The panel stays
  mounted when closed, so a plan being saved isn't lost by closing it or switching tab.
- Its name (`aria-label`) and Close are the tab's: "Planning" / "Close planning", "Comments" / "Close comments".
- The tall text box (`min-height: 50vh`) is only for the plan (`.plan`), not the Comments tab's boxes.
- Its footer is `aria-live`, not `role="status"`: tests find the script's save status by that role.
