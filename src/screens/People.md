# `src/screens/People.svelte`

People (AP-31, board 50), from the script list's People button: everyone in the folder with their usual role, how
many scripts credit them, their email (a mailto link) and LinkedIn. A name opens their contact details
(`Contact.svelte`) and the scripts that credit them, as links; someone no script credits can be removed.

- **Used by:** `screens/List.svelte`. **Tests:** `tests/e2e/credits.spec.ts`.

## Rules and pitfalls

- People are only added from a script's Credits (board 50); this window shows, edits and removes.
- Which scripts credit someone is read from every script.md (`creditedOn`); a script mid-sync is skipped.
- Closing or opening another name saves open contact details first.
