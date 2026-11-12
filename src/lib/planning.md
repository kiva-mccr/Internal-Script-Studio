# `src/lib/planning.ts`

The planning panel's file (AP-24): reads and writes `plan.md` beside script.md, and combines two saves made at once.

- **Used by:** `screens/Planning.svelte`. **Tests:** `tests/unit/planning.test.ts`, `tests/e2e/planning.spec.ts`.

## Rules and pitfalls

- A script with no plan.md reads as '' (only NotFoundError; any other error is thrown, so a busy OneDrive isn't
  taken for an empty plan and written over).
- `combinePlans` keeps yours and adds the lines they added; what they deleted stays. Nothing typed is lost.
