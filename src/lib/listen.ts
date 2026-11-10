// Listening to the microphone for the teleprompter (EX-8): a few seconds of sound at a time go to Whisper
// (`whisper.worker.ts`), and what it hears comes back as text. Everything stays in the browser.

export type Listening = { stop: () => void };
type Hooks = { onText: (text: string) => void; onProgress: (loaded: number, total: number) => void };
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

  context = new AudioContext({ sampleRate: RATE });
  const tap = `registerProcessor('tap', class extends AudioWorkletProcessor {
    process([input]) { if (input[0]) this.port.postMessage(input[0].slice(0)); return true; }
  });`;
  const url = URL.createObjectURL(new Blob([tap], { type: 'text/javascript' }));
  await context.audioWorklet.addModule(url);
  URL.revokeObjectURL(url);
  const node = new AudioWorkletNode(context, 'tap');
  context.createMediaStreamSource(stream).connect(node);

  const sound = new Float32Array(WINDOW);
  let fresh = 0; // samples since the last time something was sent
  let busy = false;
  node.port.onmessage = ({ data }: MessageEvent<Float32Array>) => {
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
  worker.onmessage = ({ data }) => {
    if (data.type === 'heard') hooks.onText(data.text);
    busy = false;
  };
  return { stop };
}
