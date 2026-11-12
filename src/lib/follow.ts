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

// Where the speaker is: the index just after the last word heard, or `at` unchanged when nothing matches well
// enough. `script` and `heard` are normal words; `at` is the word the marker is on now.
export function follow(script: string[], heard: string[], at: number): number {
  const tail = heard.slice(-TAIL);
  if (!tail.length) return at;
  let best = { score: 0, end: at };
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
    // The nearest of two equal matches wins, so a repeated phrase doesn't jump ahead.
    if (score > best.score || (score === best.score && Math.abs(end - at) < Math.abs(best.end - at))) best = { score, end };
  }
  // Three words must match (two when only two were heard); one word alone is too often a coincidence.
  return best.score >= Math.max(2, Math.min(3, tail.length)) ? best.end : at;
}

// Between hearings (EX-12) the marker keeps going at the reading pace instead of waiting for the next one.
export const LEAD = 4; // words it may run past the word last heard, so a pause stops it soon

// Where the marker heads `seconds` after the voice was heard at `heardAt`, at `pace` words a second.
export function aim(heardAt: number, seconds: number, pace: number, total: number): number {
  return Math.min(total, heardAt + Math.max(0, Math.min(LEAD, pace * seconds)));
}

// The reading pace in words a second, nudged by the voice moving on `words` words in `seconds`. A move after a long
// pause, or backwards, says nothing about the pace.
export function paceFrom(pace: number, words: number, seconds: number): number {
  if (words <= 0 || seconds <= 0 || seconds > 3) return pace;
  return pace * 0.7 + Math.min(6, Math.max(0.5, words / seconds)) * 0.3;
}
