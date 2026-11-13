# `src/lib/changes.ts`

One person's change to a script, as a change file holds it (FX-2): `diff` works out what changed between two
texts (only the changed rows, each before and after; the front matter, intro and block order only when they
changed), and `fold` takes such a change into anyone's copy, even one with changes of its own.

- **Used by:** `lib/saving.svelte.ts`. **Tests:** `tests/unit/changes.test.ts`.

## Rules and pitfalls

- `fold` is `merge` (`lib/merge.ts`) with a made-up base and "theirs": the copy as it was before the change and
  after it, everything the change doesn't touch taken from the copy. So the rules are merge's: a field both changed
  is a clash, a row deleted there but changed here is kept, a row added here stays after the block before it.
- Folding a change that is already in does nothing (no clash): a change file read twice is harmless.
- Sections have no id: in `layout` a section is `s:` + its title and note, so renaming one is a layout change.
