# The script format (SF-1)

A script is a folder in the team's shared OneDrive folder. Inside it, `script.md` holds the words. It is plain
Markdown, so it can be read in any text editor, and the app shows it as three columns.

## The folder

```
Video Scripts/                       the shared folder each person picks once
  Episode 03 - How Photosynthesis Works/
    script.md                        the script
    plan.md                          the planning panel's notes (AP-24): plain Markdown, not part of the script
    assets/                          images and small files the script uses
    voice/                           voice-over takes, one per row: row-<id>.webm and row-<id>.json
    .studio/                         history, comments, "is editing": see studio-folder.md
```

The folder's name is the script's name in links and in the list. Big videos stay wherever the team keeps them; the
script links to them.

## script.md, top to bottom

```markdown
---
title: How Photosynthesis Works
status: draft
authors: [Kiva, Sam]
---

# Intro

## 1 <!-- id: k3f9a -->
Dialogue:
Every leaf you have ever seen is running a tiny factory.

On screen:
Slow push-in on a sunlit leaf.

Files:
- assets/leaf-closeup.jpg
```

### Front matter

The block between the `---` lines at the very top.

| Key | Meaning | Values |
|-----|---------|--------|
| `title` | Shown in the list and the editor | any text |
| `status` | Where the script is in review | `draft`, `in review`, `approved` |
| `authors` | Who has written in it | a list of names |
| `credits` | Who worked on it and what they did (AP-31) | one line of JSON: `[{"id": "…", "name": "Sam", "role": "Narrator"}]` |

All four are optional; a missing title falls back to the folder's name, a missing status means `draft`. Other keys
are kept as they are. A credit's `id` is that person's in the folder's people list (`.studio/people/`, see
[the .studio folder](studio-folder.md)), where their contact details are; the name is kept here too, so the script
reads on its own.

### Sections (optional)

A line starting with `# ` begins a section ("Intro", "Part 1"). Every row after it belongs to it until the next
section. Rows before the first section belong to none. A script with no sections is fine.

### Rows

A line starting with `## ` begins a row: one shot or beat, shown as one line of three columns.

- **The number** after `##` is for people reading the file. The app renumbers rows 1, 2, 3 … through the whole
  script (not per section) whenever it saves.
- **The id** in `<!-- id: … -->` is how comments and history stay attached to a row when rows move or the numbers
  change. It is five lower-case letters and digits, made up by the app, unique in the script and never reused. It
  is an HTML comment, so it is invisible wherever Markdown is shown. A row without one (typed by hand) gets one
  on the app's next save.

Each row has three fields, each starting with its label at the start of a line:

| Label | Column | Holds |
|-------|--------|-------|
| `Dialogue:` | Dialogue | what is said, word for word |
| `On screen:` | On screen | what the viewer sees |
| `Files:` | Images and files | the row's assets, one per line |
| `Timeline:` | (none: the storyboard timeline) | optional, one line; see below |

- A field's text may start on the label's line or on the lines below, and runs until the next label or heading.
  It may hold several paragraphs and ordinary Markdown. The app shows these marks as formatting (AP-11):
  `**bold**`, `*italic*`, `<u>underline</u>` (Markdown has none), `~~strikethrough~~`, `[words](https://…)` and
  `$equation$` (LaTeX, one line).
- A missing or empty field is an empty column. The app always writes all three, in this order, with a blank line
  between them.
- **Files** are a list (`- `), one per line:
  - a path inside the script's folder: `assets/leaf-closeup.jpg`
  - a link, with a name: `[Chloroplast animation](https://…)`
  - plain words for something not found yet: `Stock shot of a forest (to find)`
- A file added only for the storyboard timeline (SB-1) ends ` (timeline)`: `- assets/icon-water.png (timeline)`.
  Files shows it minimised ("+2 for the timeline"); everything else reads it without the mark.
- A line of text that itself starts with a label (a narrator saying "Dialogue: …") is written with a backslash in
  front, `\Dialogue:`, and shown without it.

### The storyboard timeline (SB-1, optional)

A row may end with one `Timeline:` line, after Files, holding only what differs from the default (a sequence of
every image and video in the row's Files, sharing the row's time equally, nothing after it). Its parts, separated
by commas:

| Part | Meaning |
|------|---------|
| `collage` | all the pictures at once, side by side, for the whole row (`sequence`, the default, is not written) |
| `without assets/old.png` | leave this picture out (one part per picture) |
| `cuts at "water" "carbon"` | the second picture starts on the word "water", the third on "carbon" (timed from the take) |
| `then hold 2 s` | after the row, the last picture stays on screen, in silence |
| `then placeholder 3 s "Drone shot"` | after the row, a placeholder of that length, with what goes there |

```markdown
Files:
- assets/icon-sun.png
- assets/icon-water.png (timeline)

Timeline: cuts at "water", then hold 2 s
```

A part the app doesn't understand is kept as typed. A dialogue line that starts with `Timeline:` is written
`\Timeline:`, like the other labels.

### Anything else

Text the format does not describe (a note above the first row, text before a row's first label) is kept exactly as
it is and shown as a note; the app never deletes what it does not understand.

### Text encoding

UTF-8, with LF line endings when the app writes. Files with CRLF (Windows Notepad) are read the same.

## Why this shape

- Plain text reads cleanly in Notepad or on GitHub, and a change to one row shows as a change to that row only.
- Columns that hold several paragraphs (long narration) would not fit a Markdown table, whose cells are one line.
- Fixed labels and ids make the file easy for the app to read back exactly, and safe to edit by hand.

A full example: [example/Episode 03 - How Photosynthesis Works/script.md](example/Episode%2003%20-%20How%20Photosynthesis%20Works/script.md).
