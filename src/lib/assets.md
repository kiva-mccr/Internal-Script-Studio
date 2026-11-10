# `src/lib/assets.ts`

The asset list (EX-6, board 12): `assetRows` (each row with its section and its files, links and notes),
`assetList` (each asset once, with the rows that use it), `missingFiles` (the paths not in the script's folder) and
`countMissing` (for the script list).

- **Used by:** `screens/Assets.svelte`, `screens/Editor.svelte`, `screens/List.svelte`. **Tests:**
  `tests/unit/assets.test.ts`, `tests/e2e/assets.spec.ts`.

## Rules and pitfalls

- An asset is the same when its path or link is the same; a "to find" note when its words are, ignoring case.
- Only paths are checked: links aren't fetched (no server, and many sites refuse it).
- It imports `folder.ts`, so `folder.ts` must never import it (a cycle); the script list counts in `List.svelte`.
