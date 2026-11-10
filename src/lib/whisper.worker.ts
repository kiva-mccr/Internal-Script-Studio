// Whisper, in a worker so the teleprompter keeps scrolling smoothly while it listens (EX-8). Runs in the browser:
// the model is downloaded once from Hugging Face and kept by the browser; no sound leaves the computer.
import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

const MODEL = 'Xenova/whisper-base.en'; // about 75 MB at 8 bits (board 10: the user picked it)
let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
const files = new Map<string, { loaded: number; total: number }>();

function load() {
  // Typed loosely: the pipeline's own types are too large for the checker.
  const make = pipeline as unknown as (task: string, model: string, options: object) => Promise<AutomaticSpeechRecognitionPipeline>;
  return (asr ??= make('automatic-speech-recognition', MODEL, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== 'progress' || !p.file) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
      let loaded = 0, total = 0;
      for (const f of files.values()) (loaded += f.loaded), (total += f.total);
      postMessage({ type: 'progress', loaded, total });
    },
  }));
}

onmessage = async (event: MessageEvent<{ type: 'load' } | { type: 'hear'; audio: Float32Array }>) => {
  const message = event.data;
  try {
    if (message.type === 'load') {
      await load();
      postMessage({ type: 'ready' });
    } else {
      const out = await (await load())(message.audio);
      postMessage({ type: 'heard', text: Array.isArray(out) ? out.map((o) => o.text).join(' ') : out.text });
    }
  } catch {
    asr = null;
    postMessage({ type: 'error', at: message.type });
  }
};
