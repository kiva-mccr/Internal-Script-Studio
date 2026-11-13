# `src/screens/Credits.svelte`

The Credits window (AP-31, board 50), opened from ⋯ in a script: who worked on it, each with a blurb on what they
did on this script; + Add a person picks from the folder's people (the script's writers first; Find matches a name or
a usual role) or adds someone new; Contact details opens `Contact.svelte`.

- **Used by:** `screens/Editor.svelte` (mounted at its top level, like Print). **Tests:** `tests/e2e/credits.spec.ts`.

## Rules and pitfalls

- The credits live in the script's front matter: a change sets `script.front` and calls `onChange`, so it saves,
  merges and gets History like any edit.
- A blurb typed for someone with no usual role becomes it on leaving the box (a new people file); failing that is
  quiet, since the blurb itself is saved with the script.
- Someone new with a name already in the folder (case-blind) is that person, not a second one.
- Closing (Done, ×, Esc, a click outside) saves open contact details first; if that fails the window stays open
  with the message.
- Two Done buttons can show (the contact details' and the window's): tests pick them inside `.contact` or `.foot`.
