# `src/lib/readtime.ts`

Words and speaking time: `countWords` (a field's words, marks taken out) and `clock` ("1:42"). The teleprompter
(EX-2) scrolls at a speed in words a minute (`SPEED` to start); read time (AP-12) will use the same.

- **Used by:** `screens/Teleprompter.svelte`. **Tests:** `tests/unit/readtime.test.ts`.

## Rules and pitfalls

- Words are counted after `clearMarks`, so `**bold**` and a link's address don't add words.
