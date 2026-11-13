# `src/lib/files.ts`

Writing and reading in the shared folder so that two computers never clash (FX-2): `writeText` (retried quietly by
`patiently`, aborted on failure), `readJson` (null while a file is half-written), `jsonNames`, and `stamp`, a time
that sorts as text.

- **Used by:** `lib/folder.ts`, `lib/editing.ts`, `lib/changefiles.ts`. **Tests:** through the e2e tests
  (`tests/e2e/editor.spec.ts` fails writes on purpose).

## Rules and pitfalls

- Only new files, apart from script.md, which only the keeper writes: a Windows network drive refuses to replace a
  file another computer has open, and OneDrive can hold one while it syncs (FX-1).
- `patiently` never retries a lost OK (`NotAllowedError`, `SecurityError`): only a click can bring it back.
- A write that fails is aborted, or Chrome's unfinished `.crswap` file stays behind.
