// Voice-over out of the app (asked by the user, for their work): every row's take in row order, joined in one WAV
// file (the user's choice over a file per row). WAV because video editors don't take the browser's webm recordings.
import type { Script } from './script';

export type Clip = { row: number; samples: Float32Array };

// The takes of the rows that have one, in row order, decoded to mono at `rate`. Tests can pass their own decoder.
export async function readClips(dir: FileSystemDirectoryHandle, script: Script, rate: number, decode = decoder(rate)): Promise<Clip[]> {
  const clips: Clip[] = [];
  let voice: FileSystemDirectoryHandle;
  try {
    voice = await dir.getDirectoryHandle('voice');
  } catch {
    return clips;
  }
  let row = 0;
  for (const block of script.blocks) {
    if (block.type !== 'row') continue;
    row++;
    try {
      const file = await (await voice.getFileHandle(`row-${block.id}.webm`)).getFile();
      clips.push({ row, samples: await decode(await file.arrayBuffer()) });
    } catch {
      // No take for this row, or one that can't be read: left out.
    }
  }
  return clips;
}

function decoder(rate: number) {
  return async (data: ArrayBuffer): Promise<Float32Array> => {
    // An offline context decodes without needing a click or a sound device, and resamples to `rate`.
    const audio = await new OfflineAudioContext(1, 1, rate).decodeAudioData(data);
    const out = new Float32Array(audio.length);
    for (let c = 0; c < audio.numberOfChannels; c++) {
      const channel = audio.getChannelData(c);
      for (let i = 0; i < out.length; i++) out[i] += channel[i] / audio.numberOfChannels;
    }
    return out;
  };
}

// The clips one after another, with `gap` seconds of silence between them.
export function join(clips: Clip[], rate: number, gap: number): Float32Array {
  const pause = Math.round(gap * rate);
  const out = new Float32Array(clips.reduce((n, c) => n + c.samples.length, 0) + pause * Math.max(0, clips.length - 1));
  let at = 0;
  for (const clip of clips) {
    out.set(clip.samples, at);
    at += clip.samples.length + pause;
  }
  return out;
}

// Mono 16-bit PCM WAV.
export function wav(samples: Float32Array, rate: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(44 + samples.length * 2));
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytes;
}
