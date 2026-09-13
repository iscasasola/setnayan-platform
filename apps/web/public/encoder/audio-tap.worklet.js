// S3 · the shipped programme-audio tap. Loaded by `audioWorklet.addModule('/encoder/audio-tap.worklet.js')`.
//
// ⚠ THIS FILE IS THE ONE THE BROWSER RUNS, and it is plain JavaScript on purpose:
// `addModule()` fetches a URL and evaluates it as a classic script, so nothing in `lib/` can
// be bundled into this path. The TYPED source of the same processor is
// `apps/web/lib/encoder/audio-tap.worklet.ts`, and `audio-tap.worklet.test.ts` evaluates THIS
// file in Node beside that one and fails on the first sample where they disagree. Change one,
// change both.
//
// Everything this does and why: see the docblock in audio-tap.worklet.ts.

const TAP_QUANTUM_FRAMES = 128;
const TAP_CHANNELS = 2;

export function packQuantum(input, frames = TAP_QUANTUM_FRAMES) {
  const out = new Float32Array(TAP_CHANNELS * frames);
  const channels = input ? input.length : 0;
  if (channels === 0) return out;
  for (let ch = 0; ch < TAP_CHANNELS; ch += 1) {
    const src = input[channels === 1 ? 0 : Math.min(ch, channels - 1)];
    if (!src) continue;
    const n = Math.min(frames, src.length);
    for (let i = 0; i < n; i += 1) out[ch * frames + i] = src[i];
  }
  return out;
}

class SetnayanTapProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.relay = null;
    this.port.onmessage = (ev) => {
      const data = ev.data;
      if (data && data.type === 'relay' && data.port) this.relay = data.port;
    };
  }

  process(inputs) {
    const relay = this.relay;
    if (relay) {
      const frames = packQuantum(inputs[0], TAP_QUANTUM_FRAMES);
      relay.postMessage({ type: 'quantum', currentFrame, frames }, [frames.buffer]);
    }
    // ALWAYS true — see the .ts.
    return true;
  }
}

registerProcessor('setnayan-tap', SetnayanTapProcessor);
