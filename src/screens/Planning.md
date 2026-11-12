# `src/screens/Planning.svelte`

The planning panel (AP-24, mock-up 23): a "Planning" tab on the right edge of Write and Review opens a 380 px panel
beside the columns for learning goals, an outline and notes. One `TextField` with `lists` (bullets, numbers, tick
boxes). Kept in `plan.md` beside script.md (`lib/planning.ts`).

- **Used by:** `Editor.svelte`. **Tests:** `tests/e2e/planning.spec.ts`, `tests/unit/planning.test.ts`.

## Rules and pitfalls

- It saves itself, apart from the Editor: 1.5 s after typing, when the tab is hidden and on leaving; a failed save
  tries again every 6 s. No History versions: the plan is notes, not the script.
- Before writing, plan.md is read again; someone else's save meanwhile is combined (`combinePlans`), so their new
  lines are kept after yours. With nothing waiting, it looks every 5 s and shows their change quietly.
- The panel pushes the columns (a flex item, `position: sticky`), never covers them. Its height is set from where it
  starts (`fit`), so the bottom line shows below the top bar too. In Review at 1280 px the comments go under the
  script while it is open.
- Open or closed is this browser's (`planning-open` through `recall`/`keep`), like folded columns.
- Its footer is `aria-live`, not `role="status"`: tests find the script's save status by that role.
