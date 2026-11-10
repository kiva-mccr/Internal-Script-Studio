# `src/screens/List.svelte`

The script list (mock-up 2): every script in the folder with its status and when it was last edited, newest
first; New script; Change folder.

- **Used by:** `App.svelte`. **Tests:** `tests/e2e/list.spec.ts`, `assets.spec.ts`.

## Rules and pitfalls

- The list is read again whenever the window gets focus, so scripts OneDrive brought in appear.
- An empty list says why: no scripts yet, or the picked folder is one script's folder (it holds a `script.md`).
- The "2 missing" beside a script (EX-6) is counted after the list shows, one script at a time, so a big folder
  isn't held up; a script that can't be read shows no count.
- "Last edited by" is not shown yet: it comes from History's files (AP-6).
