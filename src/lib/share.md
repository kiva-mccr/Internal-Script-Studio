# `src/lib/share.ts`

Copy for Teams (EX-10): turns the script and a few facts into a short message, as HTML (Teams keeps the bold and the
links when it is pasted) and as plain text (Notepad, a text message): the title (a link), the status, the version
(only when official), rows, read-aloud time, who edited last and when, open comments, voice-over progress, and an
"Open in Script Studio" link.

- **Used by:** `screens/Editor.svelte` (the facts), `screens/Header.svelte` (puts it on the clipboard).
  **Tests:** `tests/unit/share.test.ts`, `tests/e2e/editor.spec.ts`.

## Rules and pitfalls

- A snapshot: it does not update after pasting. A live preview card would need a server that can read the script.
- Comments, voice-over and "Last edited" are left out when there are none (or nobody is known).
- Read-aloud time is the Dialogue's words at `SPEED` (150 a minute), the speed read time (AP-12) starts from.
- Everything put in the HTML is escaped: titles and names are typed by people.
