# `src/screens/List.svelte`

The script list (mock-up 2): every script in the folder with its status and when it was last edited, newest
first; New script; Change folder.

- **Used by:** `App.svelte`. **Tests:** `tests/e2e/list.spec.ts`.

## Rules and pitfalls

- The list is read again whenever the window gets focus, so scripts OneDrive brought in appear.
- An empty list says why: no scripts yet, or the picked folder is one script's folder (it holds a `script.md`).
- "Last edited by" is not shown yet: it comes from History's files (AP-6).
