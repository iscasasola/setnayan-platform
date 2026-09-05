/**
 * S3 · the programme audio mixer — page side.
 *
 * THERE WAS NO PROGRAMME AUDIO (rule 19, and `git grep -n AudioContext origin/main --
 * apps/web/lib apps/web/app/panood` returns only `mesh-call-webrtc.ts`'s talker analyser and
 * `reel-render.ts`'s music decode). Each phone publishes its own A/V track through
 * `lib/panood-webrtc.ts`, the mic may be refused outright so a camera can be video-only, and
 * the pop-out's idea of "sound" is unmuting the on-air `<video>` — which in split mode unmutes
 * BOTH, a defect nobody specified. This file is the mixing point the controller's comment
 * calls "phase 2".
 *
 * THE GRAPH
 *
 *     cam1 mic ─→ MediaStreamAudioSource ─→ Gain(0..1) ─┐
 *     cam2 mic ─→ MediaStreamAudioSource ─→ Gain(0..1) ─┤
 *     …                                                 ├─→ tap (AudioWorkletNode)
 *     ConstantSource(offset 0) ────────────────────────-┘        │
 *                                                                ├─→ Gain(0) → ctx.destination
 *                                                                └─→ MediaStreamAudioDestination  (B-remux only)
 *
 * · ONE `AudioContext({ sampleRate: 48000 })`, built on the go-live click because a context
 *   created without a user gesture starts `suspended` and every timestamp after it is a lie.
 * · EVERY camera that has an audio track keeps a live source node at gain 0. A cut is a 5 ms
 *   `linearRampToValueAtTime` on gains, NOT a rewiring: building a source node at cut time
 *   costs a click and a settling delay, and worse, it would make the on-air audio arrive with
 *   a different latency after every cut.
 * · The `ConstantSourceNode` at offset 0 is summed FOREVER. It is not decoration: a camera
 *   whose owner refused the mic contributes no node at all, and a graph with no inputs renders
 *   no quanta — so the tap would stop, the clock would stop, and the stream would die on a cut
 *   to a mic-less phone. YouTube also requires an audio track; digital silence is a stream,
 *   an absent track is not.
 * · SPLIT MODE TAKES PRIMARY ONLY. `cut()` names one camera; the split's second picture has no
 *   sound. That is the decision, not an omission — two live mics in one room is feedback.
 * · THE LAPTOP MIC IS NOT AN INPUT. No `getUserMedia` here, no permission prompt, no echo path.
 *   Nothing in this file touches a local capture device; grep it and see.
 * · The muted `Gain(0) → ctx.destination` leg exists because Web Audio only renders nodes that
 *   are reachable from the context destination. Without it the worklet is never pulled and the
 *   master clock never starts. It is silent by construction — the couple hears nothing.
 * · `remuxDestination()` is the B-remux sibling: a `MediaStreamAudioDestinationNode` carrying
 *   the same mix, which `canvas.captureStream()` + WHIP would publish if the plan ever forks
 *   that way. UNUSED ON PATH A. It is one node and one connect, kept so the branch point the
 *   S-series README marks at S3 stays open at the cost of one line.
 *
 * Plain browser code — no desktop-shell (Tauri) gate here; S5 gates the call site (rule 22).
 * Every browser touch-point is injectable so the whole graph runs in Node against fakes.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO: subscribe to anything. `ProgramBridge` publishes
 * only the on-air and secondary streams, and a mixer that registered cameras from the bridge
 * would hold exactly the cameras that are already cut — the opposite of what pre-connecting is
 * for. The call site (S5) hands it the controller's FULL camera set with `setCamera`, then
 * `cut()` on every bridge frame.
 */

import { AUDIO_SAMPLE_RATE } from './audio-clock';

/** How long a cut takes to cross-fade. Short enough to read as instant, long enough not to click. */
export const CUT_RAMP_SECONDS = 0.005;

/** The processor name registered by `audio-tap.worklet.ts` / `public/encoder/audio-tap.worklet.js`. */
export const AUDIO_TAP_PROCESSOR = 'setnayan-tap';

/** Where the shipped worklet lives. Same-origin, so `script-src 'self'` already allows it. */
export const AUDIO_TAP_MODULE_URL = '/encoder/audio-tap.worklet.js';

/* ── the narrow slice of Web Audio this file uses (a test passes recorders) ── */

export type AudioParamLike = {
  readonly value: number;
  cancelScheduledValues(when: number): unknown;
  setValueAtTime(value: number, when: number): unknown;
  linearRampToValueAtTime(value: number, when: number): unknown;
};

export type AudioNodeLike = {
  connect(destination: AudioNodeLike): unknown;
  disconnect(): void;
};

export type GainNodeLike = AudioNodeLike & { readonly gain: AudioParamLike };
export type ConstantSourceNodeLike = AudioNodeLike & { readonly offset: AudioParamLike; start(): void; stop(): void };
export type MessagePortLike = { postMessage(message: unknown, transfer?: unknown[]): void };
export type AudioWorkletNodeLike = AudioNodeLike & { readonly port: MessagePortLike };
export type MediaStreamLike = { getAudioTracks(): unknown[] };
export type MediaStreamDestinationLike = AudioNodeLike & { readonly stream: MediaStreamLike };

export type AudioContextLike = {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: AudioNodeLike;
  readonly audioWorklet: { addModule(url: string): Promise<void> };
  createGain(): GainNodeLike;
  createConstantSource(): ConstantSourceNodeLike;
  createMediaStreamSource(stream: MediaStreamLike): AudioNodeLike;
  createMediaStreamDestination(): MediaStreamDestinationLike;
  createWorkletNode(name: string): AudioWorkletNodeLike;
  resume(): Promise<void>;
  close(): Promise<void>;
};

export type AudioMixerDeps = {
  /** Built on the go-live gesture. Must be constructed with `sampleRate: 48000`. */
  createContext: () => AudioContextLike;
  /** URL of the worklet module. Overridable so a bundler-emitted asset can win. */
  workletUrl: string;
};

export type AudioMixerStats = {
  /** Cameras registered, and how many of them actually carry a mic. */
  cameras: number;
  withAudio: number;
  onAir: string | null;
  contextState: string;
  sampleRate: number;
  /** Cuts applied since `start()` — the number the evidence run counts against. */
  cuts: number;
};

export type AudioMixer = {
  /** Create the context, load the worklet, build the graph. Call it INSIDE the click handler. */
  start(): Promise<void>;
  /**
   * Register (or, with `null`, drop) one camera's stream. A stream with no audio track is
   * remembered but contributes no node — it is a camera that will be silent when cut to, and
   * the constant source is what keeps the programme alive through it.
   */
  setCamera(key: string, stream: MediaStreamLike | null): void;
  /** Cross-fade so only `key` is audible. `null` cuts everything to silence. */
  cut(key: string | null): void;
  /**
   * Hand the tap a `MessagePort` whose other end is in the canvas worker, so quanta go
   * audio-thread → worker DIRECTLY. Relaying through the page would put the master clock
   * behind the main thread's event loop — the exact throttling the audio clock exists to
   * escape (see audio-clock.ts).
   */
  linkToWorker(port: MessagePortLike): void;
  /** The B-remux sibling output. Null until `start()`. Unused on Path A. */
  remuxDestination(): MediaStreamLike | null;
  stats(): AudioMixerStats;
  stop(): Promise<void>;
};

/**
 * PURE. What every registered camera's gain should be for a given cut. Exported so the
 * decision is testable without a graph: exactly one camera reaches 1, everything else 0, and
 * an unknown on-air key silences the programme rather than leaving the last camera up.
 */
export function planCutGains(keys: readonly string[], onAir: string | null): Record<string, number> {
  const plan: Record<string, number> = {};
  for (const key of keys) plan[key] = key === onAir ? 1 : 0;
  return plan;
}

function browserDeps(): AudioMixerDeps {
  return {
    createContext: () => {
      const ctx = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
      return {
        get currentTime() {
          return ctx.currentTime;
        },
        get sampleRate() {
          return ctx.sampleRate;
        },
        get state() {
          return ctx.state as string;
        },
        destination: ctx.destination as unknown as AudioNodeLike,
        audioWorklet: ctx.audioWorklet,
        createGain: () => ctx.createGain() as unknown as GainNodeLike,
        createConstantSource: () => ctx.createConstantSource() as unknown as ConstantSourceNodeLike,
        createMediaStreamSource: (stream) =>
          ctx.createMediaStreamSource(stream as unknown as MediaStream) as unknown as AudioNodeLike,
        createMediaStreamDestination: () =>
          ctx.createMediaStreamDestination() as unknown as MediaStreamDestinationLike,
        createWorkletNode: (name) =>
          new AudioWorkletNode(ctx, name, {
            numberOfInputs: 1,
            numberOfOutputs: 1,
            outputChannelCount: [2],
            channelCount: 2,
            channelCountMode: 'explicit',
            channelInterpretation: 'speakers',
          }) as unknown as AudioWorkletNodeLike,
        resume: () => ctx.resume(),
        close: () => ctx.close(),
      };
    },
    workletUrl: AUDIO_TAP_MODULE_URL,
  };
}

type Camera = { stream: MediaStreamLike; source: AudioNodeLike | null; gain: GainNodeLike | null };

export function createAudioMixer(options: { deps?: Partial<AudioMixerDeps> } = {}): AudioMixer {
  let deps: AudioMixerDeps | null = null;
  let ctx: AudioContextLike | null = null;
  let tap: AudioWorkletNodeLike | null = null;
  let silence: ConstantSourceNodeLike | null = null;
  let mute: GainNodeLike | null = null;
  let remux: MediaStreamDestinationLike | null = null;
  let onAir: string | null = null;
  let cuts = 0;
  let pendingPort: MessagePortLike | null = null;
  const cameras = new Map<string, Camera>();

  function rampTo(gain: GainNodeLike, target: number): void {
    if (!ctx) return;
    const t = ctx.currentTime;
    gain.gain.cancelScheduledValues(t);
    // Pin the CURRENT value at `t` first: without it a ramp starts from the last SCHEDULED
    // value, so a cut landing mid-fade jumps.
    gain.gain.setValueAtTime(gain.gain.value, t);
    gain.gain.linearRampToValueAtTime(target, t + CUT_RAMP_SECONDS);
  }

  function attach(key: string, stream: MediaStreamLike): Camera {
    const context = ctx;
    if (!context) throw new Error('audio-mixer: attach before start');
    const gain = context.createGain();
    gain.gain.setValueAtTime(key === onAir ? 1 : 0, context.currentTime);
    const hasAudio = stream.getAudioTracks().length > 0;
    const source = hasAudio ? context.createMediaStreamSource(stream) : null;
    source?.connect(gain);
    if (tap) gain.connect(tap);
    return { stream, source, gain };
  }

  function detach(camera: Camera): void {
    camera.source?.disconnect();
    camera.gain?.disconnect();
  }

  return {
    async start(): Promise<void> {
      if (ctx) return;
      deps = { ...browserDeps(), ...options.deps };
      const context = deps.createContext();
      ctx = context;
      await context.audioWorklet.addModule(deps.workletUrl);
      await context.resume();

      const node = context.createWorkletNode(AUDIO_TAP_PROCESSOR);
      tap = node;
      if (pendingPort) {
        node.port.postMessage({ type: 'relay', port: pendingPort }, [pendingPort]);
        pendingPort = null;
      }

      // Silence first, so the graph is never empty even for the first quantum.
      const constant = context.createConstantSource();
      constant.offset.setValueAtTime(0, context.currentTime);
      constant.connect(node);
      constant.start();
      silence = constant;

      // Pull the graph without making a sound. See the docblock.
      const muted = context.createGain();
      muted.gain.setValueAtTime(0, context.currentTime);
      node.connect(muted);
      muted.connect(context.destination);
      mute = muted;

      // B-remux sibling. One line, unused on Path A.
      remux = context.createMediaStreamDestination();
      node.connect(remux);

      // Cameras registered before start() were held as streams only; wire them now.
      for (const [key, camera] of cameras) cameras.set(key, attach(key, camera.stream));
    },

    setCamera(key: string, stream: MediaStreamLike | null): void {
      const existing = cameras.get(key);
      if (!stream) {
        if (existing) {
          if (ctx) detach(existing);
          cameras.delete(key);
        }
        if (onAir === key) onAir = null;
        return;
      }
      if (existing) {
        if (existing.stream === stream) return;
        if (ctx) detach(existing);
      }
      // Before start() there is no graph to attach to; the stream is held and wired in start().
      cameras.set(key, ctx ? attach(key, stream) : { stream, source: null, gain: null });
    },

    cut(key: string | null): void {
      onAir = key;
      cuts += 1;
      if (!ctx) return;
      const plan = planCutGains([...cameras.keys()], key);
      for (const [name, camera] of cameras) if (camera.gain) rampTo(camera.gain, plan[name] ?? 0);
    },

    linkToWorker(port: MessagePortLike): void {
      if (tap) tap.port.postMessage({ type: 'relay', port }, [port]);
      else pendingPort = port;
    },

    remuxDestination: () => remux?.stream ?? null,

    stats(): AudioMixerStats {
      let withAudio = 0;
      for (const camera of cameras.values()) if (camera.source) withAudio += 1;
      return {
        cameras: cameras.size,
        withAudio,
        onAir,
        contextState: ctx?.state ?? 'closed',
        sampleRate: ctx?.sampleRate ?? 0,
        cuts,
      };
    },

    async stop(): Promise<void> {
      for (const camera of cameras.values()) if (ctx) detach(camera);
      cameras.clear();
      silence?.stop();
      silence?.disconnect();
      mute?.disconnect();
      remux?.disconnect();
      tap?.disconnect();
      silence = null;
      mute = null;
      remux = null;
      tap = null;
      onAir = null;
      pendingPort = null;
      const context = ctx;
      ctx = null;
      await context?.close();
    },
  };
}
