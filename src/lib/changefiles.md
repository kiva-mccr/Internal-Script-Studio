# `src/lib/changefiles.ts`

The files in a script's `.studio/changes/` (FX-2, docs/studio-folder.md): each person's saves (`writeChange`,
`listChanges`, `readChange`, `removeChange`) and the keeper's note of which of them script.md holds (`writeFolded`,
`readFolded`).

- **Used by:** `lib/saving.svelte.ts`. **Tests:** `tests/e2e/conflict.spec.ts`, `handoff.spec.ts`,
  `editor.spec.ts`; tests write others' change files with `changeFile` / `writeChange` (`tests/e2e/folder.ts`).

## Rules and pitfalls

- Names start with the time (`stamp`), so sorting them is oldest first; the person comes last (`_sam.json`).
- A change file that can't be read yet (half-written) is null and is tried again at the next check.
- Only the newest note counts; older notes are removed by the keeper that writes a new one.
