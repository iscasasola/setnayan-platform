/**
 * S4 · H.264 from the canvas, on the audio clock — pure control logic.
 *
 * Everything here is pure and tested in Node (`video-encode.test.ts`), same split as
 * audio-clock.ts / audio-packer.ts: this file decides WHAT to do, program-canvas.worker.ts
 * (untested — the only place `VideoEncoder`/`VideoFrame`/`OffscreenCanvas` are touched) does it.
 *
 * CONFIG. `hardwareAcceleration` is filled from S0-FINDING.md § 2.2, measured inside the real
 * Tauri webview: `'require-hardware'` is not even a member of the WebCodecs `HardwareAcceleration`
 * enum (https://www.w3.org/TR/webcodecs/ defines only `no-preference` / `prefer-hardware` /
 * `prefer-software`), so WebKit's `TypeError` on it is spec-conformant, not a bug to work around.
 * `'prefer-hardware'` is the only floor-safe value. `avc:{format:'avc'}` (length-prefixed AVCC,
 * not Annex B) is required, not a preference: `src-tauri/crates/encoder/src/contract.rs`'s
 * `ChunkKind::Video` doc is explicit that the wire format is "avcC (length-prefixed) form", and
 * only AVCC carries decoder config out-of-band in `decoderConfig.description` — Annex B has no
 * such side channel. Codec is Constrained Baseline (`avc1.42E01F`) because Windows' OpenH264
 * software fallback (S9's territory) supports nothing higher (README "OS floor").
 *
 * KEYFRAME CADENCE. Every 60 ticks = 2 s at the locked 30 fps (`PROGRAM_FPS` in audio-clock.ts) —
 * YouTube's own GOP target for live ingest.
 *
 * THE DRIFT GUARD. `videoPTS` and `audioPTS` both come off audio-clock.ts's ONE frame counter
 * (see that file's docblock), so in steady state they cannot drift — the only way `|Δ| > 100 ms`
 * happens is a chunk arriving very late (a stalled worker tick, a backpressured encoder). The
 * fix is to DROP that chunk, never to re-timestamp it: the timestamp is the one thing on this
 * pipeline that is never wrong, because it was never computed from wall time in the first place
 * (audio-clock.ts's docblock). Re-stamping a late chunk to "catch up" would be inventing a PTS
 * that S3's whole design exists to avoid needing.
 *
 * THE RING. A bounded, non-blocking store of encoded chunks. "S5 defines the drop policy" (S4
 * prompt) — this ring's drop-oldest-on-overflow is a placeholder so producer and counters exist;
 * S5 owns what actually happens when the IPC consumer falls behind the encoder.
 */

/** Constrained Baseline L3.1 — Windows' OpenH264 SW fallback ceiling (README "OS floor"). */
export const VIDEO_CODEC = 'avc1.42E01F';

export const VIDEO_WIDTH = 1280;
export const VIDEO_HEIGHT = 720;
export const VIDEO_BITRATE = 2_500_000;
export const VIDEO_FRAMERATE = 30;

/** S0-FINDING.md § 2.2 — the only value this WebKit accepts without throwing. */
export const VIDEO_HARDWARE_ACCELERATION = 'prefer-hardware' as const;

/**
 * The `VideoEncoder.configure()` shape. `framerate` and `bitrate` are BOTH always present
 * (Safari 17.4 drops frames silently if `framerate` is omitted — S4 prompt) and `bitrateMode`
 * is `'constant'` (CBR — a live RTMP ingest, not a file export) — both asserted by
 * `video-encode.test.ts` so a later edit that drops either one goes red immediately.
 */
export const VIDEO_ENCODER_CONFIG: VideoEncoderConfig = {
  codec: VIDEO_CODEC,
  width: VIDEO_WIDTH,
  height: VIDEO_HEIGHT,
  bitrate: VIDEO_BITRATE,
  framerate: VIDEO_FRAMERATE,
  bitrateMode: 'constant',
  latencyMode: 'realtime',
  hardwareAcceleration: VIDEO_HARDWARE_ACCELERATION,
  avc: { format: 'avc' },
};

/** YouTube's 2 s GOP at 30 fps. */
export const KEYFRAME_INTERVAL_TICKS = 60;

/** Whether the tick at this (0-based, monotonic) index must be forced to a keyframe. */
export function isKeyframeTick(tickIndex: number): boolean {
  return tickIndex % KEYFRAME_INTERVAL_TICKS === 0;
}

/** The mux-point drift guard's threshold (S4 prompt). */
export const DRIFT_THRESHOLD_MS = 100;

export type DriftEvent = {
  type: 'drift';
  deltaMs: number;
  videoTsMicros: number;
  audioTsMicros: number;
};

/** `null` when in sync; a `DriftEvent` when `|videoTs - audioTs|` exceeds the guard. */
export function checkDrift(videoTsMicros: number, audioTsMicros: number): DriftEvent | null {
  const deltaMs = Math.abs(videoTsMicros - audioTsMicros) / 1000;
  if (deltaMs <= DRIFT_THRESHOLD_MS) return null;
  return { type: 'drift', deltaMs, videoTsMicros, audioTsMicros };
}

/* ── config capture (the AVCDecoderConfigurationRecord) ────────────────────────────────── */

/** The slice of `EncodedVideoChunk` this module needs — real in the worker, synthetic in tests. */
export type VideoChunkLike = {
  type: 'key' | 'delta';
  timestamp: number;
  byteLength: number;
  copyTo(dest: BufferSource): void;
};

export type VideoChunkMetadataLike = {
  /** `AllowSharedBufferSource`, matching the real `EncodedVideoChunkMetadata` DOM type — a
   *  `SharedArrayBuffer` is never actually produced here (nothing in this pipeline shares one),
   *  but the real callback's metadata type allows it, so this one must too. */
  decoderConfig?: { description?: AllowSharedBufferSource };
};

export type RingEntry = {
  keyframe: boolean;
  timestampMicros: number;
  seq: number;
  data: Uint8Array;
};

/** Copies into a fresh, non-shared `ArrayBuffer` — `Uint8Array.prototype.slice()` always
 *  allocates a plain `ArrayBuffer` by spec, even when the source view was over a
 *  `SharedArrayBuffer`, which is what makes the result safe to transfer in `postMessage`. */
function toArrayBuffer(source: AllowSharedBufferSource): ArrayBuffer {
  const view = ArrayBuffer.isView(source)
    ? new Uint8Array(source.buffer, source.byteOffset, source.byteLength)
    : new Uint8Array(source);
  return view.slice().buffer;
}

export type VideoEncodeSink = {
  /**
   * ORDER IS THE CONTRACT: within one call, if this chunk carries the config (only ever the
   * first chunk — WebCodecs emits `decoderConfig` once, on the first output), `onConfig` fires
   * BEFORE `onChunk`. A consumer that ships chunks to the wire the instant `onChunk` fires must
   * never be able to observe media before the config that decodes it — see the "released before
   * config" guard in video-encode.test.ts.
   */
  handle(chunk: VideoChunkLike, metadata: VideoChunkMetadataLike | undefined): void;
  stats(): { chunks: number; keyframes: number; configCaptured: boolean };
};

export function createVideoEncodeSink(callbacks: {
  onConfig: (description: ArrayBuffer) => void;
  onChunk: (entry: RingEntry) => void;
}): VideoEncodeSink {
  let configCaptured = false;
  let seq = 0;
  let chunks = 0;
  let keyframes = 0;
  return {
    handle(chunk, metadata) {
      const description = metadata?.decoderConfig?.description;
      if (!configCaptured && description) {
        configCaptured = true;
        callbacks.onConfig(toArrayBuffer(description));
      }
      const data = new Uint8Array(chunk.byteLength);
      chunk.copyTo(data);
      chunks += 1;
      if (chunk.type === 'key') keyframes += 1;
      callbacks.onChunk({
        keyframe: chunk.type === 'key',
        timestampMicros: chunk.timestamp,
        seq: seq++,
        data,
      });
    },
    stats: () => ({ chunks, keyframes, configCaptured }),
  };
}

/* ── the bounded ring ───────────────────────────────────────────────────────────────────── */

export type ChunkRing = {
  /** Never blocks, never awaits a consumer. Drops the OLDEST entry on overflow (placeholder —
   *  S5 owns the real policy) and counts every drop. */
  push(entry: RingEntry): void;
  drain(): RingEntry[];
  stats(): { size: number; capacity: number; pushed: number; dropped: number };
};

export function createChunkRing(capacity: number): ChunkRing {
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error(`video-encode: ring capacity must be a positive integer, got ${capacity}`);
  }
  const buf: RingEntry[] = [];
  let pushed = 0;
  let dropped = 0;
  return {
    push(entry) {
      pushed += 1;
      if (buf.length >= capacity) {
        buf.shift();
        dropped += 1;
      }
      buf.push(entry);
    },
    drain() {
      return buf.splice(0, buf.length);
    },
    stats: () => ({ size: buf.length, capacity, pushed, dropped }),
  };
}

/* ── drift-guarded ring push ────────────────────────────────────────────────────────────── */

export type DriftGuardedRing = {
  /** Checks `entry` against the last known audio PTS before it ever reaches the ring. */
  push(entry: RingEntry, lastAudioTsMicros: number): void;
  stats(): { driftEvents: number; droppedForDrift: number };
};

export function createDriftGuardedRing(
  ring: Pick<ChunkRing, 'push'>,
  onDrift: (event: DriftEvent) => void,
): DriftGuardedRing {
  let driftEvents = 0;
  let droppedForDrift = 0;
  return {
    push(entry, lastAudioTsMicros) {
      const event = checkDrift(entry.timestampMicros, lastAudioTsMicros);
      if (event) {
        driftEvents += 1;
        droppedForDrift += 1;
        onDrift(event);
        return; // dropped — never re-timestamped, see file docblock
      }
      ring.push(entry);
    },
    stats: () => ({ driftEvents, droppedForDrift }),
  };
}
