# `src/lib/readtime.svelte.ts`

Words and speaking time: `countWords` (a field's words, marks taken out), `clock` ("1:42"), `sectionWords` and
`scriptWords` (the dialogue's words by section and in all), and the speaking speed (`speaking.wpm`, `setSpeed`),
which read time (AP-12), the teleprompter (EX-2), Play (AU-2) and Copy for Teams share.

- **Used by:** `screens/Editor.svelte`, `Write.svelte`, `Review.svelte`, `List.svelte`, `Settings.svelte`,
  `Teleprompter.svelte`, `lib/share.ts`, `lib/play.svelte.ts`, `lib/voice.svelte.ts`. **Tests:** `tests/unit/readtime.test.ts`,
  `tests/e2e/readtime.spec.ts`.

## Rules and pitfalls

- Words are counted after `clearMarks`, so `**bold**` and a link's address don't add words.
- Read time counts the Dialogue only: On screen and Files aren't spoken.
- The speed is kept under the teleprompter's old key, `prompter-speed`, so a speed set before AP-12 is kept.
  It is state (`.svelte.ts`), so every time shown follows a change at once. 60 to 400; `setSpeed` ignores
  something that isn't a number (an emptied box), so the speed never jumps back to 150 by itself.
