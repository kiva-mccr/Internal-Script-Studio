# The .studio folder (SF-2)

Each script folder (see [the script format](script-format.md)) has a hidden `.studio/` folder: the script's
history, its comments, and who has it open. The app writes it; people never need to open it.

```
Episode 03 - How Photosynthesis Works/
  script.md
  assets/
  .studio/
    versions/   one file per history entry
    comments/   one file per comment, reply, or change to one
    changes/    each person's saves: one file per save, only what changed (FX-2)
    editing/    a file for each person who has the script open, a new one every 30 s
    files/      files attached to comments, one folder per comment or reply
```

The picked folder itself has a `.studio/` too, for what every script shares (AP-31):

```
Video Scripts/
  .studio/
    people/     one file per person added, or change to one: name, usual role, email, LinkedIn
```

`people/20261113T101500Z_ab12cd34_x9y8z7w6.json` (time, the person's id, then a random id so two changes never share a name):

```json
{ "v": 1, "id": "ab12cd34", "name": "Priya", "role": "Science reviewer", "email": "priya@example.org",
  "linkedin": "linkedin.com/in/priya", "who": "Sam", "when": "2026-11-13T10:15:00.000Z" }
```

The newest file about a person counts. `"removed": true` takes them out of the list (only offered once no script
credits them). A script's credits (who, and a blurb on what they did) are in its own `script.md`.

## The one rule: new files, never edits

Every file in `.studio/` is written once and never changed afterwards. Two people writing the same file is how
work gets lost: OneDrive syncs in seconds to minutes, and a Windows network drive refuses to replace a file another
computer has open. Two people writing different new files never clash. Even typing is saved this way (`changes/`,
below); `script.md` is written by one computer only, the keeper.

## changes/: saving (FX-2)

Typing is saved within **30 seconds** (or at once with Ctrl+S, on leaving, or when the tab is hidden) as a new file,
`changes/20261113T204500123Z_k2m9qa_sam.json` (time, a random id, the person):

```json
{ "v": 1, "id": "k2m9qa", "who": "Sam", "when": "2026-11-13T20:45:00.123Z",
  "delta": { "rows": { "k3f9a": [ { "dialogue": "…", "onScreen": "Before.", "files": [], "note": "" },
                                  { "dialogue": "…", "onScreen": "After.", "files": [], "note": "" } ] } } }
```

Only what changed: each changed row before and after (`null` before: added; `null` after: deleted), and the front
matter, intro or the order of blocks (`layout`, rows as `r:<id>`, sections as `s:<title>`) only when they changed.
Until it is saved, typing is also kept in the browser, so a page closed first keeps it for next time.

- **Everyone else** looks for new change files every 5 seconds and folds them in row by row, keeping their own
  unsaved typing. A field both changed shows the side-by-side pick (see Conflicts). A spinner shows beside
  "Sam is editing" meanwhile.
- **The keeper** is whoever opened the script first among those editing it now (`since` in their `editing/` file);
  when they leave, the next takes over. Only the keeper writes `script.md`: after each save or fold, it writes it,
  then `changes/folded_<time>.json`, a note of the change files it holds and its fingerprint. It makes the History
  entries every 5 minutes, and removes change files that are in `script.md` and over 2 minutes old.
- **Opening** a script reads `script.md`, then folds in every change file the newest note doesn't list. If the keeper
  closed between writing `script.md` and its note, a change from over a minute before `script.md` was written is
  taken to be in it already: folding it again changes nothing, and where a later change changed the same place,
  `script.md` is kept without asking.
- Before writing, the keeper reads `script.md`: changed outside the app (Notepad) since it last wrote it, and not
  matching the note, the outside change is folded in first and gets an `outside` History entry.

File names start with the time, so sorting by name sorts by time. Times are UTC, `20261109T144100Z` in names and
`2026-11-09T14:41:00Z` inside files. Ids are eight random lower-case letters and digits. All files are UTF-8 JSON
with `"v": 1`, so the format can change later.

## Who you are

Each person types their name once on each computer. The browser keeps it; it is never stored in the folder
except as the `who` of what they write.

## versions/: History

`versions/20261109T144100Z_ab12cd34.json`:

```json
{
  "v": 1,
  "id": "ab12cd34",
  "parents": ["x9y8z7w6"],
  "who": "Sam",
  "when": "2026-11-09T14:41:00Z",
  "kind": "edit",
  "note": "",
  "sha256": "…",
  "text": "---\ntitle: How Photosynthesis Works\n…"
}
```

- `text` is the whole `script.md` as it was: a full copy, not a list of changes. Simple, and any one file is
  enough to restore from. A 10-minute script is about 10 KB, so 1,000 versions are about 10 MB.
- `parents` is the version (or versions) it was made from: empty for the first, two for a merge.
- `message` is only there on a send for review with a note for the reviewers (RV-8), or a send back with a note for
  the writer (RV-13): what they should look at.
- `sha256` is the text's fingerprint, used to tell whether `script.md` still matches.
- `kind` and what History shows for it:

| kind | Made when | History shows |
|------|-----------|---------------|
| `edit` | editing (see below) | "Edited rows 3 and 4" (worked out from the text) |
| `review` | sent for review, approved, or sent back | "Sent for review" or "Sent back to writer" (and its note, `message`) |
| `restore` | an earlier version restored | "Restored the version from Nov 6" |
| `merge` | a conflict resolved | "Combined Sam's and Ana's changes" |
| `outside` | `script.md` changed outside the app | "Changed outside the app" |
| `restart` | `.studio/` was missing or empty | "History starts here" (also for scripts made before History existed) |
| `official` | someone publishes an official version, `note` its name | "v2 · Sent to the narrator" (numbered by publish order) |

A send for review is also the next official version (RV-9): its `review` entry then has `official: true` and counts
in the numbering ("v3 · Sent for review"). It has none when the script is the same as the newest official version,
leaving out the `status` and `authors` lines, so a version is never made twice.

Official versions are numbered from the order they were published, so the number is never stored. Once a script
has one, History shows the official versions and folds the small saves between them into one line ("6 changes
since v2") until opened.

### When an entry is made

- Typing is saved as change files (above), and `script.md` by the keeper.
- A history entry is made by the keeper at most every **5 minutes** (only if the text changed), credited to whoever's
  changes it holds ("Ana and Sam"), and also when anyone leaves the script, sends it for review, or restores. Each
  entry's parent is the newest entry, so two people's entries follow one another.

### Changes made outside the app

When a script opens, its `script.md` fingerprint is compared with the newest version:

1. It matches, or it matches the keeper's note in `changes/`: nothing to do (the keeper's next entry has it).
2. It matches the `last_written` fingerprint in someone's `editing/` file: that person's last edits never got their
   entry (a closed laptop). An `edit` entry is made in their name.
3. Otherwise, if one other person is editing it right now, it is theirs (their `editing/` file can lag behind).
4. Otherwise: an `outside` entry is made, `who` "Outside the app", and History shows what changed.

No versions at all, but a `script.md`: a `restart` entry is made. OneDrive's own version history (right-click the
file in OneDrive) is the backup for anything before it.

## Conflicts

Someone's change file that changes a field you changed too, before either of you saw the other's, shows "Ana and
you both changed the same place": the two side by side, matched by row id. Rows only one of you changed are taken
without asking; for each field both changed, you pick one, and the result is saved as your change.

OneDrive's conflict copies (`script-LAPTOP-SAM.md` beside `script.md`) are combined the same way on opening; a copy
is deleted only after the combination is saved. Two newest History entries are no longer combined: `script.md` and
the change files are what counts, and History is a record of them.

## editing/: "Sam is editing"

`editing/sam_20261113T204500123Z.json` (the person, then the time), a new file every **30 seconds** while the script
is open, the person's older ones removed:

```json
{ "v": 1, "who": "Sam", "since": "2026-11-09T14:30:00Z", "seen": "2026-11-09T14:41:30Z", "last_written": "…" }
```

- The newest file per person counts. `since` picks the keeper; `last_written` is the fingerprint of the `script.md`
  they last wrote.
- Anyone else opening the script sees "Sam is editing" while `seen` is under **2 minutes** old. Older than that, it
  is ignored (Sam closed the laptop), but kept until its `last_written` has been checked (see above).
- When Sam leaves the script, Sam's app writes one last file with `"left": "<time>"` and removes Sam's older ones
  (AP-37): never more than one file per person, and still written once. A `left` file never counts as editing.
  It shows the others "Sam was here 12 min ago". A file not `left` and over 2 minutes old means Sam went quiet
  without leaving (the laptop slept, or lost the drive): "Sam last seen 3 min ago", for 2 hours.
- Anyone's file over 30 days old is removed by whoever has the script open. `sam.json` files from before FX-2 are
  read too, and removed by their owner.

It is a warning, not a lock: anyone can still edit, and conflicts are caught as above.

## comments/: Review

`comments/20261109T143000Z_c4d5e6f7.json`:

```json
{
  "v": 1,
  "id": "c4d5e6f7",
  "kind": "comment",
  "who": "Ana",
  "when": "2026-11-09T14:30:00Z",
  "row": "k3f9a",
  "field": "on_screen",
  "quote": "Slow push-in on a sunlit leaf.",
  "text": "Could we shoot a real leaf for this instead of stock footage?"
}
```

- `when` here keeps milliseconds (`2026-11-09T14:30:00.123Z`), so a resolve and a reopen in the same second
  still come in order; file names keep seconds.
- `kind` is `comment`, `reply` (with `"about": "<id>"`), or `suggestion` (with `"replace": "…"`, the new text for
  `quote`).
- What happens to it later is a new file, never an edit: `resolve`, `reopen`, `accept`, `reject` or `hold`, each
  with `"about": "<id>"`, `who` and `when`. The newest one counts.
- `hold` (RV-19) puts it on hold; a `reopen` takes it off. A hold lasts only until the next send for review or
  official version in `versions/` after it: from then on the comment counts as open again, with nothing written.
- Its author can change it the same way (RV-7): `edit` (with the new `text`, or `replace` for a suggestion),
  `delete` or `undelete`, about a comment, suggestion or reply. The newest counts, and one by anyone other than
  the author is ignored. A deleted comment's replies are hidden with it.
- A comment or reply can carry files (RV-11): `"files": [{ "name": "leaf.jpg", "path":
  ".studio/files/c4d5e6f7/leaf.jpg", "size": 2400000 }]`. The files are copied first into `.studio/files/<its id>/`,
  written once and never deleted (not even when it is resolved or deleted). An `edit` with `files` replaces the
  list: the ones it keeps keep their paths, and new ones go in `.studio/files/<the edit's id>/`. Up to 50 MB each.
- `row` and `field` say where it belongs (`dialogue`, `on_screen` or `files`); the row id keeps it attached when
  rows move. If its quote is no longer in the row, it shows as "on text that has since changed".

Flags on rows (AP-9) are kept here too: `flag` (with `row`, and the note in `text`, which may be empty) and
`unflag` (with `row`). The newest of the two about a row says whether it is flagged; a changed note is a new
`flag`. A flag on a row no longer in the script is not shown (Undo of the delete brings it back).

RV-1 to RV-3 build on this and may add fields; they never change what these mean.
