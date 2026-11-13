# `src/screens/List.svelte`

The script list (mock-up 2): every script in the folder with its status, its length (AP-12, board 21), what waits for you (RV-14) and when it was last edited, newest
first; New script; Change folder; Files, to browse every script's files (`SharedFiles.svelte`, AS-1b).

- **Used by:** `App.svelte`. **Tests:** `tests/e2e/list.spec.ts`, `assets.spec.ts`, `shared.spec.ts`.

## Rules and pitfalls

- The list is read again whenever the window gets focus, so scripts OneDrive brought in appear.
- An empty list says why: no scripts yet, or the picked folder is one script's folder (it holds a `script.md`).
- The "2 missing" beside a script (EX-6) is counted after the list shows, one script at a time, so a big folder
  isn't held up; a script that can't be read shows no count.
- "2 flagged" (AP-9) is counted with the missing files, from the comment notes; flags on deleted rows don't count.
- For me (RV-14, board 43): the labels ("Your review", "N replies", "Sent back to you") are worked out with the
  counts (`lib/forme.ts`), so they appear a moment after the list. History is read only for scripts not approved.
  The All · For me choice is `list-for-me` in localStorage.
- "Last edited by" is not shown yet: it comes from History's files (AP-6).
- The length is read with the missing count (the script and its takes, `read`), and worked out as Play times it:
  takes, plus read time for rows with none, at the speaking speed. It shows a mic, "recorded", only once every row
  with dialogue or a take has a take. Two scripts with the same title can't be told apart by tests: give them others.
- People (AP-31) opens `People.svelte`, beside Files.
