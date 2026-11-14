# `src/screens/Timeline.svelte`

The storyboard timeline (SB-1, board 63), under the last row in Write: a ruler, the sections, the rows with their
pictures (sequence or collage, or the On screen words on a grey card), holds and placeholders, and the voice-over as
a waveform (a dashed "no take" bar for read time). A click picks a block: its row lights up and the panel below
offers its pictures, Sequence or Collage, + Add a picture (only for the timeline), + Hold or + Placeholder, and
▶ Play from here; a hold or placeholder gets its seconds and words, and ✕ Remove.

- **Used by:** `screens/Write.svelte`. **Tests:** `tests/e2e/timeline.spec.ts`.

## Rules and pitfalls

- Mostly a view: every choice goes into the row's `Timeline:` line through `onTimeline` (or its Files through
  `onFiles`), so it saves, merges and shows in History like any edit. Never keep timeline state anywhere else.
- Lengths come from `layout` (`lib/timeline.ts`) with the same rule as Play the script: the take's length, else
  the read time at the speaking speed. A row with neither is left off.
- Blocks are placed with `left`/`width` in % of the whole length, inside a box zoomed by its width; the box scrolls
  sideways, the page doesn't.
- Pictures are blob URLs from the script's folder, made while the timeline is shown and revoked after; a missing
  file is a grey stand-in. Waveforms come from `lib/waveform.ts`, made once per take.
- Playing: the section is `position: sticky; bottom: 0` while `player.started` (pinned to the bottom of the screen),
  the panel is hidden, a playhead runs at `player.time`, and the preview (16:9, 320 px, ⤢ to 720 px) sits above the
  right end showing the picture of the moment: the sequence's shot at `player.elapsed`, a collage's all, a hold the
  last picture before it, a placeholder its words. Step ids are block ids (`plan` is made from `layout`).
- Cut on a word: the dialogue's words as buttons; a click toggles a cut there (at most one fewer than the
  pictures). Saved as the words (`cuts at "water"`), matched again in order, so picking the second of two equal
  words lands on the first: a known limit.
- Hide is this browser's choice (`timeline-hidden`), for every script.
- `selected` is shared with Write's bars (`TimelineBar.svelte`): picking a hold on the timeline opens its bar's
  editor in the script too.
