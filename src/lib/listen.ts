// Listening to the microphone for the teleprompter (EX-8): a few seconds of sound at a time go to Whisper
// (`whisper.worker.ts`), and what it hears comes back as text. Everything stays in the browser.

export type Listening = { stop: () => void };
type Hooks = { onText: (text: string) => void; onProgress: (loaded: number, total: number) => void; onFail?: () => void };
export class ListenError extends Error {
  constructor(public why: 'microphone' | 'download') {
    super(why);
  }
}

const RATE = 16000; // what Whisper hears
const WINDOW = 4 * RATE; // each time, the last 4 s are heard
const EVERY = RATE; // and at most once a second
const QUIET = 0.01; // below this loudness it is silence (Whisper makes up words in silence)

export async function listen(hooks: Hooks): Promise<Listening> {
  // Tests stand in for the microphone and Whisper (tests/e2e/teleprompter.spec.ts).
  const fake = (window as unknown as { studioListen?: (h: Hooks) => Promise<Listening> }).studioListen;
  if (fake) return fake(hooks);

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch {
    throw new ListenError('microphone');
  }
  const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), { type: 'module' });
  const stop = () => {
    stream.getTracks().forEach((t) => t.stop());
    worker.terminate();
    context?.close().catch(() => {});
  };
  let context: AudioContext | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') hooks.onProgress(data.loaded, data.total);
        else if (data.type === 'ready') resolve();
        else if (data.type === 'error') reject();
      };
      worker.onerror = () => reject();
      worker.postMessage({ type: 'load' });
    });
  } catch {
    stop();
    throw new ListenError('download');
  }

  // The device's own rate (some phones refuse a 16 kHz microphone), brought down to 16 kHz below. A context made
  // after the download has lost the click that allowed sound, so phones start it paused: resume it.
  context = new AudioContext();
  await context.resume().catch(() => {});
  const step = context.sampleRate / RATE;
  let carry = 0; // where the next 16 kHz sample falls in the next piece of sound
  const tap = `registerProcessor('tap', class extends AudioWorkletProcessor {
    process([input]) { if (input[0]) this.port.postMessage(input[0].slice(0)); return true; }
  });`;
  const url = URL.createObjectURL(new Blob([tap], { type: 'text/javascript' }));
  await context.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const node = new AudioWorkletNode(context, 'tap');
  context.createMediaStreamSource(stream).connect(node);
  node.connect(context.destination); // silent, but some browsers only run a node that leads somewhere

  const sound = new Float32Array(WINDOW);
  let fresh = 0; // samples since the last time something was sent
  let busy = false;
  node.port.onmessage = ({ data: raw }: MessageEvent<Float32Array>) => {
    let data: Float32Array;
    [data, carry] = resample(raw, step, carry);
    sound.copyWithin(0, data.length);
    sound.set(data, WINDOW - data.length);
    fresh += data.length;
    if (busy || fresh < EVERY) return;
    fresh = 0;
    let sum = 0;
    for (let i = WINDOW - EVERY; i < WINDOW; i++) sum += sound[i] * sound[i];
    if (Math.sqrt(sum / EVERY) < QUIET) return;
    busy = true;
    worker.postMessage({ type: 'hear', audio: sound.slice() });
  };
  let failed = 0;
  worker.onmessage = ({ data }) => {
    busy = false;
    if (data.type === 'heard') (failed = 0), hooks.onText(data.text);
    else if (data.type === 'error' && ++failed >= 3) hooks.onFail?.(); // three in a row: it isn't going to work here
  };
  worker.onerror = () => hooks.onFail?.(); // the worker itself stopped (out of memory on a phone)
  return { stop };
}

// A piece of sound at `step` times 16 kHz brought down to 16 kHz (straight lines between samples). `carry`: where the
// first new sample falls, left over from the piece before. Returns the samples and the carry for the next piece.
export function resample(raw: Float32Array, step: number, carry: number): [Float32Array, number] {
  const out = new Float32Array(Math.max(0, Math.ceil((raw.length - carry) / step)));
  for (let i = 0; i < out.length; i++) {
    const at = carry + i * step;
    const j = Math.floor(at);
    out[i] = raw[j] + ((raw[j + 1] ?? raw[j]) - raw[j]) * (at - j);
  }
  return [out, carry + out.length * step - raw.length];
}
