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
    editing/    one file per person who has the script open
```

## The one rule: new files, never edits

Every file in `.studio/` is written once and never changed afterwards (the `editing/` files are the only
exception, and each belongs to one person). OneDrive syncs in seconds to minutes, so two people writing the
same file is how work gets lost; two people writing different new files never clash.

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
- `sha256` is the text's fingerprint, used to tell whether `script.md` still matches.
- `kind` and what History shows for it:

| kind | Made when | History shows |
|------|-----------|---------------|
| `edit` | editing (see below) | "Edited rows 3 and 4" (worked out from the text) |
| `review` | sent for review, approved, or sent back | "Sent for review" |
| `restore` | an earlier version restored | "Restored the version from Nov 6" |
| `merge` | a conflict resolved | "Combined Sam's and Ana's changes" |
| `outside` | `script.md` changed outside the app | "Changed outside the app" |
| `restart` | `.studio/` was missing or empty | "History starts here" (also for scripts made before History existed) |
| `official` | someone publishes an official version, `note` its name | "v2 · Sent to the narrator" (numbered by publish order) |

Official versions are numbered from the order they were published, so the number is never stored. Once a script
has one, History shows the official versions and folds the small saves between them into one line ("6 changes
since v2") until opened.

### When an entry is made

- `script.md` itself is saved a couple of seconds after each pause in typing.
- A history entry is made at most every **5 minutes** of one person's editing (only if the text changed), and
  also when they leave the script, send it for review, restore, or resolve a conflict.

### Changes made outside the app

When a script opens, its `script.md` fingerprint is compared with the newest version:

1. It matches: nothing to do.
2. It matches the `last_written` fingerprint in someone's `editing/` file: that person's last edits never got their
   entry (a closed laptop). An `edit` entry is made in their name.
3. Otherwise: an `outside` entry is made, `who` "Outside the app", and History shows what changed.

No versions at all, but a `script.md`: a `restart` entry is made. OneDrive's own version history (right-click the
file in OneDrive) is the backup for anything before it.

## Conflicts

Two people saving at the same time show up two ways, and both lead to the same screen:

- **Two newest versions:** two versions share a parent and neither has a child. (`script.md` itself holds only
  whichever synced last; both versions are safe in `versions/`.)
- **OneDrive's conflict copies:** OneDrive sometimes keeps both by adding a file such as
  `script-LAPTOP-SAM.md` beside `script.md`. The app spots any `script-*.md` there.

The app then says "Sam and Ana both saved at the same time" and shows the two side by side, row by row, matched by
row id. Rows only one of them changed are taken without asking; for each row both changed, you pick one. The result
is a `merge` version with both as `parents`, and is written to `script.md`. A conflict copy is deleted only after
its merge is saved.

While someone is editing, the app checks `script.md` every few seconds. Changed by someone else and no edits of
their own waiting: it reloads quietly. Edits of their own waiting: the conflict screen.

## editing/: "Sam is editing"

`editing/sam.json` (the file is named after the person):

```json
{ "v": 1, "who": "Sam", "since": "2026-11-09T14:30:00Z", "seen": "2026-11-09T14:41:30Z", "last_written": "…" }
```

- Rewritten every **30 seconds** while the script is open (`seen`), and with each save (`last_written`, the
  fingerprint of what was written).
- Anyone else opening the script sees "Sam is editing" while `seen` is under **2 minutes** old. Older than that, it
  is ignored (Sam closed the laptop), but kept until its `last_written` has been checked (see above).
- Deleted when Sam leaves the script.

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
- What happens to it later is a new file, never an edit: `resolve`, `reopen`, `accept` or `reject`, each with
  `"about": "<id>"`, `who` and `when`. The newest one counts.
- `row` and `field` say where it belongs (`dialogue`, `on_screen` or `files`); the row id keeps it attached when
  rows move. If its quote is no longer in the row, it shows as "on text that has since changed".

Flags on rows (AP-9) are kept here too: `flag` (with `row`, and the note in `text`, which may be empty) and
`unflag` (with `row`). The newest of the two about a row says whether it is flagged; a changed note is a new
`flag`. A flag on a row no longer in the script is not shown (Undo of the delete brings it back).

RV-1 to RV-3 build on this and may add fields; they never change what these mean.
