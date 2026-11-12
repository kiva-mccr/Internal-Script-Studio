// Following a voice through the script (EX-8): the words someone just said, matched to the script's words, give
// the word they are at. Pure, so it can be tested without a microphone.

// A word as it is compared: lower case, letters and digits only ("Leaf," and "leaf" are the same word).
export function normal(word: string): string {
  return word.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
}

export function wordsOf(text: string): string[] {
  return text.split(/\s+/).map(normal).filter(Boolean);
}

const BACK = 15; // words before the marker a match may be found at (said again, or a misheard word)
const AHEAD = 80; // words after it (a skipped line)
const TAIL = 8; // the last words heard that are matched
const NEAR = 6; // words from the marker a place counts as near (EX-12)

// Where the speaker is: the index just after the last word heard, or `at` unchanged when nothing matches well
// enough. `script` and `heard` are normal words; `at` is the word the marker is on now.
export function follow(script: string[], heard: string[], at: number): number {
  const tail = heard.slice(-TAIL);
  if (!tail.length) return at;
  let best = { worth: -Infinity, end: at };
  const from = Math.max(0, Math.floor(at) - BACK);
  const to = Math.min(script.length, Math.floor(at) + AHEAD);
  for (let end = from + 1; end <= to; end++) {
    // Walk back from `end` and from the last word heard together; a word missing on either side is skipped once.
    let score = 0;
    let s = end - 1;
    for (let h = tail.length - 1; h >= 0 && s >= 0 && s >= end - TAIL - 2; h--) {
      if (script[s] === tail[h]) (score++, s--);
      else if (script[s - 1] === tail[h]) ((score += 0.5), (s -= 2));
    }
    // Three words must match (two when only two were heard); one word alone is too often a coincidence. A place
    // further than NEAR words away needs four: "carries the" or "the light. The root" fit many places in a script
    // full of "The …" sentences (found by the user), so a jump takes more of a sentence heard.
    if (score < (Math.abs(end - at) > NEAR ? 4 : Math.max(2, Math.min(3, tail.length)))) continue;
    // Each word away costs a little, so the nearer of two about equal matches wins and a repeat doesn't jump ahead.
    const worth = score - Math.abs(end - at) / 50;
    if (worth > best.worth) best = { worth, end };
  }
  return best.end;
}

// Between hearings (EX-12) the marker keeps going at the reading pace instead of waiting for the next one.
export const LEAD = 3; // words it may run past the last place heard, so a pause stops it soon

// A place heard, with when (in ms). Each hearing ends a word early or late, so the voice is read from the last few
// seconds of them together, not from the last one alone.
export type Mark = { at: number; time: number };
const SPAN = 4000; // ms of marks kept

// The marks of the last few seconds with this one added. A step back of more than LEAD words (a line read again) or a
// jump (a skipped line) starts afresh: the marks before it say nothing about where the voice is now.
export function addMark(marks: Mark[], mark: Mark): Mark[] {
  const last = marks[marks.length - 1];
  if (last && (mark.at < last.at - LEAD || mark.at > last.at + 2 * LEAD)) return [mark];
  return [...marks.filter((m) => mark.time - m.time <= SPAN), mark];
}

// Where the voice probably is at `now`, and how fast it goes (words a second): a straight line through the marks
// once they span 1.5 s, otherwise the last mark going on at `pace`. Never more than LEAD words past the last place
// heard, and then it has stopped (speed 0): a pause.
export function voiceAt(marks: Mark[], now: number, pace: number): { at: number; speed: number } {
  const last = marks[marks.length - 1];
  if (!last) return { at: 0, speed: 0 };
  let at = last.at + (pace * (now - last.time)) / 1000;
  let speed = pace;
  if ((last.time - marks[0].time) / 1000 >= 1.5) {
    const n = marks.length;
    const mt = marks.reduce((a, m) => a + m.time, 0) / n, ma = marks.reduce((a, m) => a + m.at, 0) / n;
    const slope = marks.reduce((a, m) => a + (m.time - mt) * (m.at - ma), 0) / marks.reduce((a, m) => a + (m.time - mt) ** 2, 0);
    speed = Math.min(6, Math.max(0, slope * 1000));
    at = ma + (speed * (now - mt)) / 1000;
  }
  if (at >= last.at + LEAD) return { at: last.at + LEAD, speed: 0 };
  return { at, speed };
}

// One frame of the marker's move (`seconds` long) toward `target`, which itself moves at `speed` words a second. It
// never snaps: it goes at the target's speed, a little faster when behind and slower when ahead, and only steps back
// for more than LEAD words (a line read again). A big gap (a skipped line) closes within about a second.
export function move(read: number, target: number, speed: number, seconds: number): number {
  const gap = target - read;
  if (gap < -LEAD || gap > 2 * LEAD) return read + gap * Math.min(1, seconds * 3);
  if (gap > -0.05 && gap < 0.05 && !speed) return Math.max(read, target); // arrived (it would only ever come close)
  return read + Math.max(0, speed + gap * 1.5) * seconds;
}
