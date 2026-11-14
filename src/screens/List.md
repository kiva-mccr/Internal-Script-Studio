# `src/screens/List.svelte`

The script list (mock-up 2): every script in the folder with its status, its length (AP-12, board 21), what waits for you (RV-14) and when it was last edited, newest
first; New script; Change folder; Files, to browse every script's files (`SharedFiles.svelte`, AS-1b).

- **Used by:** `App.svelte`. **Tests:** `tests/e2e/list.spec.ts`, `listcache.spec.ts`, `assets.spec.ts`, `shared.spec.ts`.

## Rules and pitfalls

- What the list shows comes from `lib/scriptlist.svelte.ts` (AP-40): remembered in this browser, then checked
  against each script's file names and dates, reading only scripts that changed, rows on screen first (an
  IntersectionObserver on each row). Coming back to the window checks again. `aria-busy` on the table is true while
  it checks (tests wait for it). Leaving the list stops the checking, so it doesn't slow the script being opened.
- An empty list says why: no scripts yet, or the picked folder is one script's folder (it holds a `script.md`).
- The "2 missing" beside a script (EX-6) is counted after the list shows, so a big folder isn't held up; a script
  that can't be read shows no count.
- "2 flagged" (AP-9) is counted with the missing files, from the comment notes; flags on deleted rows don't count.
- For me (RV-14, board 43): the labels ("Your review", "N replies", "Sent back to you") are worked out with the
  counts (`lib/forme.ts`), so they appear a moment after the list. History is read only for scripts not approved.
  The All · For me choice is `list-for-me` in localStorage.
- "Last edited by" is not shown yet: it comes from History's files (AP-6).
- The length is kept as the takes' seconds plus the words in rows with none (`length` in `lib/scriptlist.svelte.ts`),
  so it follows the speaking speed without reading the script again; it matches how Play times it. It shows a mic, "recorded", only once every row
  with dialogue or a take has a take. Two scripts with the same title can't be told apart by tests: give them others.
- People (AP-31) opens `People.svelte`, beside Files.
