# `src/lib/people.ts`

Credits and contacts (AP-31, board 50): the folder's people (`.studio/people/` at the top of the picked folder, one
file per change, the newest counts) and a script's credits (a `credits:` line of JSON in its front matter).

- **Used by:** `screens/Credits.svelte`, `screens/People.svelte`, `screens/Contact.svelte`, `lib/merge.ts`,
  `lib/share.ts`, `screens/Export.svelte`, `screens/Editor.svelte` (Print). **Tests:** `tests/unit/people.test.ts`,
  `tests/e2e/credits.spec.ts`.

## Rules and pitfalls

- Files are written once, never edited (OneDrive sync): a change or a removal is a new file. Names carry a random
  part after the person's id, so two changes in the same second never share a name. The newest is found by `when`
  (milliseconds), never by file name: two changes in one second sorted by their random part (failed on CI: a new
  person's usual role, saved just after their contact details, lost to them).
- A credit keeps the person's name as well as their id, so the script and its exports read without the folder's list.
  There is no renaming yet, so the two can't drift.
- The front matter line is JSON on one line (frontValue reads one line); a line that can't be read gives no credits.
  No credits takes the line out.
- Two saves at once never clash over credits (`mergeCredits`): the side that changed wins; both changed, theirs with
  yours on top.
- Exports show names and blurbs only, never contact details (they may leave the team).
- `.studio/` at the top starts with a dot, so `listScripts` never takes it for a script.
