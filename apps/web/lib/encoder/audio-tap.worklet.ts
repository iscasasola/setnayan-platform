/**
 * S3 · the tap — the one thing that runs on the audio render thread.
 *
 * `process()` is called by the browser every 128 frames (2.67 ms at 48 kHz) on a real-time
 * thread that visibility throttling does not touch. That cadence IS the master clock; this
 * file's whole job is to get each quantum, and the frame count it belongs to, out of the audio
 * thread with as little work as possible.
 *
 * IT POSTS STRAIGHT TO THE CANVAS WORKER. On construction the mixer hands it a `MessagePort`
 * whose other end lives in `program-canvas.worker.ts` (`{ type: 'relay', port }`), so quanta
 * never touch the page's event loop. Relaying through the main thread would put the clock
 * behind whatever the controller UI is doing and behind the same throttling the audio thread
 * was chosen to escape.
 *
 * `currentFrame` is the AudioWorkletGlobalScope's running count of rendered frames. It is the
 * number every timestamp in the encoder descends from — see audio-clock.ts.
 *
 * ⚠ THE SHIPPED WORKLET IS `apps/web/public/encoder/audio-tap.worklet.js`, NOT THIS FILE.
 * `audioWorklet.addModule()` takes a URL and fetches it as a classic script: there is no
 * bundler step in that path, so a `.ts` under `lib/` can never be what the browser loads.
 * This file is the TYPED source of the same processor — it is where the packing arithmetic is
 * written and tested — and `audio-tap.worklet.test.ts` evaluates the shipped `.js` in Node and
 * fails if the two ever disagree on a single sample. Change one, change both; the test says so.
 *
 * ⚠ THE LAPTOP MIC IS NOT AN INPUT ANYWHERE IN S3. This processor reads `inputs[0]` — the
 * mixed camera gains — and nothing else. There is no `getUserMedia` in the encoder.
 */

/** Frames in one render quantum. Fixed by the Web Audio spec. */
export const TAP_QUANTUM_FRAMES = 128;

/** Channels the tap always emits, whatever arrives. AAC-LC stereo downstream. */
export const TAP_CHANNELS = 2;

/**
 * PURE. One render quantum → the `f32-planar` layout `AudioData` wants: all of channel 0,
 * then all of channel 1.
 *
 * Three shapes arrive in practice and all three must produce a full quantum:
 *   · 2 channels — copied through.
 *   · 1 channel — DUPLICATED to both, not left half-silent. A phone that publishes mono is the
 *     common case, and a mono mic that only comes out of the left speaker is a defect the
 *     couple would hear before we did.
 *   · 0 channels, or a disconnected input — silence. The graph always has the ConstantSource,
 *     so this is belt and braces, and it is what keeps the clock ticking rather than throwing.
 * A short or missing channel buffer is zero-filled for its remainder rather than shifting the
 * samples that did arrive.
 */
export function packQuantum(input: readonly Float32Array[] | undefined, frames = TAP_QUANTUM_FRAMES): Float32Array {
  const out = new Float32Array(TAP_CHANNELS * frames);
  const channels = input?.length ?? 0;
  if (channels === 0) return out;
  for (let ch = 0; ch < TAP_CHANNELS; ch += 1) {
    const src = input?.[channels === 1 ? 0 : Math.min(ch, channels - 1)];
    if (!src) continue;
    const n = Math.min(frames, src.length);
    for (let i = 0; i < n; i += 1) out[ch * frames + i] = src[i] as number;
  }
  return out;
}

/* ── the processor itself ──────────────────────────────────────────────────── */

type ProcessorPort = { postMessage(message: unknown, transfer?: unknown[]): void; onmessage: ((ev: { data: unknown }) => void) | null };
type ProcessorBase = { readonly port: ProcessorPort };
type ProcessorCtor = new () => ProcessorBase;

declare const AudioWorkletProcessor: ProcessorCtor | undefined;
declare const registerProcessor: ((name: string, ctor: ProcessorCtor) => void) | undefined;
declare const currentFrame: number | undefined;

/**
 * In the audio worklet this is the real base class. Under `tsx --test` it is a stand-in, so the
 * module can be imported and `packQuantum` held to account without a browser — the same trick
 * program-canvas.worker.ts uses for its worker globals.
 */
const Base: ProcessorCtor =
  typeof AudioWorkletProcessor !== 'undefined'
    ? AudioWorkletProcessor
    : (class {
        readonly port: ProcessorPort = { postMessage: () => {}, onmessage: null };
      } as unknown as ProcessorCtor);

export class SetnayanTapProcessor extends Base {
  private relay: { postMessage(message: unknown, transfer?: unknown[]): void } | null = null;

  constructor() {
    super();
    this.port.onmessage = (ev: { data: unknown }) => {
      const data = ev.data as { type?: string; port?: { postMessage(m: unknown, t?: unknown[]): void } };
      if (data?.type === 'relay' && data.port) this.relay = data.port;
    };
  }

  process(inputs: Float32Array[][]): boolean {
    const relay = this.relay;
    if (relay) {
      const frames = packQuantum(inputs[0], TAP_QUANTUM_FRAMES);
      relay.postMessage(
        { type: 'quantum', currentFrame: typeof currentFrame === 'number' ? currentFrame : 0, frames },
        [frames.buffer],
      );
    }
    // ALWAYS true. Returning false lets the browser garbage-collect the processor, which would
    // stop the master clock — and the whole encoder with it — the moment inputs went quiet.
    return true;
  }
}

if (typeof registerProcessor === 'function') registerProcessor('setnayan-tap', SetnayanTapProcessor);
