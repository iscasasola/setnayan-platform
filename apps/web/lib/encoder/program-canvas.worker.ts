/**
 * S1 · the program canvas worker.
 *
 * Owns a 1280×720 `OffscreenCanvas`, composites the on-air picture onto it on every tick of
 * the AUDIO master clock, encodes the programme audio, and reports stats to the page once a
 * second — a second counted in audio frames, not by a timer. Thin by design:
 * the planner (program-plan.ts), the state machine (program-compositor.ts) and the clock
 * (audio-clock.ts) are all pure and tested in Node; this file is the only place the
 * browser APIs are touched.
 *
 * HOW THE PICTURE GETS HERE. The page holds the `MediaStream` the controller already
 * receives (a WebRTC remote track). Two transports, chosen on the page:
 *   · Chromium — `MediaStreamTrackProcessor` exists on the window; the page builds one over
 *     a CLONE of the track and transfers its `readable` here.
 *   · WebKit — the processor is worker-only (and video-only), so the page transfers the
 *     cloned track itself and this worker builds the processor.
 * Either way the frames arrive as `VideoFrame`s on a `ReadableStream`, and this worker
 * keeps exactly one per slot (the compositor closes the previous). Frames MUST be closed
 * promptly or the track's frame pool stalls — that is why the read loop never buffers.
 *
 * HOW THE SOUND GETS HERE, AND WHY IT DRIVES THE PICTURE (S3). The page's audio graph
 * (`audio-mixer.ts`) hands this worker one end of a `MessageChannel`; the tap running on the
 * audio render thread posts every 128-frame quantum straight down it. Those quanta are the
 * only clock in this file. There is no `setInterval` and no `requestAnimationFrame` here any
 * more — S1 MEASURED what page/worker timers do when the window is minimised (26.0 ticks/s,
 * 635 gaps > 2 ticks in 540 s, worst 8.4 s; see audio-clock.ts for the full numbers), and a
 * live wedding cannot be at the mercy of which window the couple has in front. The audio
 * thread is real-time and visibility does not throttle it.
 *
 * So: quanta in → `audio-packer` fills 1024-frame `AudioData`s and `AudioEncoder` turns them
 * into AAC-LC → `audio-clock` floors the same frame counter into 30 fps slots and each slot
 * composites one picture. Both timelines are stamped from ONE integer, so they cannot drift
 * apart; `maxAvSkewMs` on the stats is that claim, measured rather than asserted.
 *
 * NO DESKTOP-SHELL (TAURI) GATE HERE. The same JS ships to plain browsers; S5 gates the call site.
 *
 * S4: every tick also encodes `canvas` to H.264 (`new VideoFrame(canvas, { timestamp:
 * tick.timestampMicros })`), on the SAME master-clock timestamp the audio side stamps its AAC
 * packets from — see video-encode.ts for the config, the keyframe cadence, the mux-point drift
 * guard, and the bounded ring; this file only wires them to the real `VideoEncoder`.
 */

import { ProgramCompositor, type ProgramPainter, type VideoFrameLike } from './program-compositor';
import {
  AUDIO_QUANTUM_FRAMES,
  AUDIO_SAMPLE_RATE,
  PROGRAM_FPS,
  createAudioMasterClock,
} from './audio-clock';
import { createAudioPacker, type AudioPacket } from './audio-packer';
import { PROGRAM_HEIGHT, PROGRAM_WIDTH, type ProgramFrameWire, type Region, type VideoSlot } from './program-plan';
import type { ProgramAirDecision } from '../live-studio-publish-pure';
import {
  VIDEO_ENCODER_CONFIG,
  isKeyframeTick,
  createVideoEncodeSink,
  createChunkRing,
  createDriftGuardedRing,
  type DriftEvent,
  type RingEntry,
} from './video-encode';

/* ── message contract (page ↔ worker) ─────────────────────────────────────── */

export type ProgramCanvasInbound =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'frame'; frame: ProgramFrameWire }
  | { type: 'air'; air: Pick<ProgramAirDecision, 'enforced' | 'permittedSlots'> | null }
  /** A transferred `MediaStreamTrackProcessor.readable` (Chromium path). Null = slot cleared. */
  | { type: 'track'; slot: VideoSlot; readable: ReadableStream<VideoFrame> | null }
  /** A transferred cloned `MediaStreamTrack` (WebKit path — the worker wraps it). */
  | { type: 'track'; slot: VideoSlot; track: MediaStreamTrack }
  /**
   * The worker's end of the channel the audio tap posts quanta down. Until this arrives the
   * worker has no clock at all and composites nothing — deliberately: a picture stamped on a
   * timeline that does not exist yet is worse than no picture.
   */
  | { type: 'audio-link'; port: MessagePort };

export type ProgramCanvasStats = {
  /** Compositor ticks — advances every 33.3 ms whether or not a fresh frame arrived. */
  frameCount: number;
  /** Ticks that re-drew the last composite because no new VideoFrame had arrived. */
  repeatedCount: number;
  /** Worst inter-tick gap seen so far, in whole ticks, and when (ms since start) it ended. */
  maxGapTicks: number;
  maxGapMs: number;
  maxGapAtMs: number;
  /** Inter-tick gaps wider than two ticks, counted. The evidence threshold: 0 outside warm-up. */
  longGaps: number;
  elapsedMs: number;
  /* ── S3: the audio half, and the drift the two halves are held to ──────── */
  /** Render quanta received from the tap. Zero means the audio graph never reached us. */
  audioQuanta: number;
  /** 1024-frame `AudioData`s handed to `AudioEncoder`. */
  audioPackets: number;
  /** AAC-LC chunks the encoder gave back. */
  audioChunks: number;
  /** Media time in ms as the audio clock reckons it — `frames / 48`. */
  audioMs: number;
  /**
   * Worst |videoPTS − audioPTS| in ms since start. Bounded by construction at just under one
   * AAC frame (21.3 ms) because both come from the same counter; the S3 evidence bar is 40 ms.
   */
  maxAvSkewMs: number;
  /**
   * Worst |wall clock − audio clock| in ms. NOT a failure on its own — it is the number that
   * says how far a timer-driven encoder would have wandered, i.e. why this clock exists.
   */
  maxWallDriftMs: number;
  /** True once `decoderConfig.description` (the AudioSpecificConfig) has been captured. */
  ascReady: boolean;
  /* ── S4: the video half ─────────────────────────────────────────────────── */
  /** Encoded H.264 access units handed back by `VideoEncoder`. */
  videoChunks: number;
  /** Of `videoChunks`, how many were forced keyframes (should be `⌈videoChunks / 60⌉`). */
  videoKeyframes: number;
  /** True once `decoderConfig.description` (the AVCDecoderConfigurationRecord) has been captured. */
  avccReady: boolean;
  /** Mux-point drift events (`|videoTs − audioTs| > 100ms`) — the evidence bar is 0. */
  videoDriftEvents: number;
  /** Video chunks the drift guard dropped (never re-timestamped) instead of ringing. */
  videoDriftDrops: number;
  /** Ring entries dropped for being unconsumed, not for drift — S5's backpressure, not S4's. */
  videoRingDrops: number;
  /** Bytes of H.264 payload encoded so far — `videoAvgKbps` below is derived from this. */
  videoBytes: number;
  /** `videoBytes × 8 / elapsedMs` — the evidence bar is the 2.5 Mbps target ±10%. */
  videoAvgKbps: number;
};

export type ProgramCanvasOutbound =
  | { type: 'ready' }
  | { type: 'stats'; stats: ProgramCanvasStats }
  /**
   * The AudioSpecificConfig from the first encoded chunk's `decoderConfig.description`.
   * S4/S5 ship it to Rust as the `asc` half of `ChunkKind::Config` (see
   * `src-tauri/crates/encoder/src/contract.rs`); it is emitted once, before any media.
   */
  | { type: 'audio-config'; description: ArrayBuffer; sampleRate: number; numberOfChannels: number }
  /**
   * The AVCDecoderConfigurationRecord from the first encoded video chunk's
   * `decoderConfig.description` — the `avcC` half of `ChunkKind::Config`. Emitted once, before
   * any media, and S5 must re-ship both configs on every reconnect (S4 prompt) since Rust's
   * FLV/RTMP muxer cannot decode a keyframe without them.
   */
  | { type: 'video-config'; description: ArrayBuffer; codec: string; width: number; height: number }
  | { type: 'drift'; event: DriftEvent }
  | { type: 'error'; where: string; message: string };

/** How often stats go back to the page, counted in TICKS — 30 ticks is one second of media. */
export const STATS_INTERVAL_TICKS = PROGRAM_FPS;

/** Programme audio is always stereo, whatever a phone publishes — see audio-tap.worklet.ts. */
export const AUDIO_CHANNELS = 2;

/* ── worker globals, typed narrowly (tsconfig lib is DOM, not WebWorker) ───── */

type WorkerScope = {
  postMessage: (message: ProgramCanvasOutbound, transfer?: Transferable[]) => void;
  addEventListener: (type: 'message', fn: (ev: MessageEvent<ProgramCanvasInbound>) => void) => void;
};

type TrackProcessorCtor = new (init: { track: MediaStreamTrack }) => {
  readable: ReadableStream<VideoFrame>;
};

const scope = self as unknown as WorkerScope;

/* ── the painter: OffscreenCanvas 2D ───────────────────────────────────────── */

const CARD_FONT = '500 22px system-ui, -apple-system, "Segoe UI", sans-serif';
const CARD_KICKER_FONT = '700 15px ui-monospace, Menlo, monospace';
const NOTICE_FONT = '500 15px system-ui, -apple-system, "Segoe UI", sans-serif';

function makePainter(ctx: OffscreenCanvasRenderingContext2D): ProgramPainter {
  return {
    clear() {
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, PROGRAM_WIDTH, PROGRAM_HEIGHT);
    },
    drawVideo(frame: VideoFrameLike, dest: Region) {
      // A real VideoFrame is a CanvasImageSource; the compositor's narrow type is for tests.
      ctx.drawImage(frame as unknown as CanvasImageSource, dest.x, dest.y, dest.w, dest.h);
    },
    drawDivider(x, width) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x, 0, width, PROGRAM_HEIGHT);
    },
    drawCard(card, lines) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (card === 'no-signal') {
        // The pop-out: uppercase, letter-spaced, white/40.
        ctx.font = CARD_FONT;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillText((lines[0] ?? '').toUpperCase(), PROGRAM_WIDTH / 2, PROGRAM_HEIGHT / 2);
        return;
      }
      // withheld-source: kicker · title · body · hint, stacked like the DOM card.
      const [kicker = '', title = '', body = '', hint = ''] = lines;
      const cx = PROGRAM_WIDTH / 2;
      let y = PROGRAM_HEIGHT / 2 - 80;
      ctx.font = CARD_KICKER_FONT;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(kicker.toUpperCase(), cx, y);
      y += 40;
      ctx.font = '600 28px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = '#fff';
      ctx.fillText(title, cx, y);
      y += 44;
      ctx.font = '400 18px system-ui, -apple-system, "Segoe UI", sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (const line of wrap(ctx, body, 720)) {
        ctx.fillText(line, cx, y);
        y += 26;
      }
      y += 12;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      for (const line of wrap(ctx, hint, 720)) {
        ctx.fillText(line, cx, y);
        y += 26;
      }
    },
    drawNotice(text) {
      // Bottom-left, small, on the picture — the pop-out's PinnedChannelNotice placement.
      ctx.font = NOTICE_FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(text.toUpperCase(), 24, PROGRAM_HEIGHT - 20);
    },
  };
}

function wrap(ctx: OffscreenCanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/* ── wiring ────────────────────────────────────────────────────────────────── */

const canvas = new OffscreenCanvas(PROGRAM_WIDTH, PROGRAM_HEIGHT);
const ctx = canvas.getContext('2d', { alpha: false });
if (!ctx) throw new Error('program-canvas.worker: no 2d context');

const compositor = new ProgramCompositor(makePainter(ctx));

/* ── the audio half: encoder, packer, and the clock they share ─────────────── */

let startedAt = 0;
let running = false;
let audioPort: MessagePort | null = null;
/** `currentFrame` of the first quantum we saw; everything downstream counts from it. */
let originFrame: number | null = null;
let framesRendered = 0;
let audioQuanta = 0;
let audioChunks = 0;
let lastAudioPtsMicros = 0;
let maxAvSkewMs = 0;
let maxWallDriftMs = 0;
let ascReady = false;
let ticksSinceStats = 0;

let encoder: AudioEncoder | null = null;

/* ── S4: the video half ──────────────────────────────────────────────────── */

let videoTickIndex = 0;
let videoBytes = 0;
let avccReady = false;
let videoDriftEvents = 0;
let videoDriftDrops = 0;

/**
 * The bounded ring (S5's consumer drains it) and, in front of it, the mux-point drift guard:
 * a video chunk stamped too far from the last known audio PTS is dropped rather than shipped
 * with a fabricated timestamp — see video-encode.ts's docblock for why re-stamping is wrong.
 */
let videoRing = createChunkRing(180); // 6s at 30fps of headroom before S5's consumer must run
let driftGuardedRing = createDriftGuardedRing(videoRing, (event) => {
  videoDriftEvents += 1;
  videoDriftDrops += 1;
  scope.postMessage({ type: 'drift', event });
});
let videoSink = createVideoEncodeSink({
  onConfig: (description) => {
    avccReady = true;
    scope.postMessage(
      {
        type: 'video-config',
        description,
        codec: VIDEO_ENCODER_CONFIG.codec,
        width: VIDEO_ENCODER_CONFIG.width,
        height: VIDEO_ENCODER_CONFIG.height,
      },
      [description],
    );
  },
  onChunk: (entry: RingEntry) => {
    videoBytes += entry.data.byteLength;
    driftGuardedRing.push(entry, lastAudioPtsMicros);
  },
});

let videoEncoder: VideoEncoder | null = null;

function startVideoEncoder(): void {
  if (videoEncoder || typeof VideoEncoder === 'undefined') return;
  const enc = new VideoEncoder({
    output: (chunk, metadata) => videoSink.handle(chunk, metadata),
    error: (err: DOMException) => {
      scope.postMessage({ type: 'error', where: 'video-encoder', message: err.message });
    },
  });
  enc.configure(VIDEO_ENCODER_CONFIG);
  videoEncoder = enc;
}

function startEncoder(): void {
  if (encoder || typeof AudioEncoder === 'undefined') return;
  const enc = new AudioEncoder({
    output: (chunk, metadata) => {
      audioChunks += 1;
      // The AudioSpecificConfig arrives once, on (or near) the first chunk. Rule 8: read the
      // live object — this is the ONLY place the real ASC exists, and Rust cannot mux without it.
      const description = metadata?.decoderConfig?.description;
      if (!ascReady && description) {
        const bytes = ArrayBuffer.isView(description)
          ? (description.buffer as ArrayBuffer).slice(
              description.byteOffset,
              description.byteOffset + description.byteLength,
            )
          : (description as ArrayBuffer).slice(0);
        ascReady = true;
        scope.postMessage(
          {
            type: 'audio-config',
            description: bytes,
            sampleRate: AUDIO_SAMPLE_RATE,
            numberOfChannels: AUDIO_CHANNELS,
          },
          [bytes],
        );
      }
      // S4/S5: hand `chunk` to the IPC sender here. S3 stops at "it encoded".
    },
    error: (err: DOMException) => {
      scope.postMessage({ type: 'error', where: 'audio-encoder', message: err.message });
    },
  });
  enc.configure({
    codec: 'mp4a.40.2',
    sampleRate: AUDIO_SAMPLE_RATE,
    numberOfChannels: AUDIO_CHANNELS,
    bitrate: 128_000,
  });
  encoder = enc;
}

function makePacker() {
  return createAudioPacker((packet: AudioPacket) => {
    lastAudioPtsMicros = packet.timestampMicros;
    if (typeof AudioData === 'undefined' || !encoder) return;
    const data = new AudioData({
      format: 'f32-planar',
      sampleRate: AUDIO_SAMPLE_RATE,
      numberOfFrames: packet.numberOfFrames,
      numberOfChannels: packet.numberOfChannels,
      timestamp: packet.timestampMicros,
      data: packet.data,
    });
    try {
      encoder.encode(data);
    } finally {
      // `encode()` does not take ownership; an AudioData left open holds its buffer for the
      // life of the stream, and there are 47 of them a second.
      data.close();
    }
  });
}

// THE MASTER CLOCK. Not a timer — see the file docblock and audio-clock.ts.
function makeClock() {
  return createAudioMasterClock((tick) => {
    compositor.tick();
    // S4: one encode per tick, stamped from the SAME counter the audio side stamps from —
    // this is the whole reason videoPTS and audioPTS cannot drift apart in steady state.
    if (videoEncoder) {
      const frame = new VideoFrame(canvas, { timestamp: tick.timestampMicros });
      try {
        videoEncoder.encode(frame, { keyFrame: isKeyframeTick(videoTickIndex) });
      } finally {
        frame.close();
      }
      videoTickIndex += 1;
    }
    const skewMs = Math.abs(tick.timestampMicros - lastAudioPtsMicros) / 1000;
    if (skewMs > maxAvSkewMs) maxAvSkewMs = skewMs;
    const driftMs = Math.abs(
      performance.now() - startedAt - (framesRendered * 1000) / AUDIO_SAMPLE_RATE,
    );
    if (driftMs > maxWallDriftMs) maxWallDriftMs = driftMs;
    ticksSinceStats += 1;
    if (ticksSinceStats >= STATS_INTERVAL_TICKS) {
      ticksSinceStats = 0;
      postStats();
    }
  });
}

let packer = makePacker();
let clock = makeClock();

/**
 * Rebuild the audio pipeline. `createProgramCanvas` terminates the worker on stop and builds a
 * new one on start, so a second `start` on the SAME worker cannot happen through its public
 * API — but the clock and the packer both carry monotonic counters, and a reused worker with a
 * stale `lastSlot` would sit silent until the new context caught up to the old one's frame
 * count. Rebuilding costs two allocations and removes the trap.
 */
function resetAudio(): void {
  originFrame = null;
  framesRendered = 0;
  audioQuanta = 0;
  audioChunks = 0;
  lastAudioPtsMicros = 0;
  maxAvSkewMs = 0;
  maxWallDriftMs = 0;
  ascReady = false;
  ticksSinceStats = 0;
  packer = makePacker();
  clock = makeClock();
  videoTickIndex = 0;
  videoBytes = 0;
  avccReady = false;
  videoDriftEvents = 0;
  videoDriftDrops = 0;
  videoRing = createChunkRing(180);
  driftGuardedRing = createDriftGuardedRing(videoRing, (event) => {
    videoDriftEvents += 1;
    videoDriftDrops += 1;
    scope.postMessage({ type: 'drift', event });
  });
  videoSink = createVideoEncodeSink({
    onConfig: (description) => {
      avccReady = true;
      scope.postMessage(
        {
          type: 'video-config',
          description,
          codec: VIDEO_ENCODER_CONFIG.codec,
          width: VIDEO_ENCODER_CONFIG.width,
          height: VIDEO_ENCODER_CONFIG.height,
        },
        [description],
      );
    },
    onChunk: (entry: RingEntry) => {
      videoBytes += entry.data.byteLength;
      driftGuardedRing.push(entry, lastAudioPtsMicros);
    },
  });
}

/** One quantum off the audio thread: pack it, then advance the clock it defines. */
function onQuantum(currentFrame: number, frames: Float32Array): void {
  if (!running) return;
  if (originFrame === null) originFrame = currentFrame;
  audioQuanta += 1;
  // `currentFrame` is the index of the quantum's FIRST sample, so the count of frames the
  // context has rendered once this quantum is done is one whole quantum past it.
  framesRendered = currentFrame - originFrame + AUDIO_QUANTUM_FRAMES;
  packer.push(frames);
  clock.advance(framesRendered);
}

function linkAudio(port: MessagePort): void {
  audioPort?.close();
  audioPort = port;
  port.onmessage = (ev: MessageEvent<{ type: string; currentFrame: number; frames: Float32Array }>) => {
    if (ev.data?.type === 'quantum') onQuantum(ev.data.currentFrame, ev.data.frames);
  };
  port.start();
}

/** One reader per slot; replacing a track cancels the old reader first. */
const readers: Record<VideoSlot, { cancel: () => void } | null> = { primary: null, secondary: null };

function attachReadable(slot: VideoSlot, readable: ReadableStream<VideoFrame>): void {
  detachSlot(slot);
  const reader = readable.getReader();
  let cancelled = false;
  readers[slot] = {
    cancel: () => {
      cancelled = true;
      void reader.cancel().catch(() => {});
    },
  };
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done || cancelled) {
          if (value) value.close();
          break;
        }
        // Hand the frame straight to the compositor; it closes the one it replaces.
        compositor.pushVideoFrame(slot, value);
      }
    } catch (err) {
      if (!cancelled) {
        scope.postMessage({
          type: 'error',
          where: `read:${slot}`,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    }
  })();
}

function detachSlot(slot: VideoSlot): void {
  readers[slot]?.cancel();
  readers[slot] = null;
  compositor.resetSlot(slot);
}

function attachTrack(slot: VideoSlot, track: MediaStreamTrack): void {
  const Ctor = (globalThis as unknown as { MediaStreamTrackProcessor?: TrackProcessorCtor })
    .MediaStreamTrackProcessor;
  if (!Ctor) {
    scope.postMessage({
      type: 'error',
      where: `track:${slot}`,
      message: 'MediaStreamTrackProcessor is unavailable in this worker',
    });
    return;
  }
  attachReadable(slot, new Ctor({ track }).readable);
}

function postStats(): void {
  const c = compositor.stats();
  const k = clock.stats();
  const a = packer.stats();
  const v = videoSink.stats();
  const elapsedMs = performance.now() - startedAt;
  scope.postMessage({
    type: 'stats',
    stats: {
      frameCount: c.frameCount,
      repeatedCount: c.repeatedCount,
      maxGapTicks: k.maxGapTicks,
      maxGapMs: k.maxGapMs,
      maxGapAtMs: k.maxGapAtMs,
      longGaps: k.longGaps,
      elapsedMs,
      audioQuanta,
      audioPackets: a.packets,
      audioChunks,
      audioMs: k.mediaMs,
      maxAvSkewMs,
      maxWallDriftMs,
      ascReady,
      videoChunks: v.chunks,
      videoKeyframes: v.keyframes,
      avccReady,
      videoDriftEvents,
      videoDriftDrops,
      videoRingDrops: videoRing.stats().dropped,
      videoBytes,
      videoAvgKbps: elapsedMs > 0 ? (videoBytes * 8) / elapsedMs : 0,
    },
  });
}

scope.addEventListener('message', (ev) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'start':
      startedAt = performance.now();
      running = true;
      resetAudio();
      startEncoder();
      startVideoEncoder();
      // No timer is started here. The first quantum off the audio thread starts the clock.
      return;
    case 'stop':
      running = false;
      audioPort?.close();
      audioPort = null;
      // Flush THEN close: closing an encoder mid-flush drops the tail of the audio/video.
      const closing = encoder;
      encoder = null;
      void closing
        ?.flush()
        .catch(() => {})
        .finally(() => closing.close());
      const closingVideo = videoEncoder;
      videoEncoder = null;
      void closingVideo
        ?.flush()
        .catch(() => {})
        .finally(() => closingVideo.close());
      detachSlot('primary');
      detachSlot('secondary');
      compositor.dispose();
      return;
    case 'frame':
      compositor.setFrame(msg.frame);
      return;
    case 'air':
      compositor.setAir(msg.air);
      return;
    case 'track':
      if ('track' in msg) attachTrack(msg.slot, msg.track);
      else if (msg.readable) attachReadable(msg.slot, msg.readable);
      else detachSlot(msg.slot);
      return;
    case 'audio-link':
      linkAudio(msg.port);
      return;
  }
});

scope.postMessage({ type: 'ready' });
