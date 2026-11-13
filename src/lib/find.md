# `src/lib/find.ts`

Find and replace in a script (AP-32, board 44): every match in reading order (`findAll`), one or all replaced
(`replaceOne`, `replaceAll`), the replacement's capitals (`fitCase`), and a DOM range for a match in the formatted
text (`rangeAt`), for the marks.

- **Used by:** `screens/Find.svelte`. **Tests:** `tests/unit/find.test.ts`, `tests/e2e/find.spec.ts`.

## Rules and pitfalls

- It matches the text as it reads: `visible` takes the marks out with the same patterns, in the same order, as
  `toHtml` in `format.ts`, and keeps where each letter sits in the raw text. Change one and change the other, or the
  marks land on the wrong letters.
- Equations are left out of `visible` and skipped by `rangeAt` (`.math`): KaTeX draws them as other text.
- Files lines: only plain words and a named link's name (`[name](url)`) are searched. File names and addresses never
  are, so a replace can't break a file.
- A match across marks ("photo**synthesis**") is replaced with the marks kept in front of or after the new words,
  whichever leaves the rest of the field reading the same.
- `fitCase` adds capitals (all, or the first) but never takes one away, so a name typed with a capital keeps it.
- `replaceAll` goes last to first, so the places of the matches before stay right.
