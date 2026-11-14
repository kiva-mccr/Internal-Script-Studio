# `src/lib/scriptlist.svelte.ts`

The script list's facts (AP-40): each script's title, status, last edit and counts (length, missing, flagged, For
me), kept in this browser's localStorage (`script-list:<folder name>`) with a fingerprint of the script's files.
`ScriptList.refresh` lists the folder, reads the title and status of scripts the browser hasn't seen (all of them,
so the list shows whole), then checks each script's fingerprint and reads only the scripts that changed, those on
screen first, four at a time.

- **Used by:** `screens/List.svelte`. **Tests:** `tests/unit/scriptlist.test.ts`, `tests/e2e/listcache.spec.ts`,
  and the list's other e2e tests.

## Rules and pitfalls

- The fingerprint opens no file: script.md's size and date, the names in `.studio/versions/` and `.studio/comments/`
  (written once, never changed), the takes' sizes and dates (`voice/` files are rewritten), the names in the folders
  the Files column points into (for the missing count), and your name (For me depends on it).
- The fingerprint is taken before the script is read, so a change during the read is caught next time, never lost.
- A file being written shows as `name.crswap` for a moment: the fingerprint changes twice and the script is read
  twice. Harmless.
- Anything that can't be read keeps what was shown and is read next time (mid-sync).
- A first visit on a computer still reads every script once; the shared summary file per script was set aside by the
  user (expand later if first visits are slow on the network drive).
- Changes waiting in `.studio/changes/` (FX-2) aren't counted until the keeper writes script.md, as before.
