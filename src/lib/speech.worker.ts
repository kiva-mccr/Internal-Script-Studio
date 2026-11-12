// Speech recognition, in a worker so the teleprompter keeps scrolling smoothly while it listens (EX-8, EX-12).
// Runs in the browser: the model is downloaded once from Hugging Face and kept by the browser; no sound leaves the
// computer. Moonshine (EX-12) rather than Whisper: its work grows with the length of the sound, where Whisper always
// works through 30 s, so a few seconds are heard several times faster. On the graphics card (WebGPU) where there is
// one, otherwise on the processor (WebAssembly).
import { pipeline, type AutomaticSpeechRecognitionPipeline } from '@huggingface/transformers';

const MODEL = 'onnx-community/moonshine-base-ONNX';
// Per device, as Hugging Face's own Moonshine demo runs it: the encoder at full precision, the decoder squeezed.
const DTYPE = {
  webgpu: { encoder_model: 'fp32', decoder_model_merged: 'q4' },
  wasm: { encoder_model: 'fp32', decoder_model_merged: 'q8' },
};
let asr: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
const files = new Map<string, { loaded: number; total: number }>();

async function gpu() {
  try {
    const gpu = (navigator as unknown as { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    return !!(await gpu?.requestAdapter());
  } catch {
    return false;
  }
}

function make(device: 'webgpu' | 'wasm') {
  // Typed loosely: the pipeline's own types are too large for the checker.
  const make = pipeline as unknown as (task: string, model: string, options: object) => Promise<AutomaticSpeechRecognitionPipeline>;
  return make('automatic-speech-recognition', MODEL, {
    dtype: DTYPE[device],
    device,
    progress_callback: (p: { status: string; file?: string; loaded?: number; total?: number }) => {
      if (p.status !== 'progress' || !p.file) return;
      files.set(p.file, { loaded: p.loaded ?? 0, total: p.total ?? 0 });
      let loaded = 0, total = 0;
      for (const f of files.values()) (loaded += f.loaded), (total += f.total);
      postMessage({ type: 'progress', loaded, total });
    },
  });
}

async function start() {
  if (await gpu()) {
    try {
      const ready = await make('webgpu');
      await ready(new Float32Array(16000)); // a graphics card that can't run it fails here, not mid-script
      return ready;
    } catch {
      files.clear(); // the processor's files are counted afresh
    }
  }
  return make('wasm');
}

const load = () => (asr ??= start());

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
