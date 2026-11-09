# `src/screens/Conflict.svelte`

Two saves made at the same time (mock-up 6): each field both changed, side by side; the person picks one per field,
then saves the combined version.

- **Used by:** `Editor.svelte`. **Tests:** `tests/e2e/conflict.spec.ts`.

## Rules and pitfalls

- The save button stays disabled until every clash has a pick (no browser dialog to ask).
- Each clash is a `region` named after where it is ("Row 1 · On screen"); each side is a button with `aria-pressed`.
- Fields only one person changed are already in the combined text; they are only listed under "Also combined".
