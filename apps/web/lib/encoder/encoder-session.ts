/**
 * apps/web/lib/encoder/encoder-session.ts
 *
 * ENC-1 · THE JOIN. The one file that makes the encoder a pipeline instead of a
 * collection of finished parts.
 *
 * ── WHAT THIS IS FOR ────────────────────────────────────────────────────────────
 * Measured against `origin/main` on 2026-09-09, every stage of Setnayan's own
 * broadcast encoder was built, tested and merged — and NOTHING CALLED ANY OF THEM:
 *
 *   · `program-canvas.ts` · `program-canvas.worker.ts` · `audio-mixer.ts` ·
 *     `video-encode.ts` · `ipc-contract.ts` · `ipc-envelope.ts` ·
 *     `backpressure-ring.ts` and six more — **13 modules, every one imported only
 *     by its own test file.**
 *   · The Tauri commands `encoder_start` / `encoder_config` / `encoder_push` /
 *     `encoder_stop` — **zero callers in `apps/web`.**
 *   · `start_keep_awake` / `stop_keep_awake` — **zero callers.**
 *   · The Rust crate's `sender` / `tagger` / `reconnect` / `file_sink`, 83 tests
 *     gating CI — **zero references anywhere under `src-tauri/src/`**; the app's
 *     own `encoder_start` ran a stub that counted bytes and threw them away.
 *
 * The plan of record called the pipeline "complete end to end". Every part was
 * complete; not one join existed. This is the joins.
 *
 * ── THE SHAPE ───────────────────────────────────────────────────────────────────
 *
 *   cameras ─► mixer ─┬─► worker (master clock) ─► composite ─► H.264 + AAC ─┐
 *                     └─ MessageChannel, audio thread → worker directly       │
 *                                                                            ▼
 *   Rust  ◄── encoder_push (base64) ◄── chunkToBase64 ◄── encodeChunk ◄── onMedia
 *
 * ── EVERY BROWSER TOUCH-POINT IS INJECTED ───────────────────────────────────────
 * `deps` carries `invoke`, `fetch`, the mixer factory and the canvas factory, so the
 * whole join — token, ordering, the config gate, the push loop, teardown — runs in
 * Node against fakes. There is no `window`, no `Worker` and no `AudioContext` in
 * this file. That is deliberate: the pieces below it each have a passing unit suite
 * and were still never joined, so the JOIN is what needs a test more than any of
 * them did.
 *
 * ── THE ORDERING RULE, AND WHY IT IS THE WHOLE FILE ─────────────────────────────
 * Rust's FLV muxer cannot decode a keyframe without `avcC` AND `asc`, and
 * `tagger.rs` counts every media frame that arrives before them
 * (`media_before_config`). WebCodecs emits each configuration exactly ONCE, on its
 * first output — and the two encoders reach their first output at different moments.
 * So media is HELD here until both halves exist and one `Config` chunk has been
 * sent. Holding is bounded (`PENDING_CAP`) and the drop is counted: an encoder that
 * never produces a configuration must not grow this without limit.
 */

import {
  ChunkKind,
  encodeChunk,
  encodeDecoderConfigPayload,
  type EncodedChunk,
} from './ipc-contract';
import { chunkToBase64 } from './ipc-envelope';
import type { MediaChunk, ProgramCanvas, ProgramCanvasStats, ProgramDecoderConfigs } from './program-canvas';
import type { AudioMixer, MediaStreamLike } from './audio-mixer';

/** Must match `src-tauri/src/encoder_ipc.rs`'s `HEALTH_EVENT` / `ENDED_EVENT`. */
export const ENCODER_EVENT = {
  health: 'encoder://health',
  ended: 'encoder://ended',
} as const;

/**
 * How many encoded chunks may wait for the decoder configurations before the oldest
 * are dropped. Both encoders normally produce a configuration on their FIRST output,
 * so in practice this holds one or two chunks for a few milliseconds. The cap exists
 * for the failure case — a `VideoEncoder` that emits chunks with no `decoderConfig`
 * at all — where the honest outcome is a counted drop, not unbounded memory.
 */
export const PENDING_CAP = 120;

export type EncoderSessionPhase =
  /** Nothing started. */
  | 'idle'
  /** Minting the token / verifying it with Rust. */
  | 'starting'
  /** Encoding, but the decoder configurations have not both arrived yet. */
  | 'awaiting-config'
  /** Configuration sent; media is flowing to Rust. */
  | 'sending'
  /** Stopping, or stopped. */
  | 'stopped'
  /** Refused, with a reason. */
  | 'failed';

export type EncoderSessionState = {
  phase: EncoderSessionPhase;
  /** Plain-English, operator-facing. Never a stack trace, never an identifier. */
  message: string;
  /** Chunks handed to Rust since start — video and audio together. */
  chunksSent: number;
  bytesSent: number;
  /** Chunks dropped waiting for a decoder configuration that never came. */
  droppedAwaitingConfig: number;
  /** Chunks Rust refused because its bounded channel was full. */
  refusedByRust: number;
  /** The worker's own counters, once a second, or null before the first report. */
  stats: ProgramCanvasStats | null;
};

export type EncoderSessionDeps = {
  /** The Tauri bridge. Injected so this file never imports `@tauri-apps/api`. */
  invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  fetch: typeof fetch;
  createMixer: () => AudioMixer;
  createCanvas: () => ProgramCanvas;
};

export type EncoderSessionOptions = {
  eventId: string;
  /**
   * The NON-SECRET ingest server address — what the couple's own YouTube Studio calls
   * "Server". Rust pairs it with the key IT already holds; the key never travels this
   * way. On the hosted-channel path the address `/exchange` returned wins over this
   * one inside `stream_key.rs`, so a compromised page cannot redirect a Setnayan-held
   * key to an ingest of its choosing.
   */
  rtmpsUrl: string;
  rtmpsBackupUrl?: string | null;
  /**
   * The event's public id, used only to name the local `.flv`. Absent ⇒ no recording.
   * For a hosted-channel couple that file is the only copy that will ever exist
   * (`file_sink.rs`), so absence is a decision, never a default.
   */
  recordEventPublicId?: string | null;
  deps: EncoderSessionDeps;
  onState?: (state: EncoderSessionState) => void;
};

export type EncoderSession = {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Register (or drop) one camera's audio, so the sound follows the cut. */
  setCamera(key: string, stream: MediaStreamLike | null): void;
  /** Cross-fade the programme audio to one camera. */
  cut(key: string | null): void;
  state(): EncoderSessionState;
};

/** PURE. Both halves present ⇒ the one `Config` chunk Rust needs. */
export function buildConfigChunk(configs: ProgramDecoderConfigs): EncodedChunk | null {
  if (!configs.avcc || !configs.asc) return null;
  return {
    header: { kind: ChunkKind.Config, keyframe: false, seq: 0, tsUs: 0n },
    payload: encodeDecoderConfigPayload({
      avcC: new Uint8Array(configs.avcc),
      asc: new Uint8Array(configs.asc),
    }),
  };
}

/**
 * PURE. One encoded access unit as the wire wants it.
 *
 * ⚠ `kind` is decided by the CALLER, not sniffed from the chunk: audio and video
 * carry byte-identical shapes here, and a heuristic that guessed wrong would put AAC
 * bytes through the H.264 tagger, which fails silently as an unplayable stream rather
 * than as an error.
 */
export function buildMediaChunk(kind: typeof ChunkKind.Video | typeof ChunkKind.Audio, chunk: MediaChunk): EncodedChunk {
  return {
    header: {
      kind,
      keyframe: chunk.keyframe,
      seq: chunk.seq,
      // `ts_us` is a u64 on the wire and a bigint here, for the reason
      // `ipc-contract.ts` states: a wedding runs past the 32-bit millisecond
      // ceiling and JS's number type would round the microseconds.
      // Negative timestamps cannot be encoded as unsigned — WebCodecs never emits
      // one on this clock (it counts up from the first quantum), and clamping is
      // the safe direction: a chunk at t=0 is early, a chunk at t=2^64 is a
      // decoder fault that never resolves.
      tsUs: BigInt(Math.max(0, Math.trunc(chunk.timestampMicros))),
    },
    payload: new Uint8Array(chunk.data),
  };
}

/**
 * PURE. Which Tauri error strings mean "the operator can fix this", and what to say.
 * Exported so the sentences are testable without a Tauri bridge — and so a new Rust
 * error string shows up as an unmapped default rather than as a blank panel.
 */
export function startFailureMessage(error: string): string {
  if (error.includes('no_stream_key')) {
    return 'Paste your YouTube stream key first — Setnayan holds it, and it never leaves this app.';
  }
  if (error.includes('no_ingest_address') || error.includes('bad_ingest_address')) {
    return 'That streaming server address is not one we can reach. Copy it again from YouTube Studio.';
  }
  if (error.includes('token_rejected') || error.includes('no_active_broadcast')) {
    return 'Press Go live first — there is no broadcast for the encoder to send to yet.';
  }
  if (error.includes('verify_request_failed')) {
    return 'We could not reach Setnayan to check this broadcast. Check your internet and try again.';
  }
  return 'The encoder could not start. Try again, and if it keeps happening tell us what this said: ' + error;
}

export function createEncoderSession(options: EncoderSessionOptions): EncoderSession {
  const { deps } = options;
  let mixer: AudioMixer | null = null;
  let canvas: ProgramCanvas | null = null;
  let unsubscribe: Array<() => void> = [];
  let configSent = false;
  /** Held until the configuration goes out. See the file docblock's ordering rule. */
  let pending: EncodedChunk[] = [];

  const state: EncoderSessionState = {
    phase: 'idle',
    message: '',
    chunksSent: 0,
    bytesSent: 0,
    droppedAwaitingConfig: 0,
    refusedByRust: 0,
    stats: null,
  };

  function publish(): void {
    options.onState?.({ ...state });
  }

  function set(phase: EncoderSessionPhase, message: string): void {
    state.phase = phase;
    state.message = message;
    publish();
  }

  /**
   * Push one chunk across IPC. Never throws: a broadcast must not end because one
   * frame was refused, and Rust's own channel is bounded by design. A refusal is
   * COUNTED so the controller can say "the encoder is falling behind" instead of
   * showing a stream that is silently missing frames.
   */
  async function send(chunk: EncodedChunk, command: 'encoder_config' | 'encoder_push'): Promise<void> {
    const bytes = encodeChunk(chunk);
    try {
      await deps.invoke(command, { chunk: chunkToBase64(chunk) });
      state.chunksSent += 1;
      state.bytesSent += bytes.length;
    } catch {
      state.refusedByRust += 1;
    }
  }

  function hold(chunk: EncodedChunk): void {
    pending.push(chunk);
    while (pending.length > PENDING_CAP) {
      pending.shift();
      state.droppedAwaitingConfig += 1;
    }
  }

  async function drainPending(): Promise<void> {
    const queued = pending;
    pending = [];
    for (const chunk of queued) await send(chunk, 'encoder_push');
  }

  async function onConfigs(configs: ProgramDecoderConfigs): Promise<void> {
    if (configSent) return;
    const chunk = buildConfigChunk(configs);
    if (!chunk) return; // one half still missing — keep holding.
    configSent = true;
    await send(chunk, 'encoder_config');
    await drainPending();
    set('sending', 'Sending your programme to YouTube.');
  }

  async function onMedia(media: { video: MediaChunk[]; audio: MediaChunk[] }): Promise<void> {
    // Video first within a batch, then audio: within one 100 ms window both are
    // stamped from the same counter, so ordering here is cosmetic for the muxer —
    // but a deterministic order makes a captured `.flv` diffable between runs.
    for (const c of media.video) {
      const chunk = buildMediaChunk(ChunkKind.Video, c);
      if (configSent) await send(chunk, 'encoder_push');
      else hold(chunk);
    }
    for (const c of media.audio) {
      const chunk = buildMediaChunk(ChunkKind.Audio, c);
      if (configSent) await send(chunk, 'encoder_push');
      else hold(chunk);
    }
    publish();
  }

  return {
    async start(): Promise<void> {
      if (state.phase === 'starting' || state.phase === 'sending' || state.phase === 'awaiting-config') return;
      set('starting', 'Getting your broadcast ready…');
      configSent = false;
      pending = [];

      // 1 · The single-use token that authorizes ONE `encoder_start`
      //     (lib/live-studio-encoder-tokens.ts). The page never learns which
      //     broadcast it is bound to — the server resolves that from the event.
      let token: string;
      try {
        const res = await deps.fetch('/api/live-studio/encoder/token', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ eventId: options.eventId }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          set('failed', startFailureMessage(body.error ?? String(res.status)));
          return;
        }
        token = ((await res.json()) as { token: string }).token;
      } catch {
        set('failed', startFailureMessage('verify_request_failed'));
        return;
      }

      // 2 · Rust opens the real publish path (RTMPS + the local recording).
      try {
        await deps.invoke('encoder_start', {
          token,
          rtmpsUrl: options.rtmpsUrl,
          rtmpsBackupUrl: options.rtmpsBackupUrl ?? null,
          recordEventPublicId: options.recordEventPublicId ?? null,
        });
      } catch (error) {
        set('failed', startFailureMessage(error instanceof Error ? error.message : String(error)));
        return;
      }

      // 3 · Hold the display awake. S10 built these commands and NOTHING has ever
      //     called them — a laptop that sleeps mid-ceremony takes the wedding with
      //     it. Never fatal: a refused assertion is a worse night's sleep for the
      //     machine, not a reason to refuse the broadcast.
      void deps.invoke('start_keep_awake').catch(() => {});

      // 4 · The audio graph. It must be built inside the operator's own gesture —
      //     `start()` is called from the click handler for exactly this reason.
      const m = deps.createMixer();
      mixer = m;
      await m.start();

      // 5 · The composite. It subscribes to the program bridge the controller has
      //     already installed, so this adds no second viewer and steals no picture.
      const c = deps.createCanvas();
      canvas = c;
      unsubscribe.push(c.onConfigs((configs) => void onConfigs(configs)));
      unsubscribe.push(c.onMedia((media) => void onMedia(media)));
      unsubscribe.push(
        c.onFrameCount((stats) => {
          state.stats = stats;
          publish();
        }),
      );
      unsubscribe.push(
        c.onError((where, message) => {
          set('failed', `The encoder stopped: ${where} — ${message}`);
        }),
      );
      c.start();

      // 6 · THE LINK THAT STARTS THE CLOCK. Until this message the worker has no
      //     clock at all and composites nothing — its own docblock: "a picture
      //     stamped on a timeline that does not exist yet is worse than no picture."
      //     Nothing anywhere sent it before this file existed.
      const channel = new MessageChannel();
      m.linkToWorker(channel.port1);
      c.linkAudio(channel.port2);

      set('awaiting-config', 'Starting the picture and the sound…');
    },

    async stop(): Promise<void> {
      for (const off of unsubscribe) off();
      unsubscribe = [];
      // Stop the producer before Rust, so the tail of the broadcast is flushed into
      // a channel that is still open.
      canvas?.stop();
      canvas = null;
      await mixer?.stop().catch(() => {});
      mixer = null;
      try {
        await deps.invoke('encoder_stop');
      } catch {
        // Already stopped, or never authorized. Nothing to recover.
      }
      void deps.invoke('stop_keep_awake').catch(() => {});
      configSent = false;
      pending = [];
      set('stopped', 'Your broadcast has ended.');
    },

    setCamera(key, stream) {
      mixer?.setCamera(key, stream);
    },

    cut(key) {
      mixer?.cut(key);
    },

    state: () => ({ ...state }),
  };
}
