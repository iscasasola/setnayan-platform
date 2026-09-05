/**
 * S1 · the program canvas worker.
 *
 * Owns a 1280×720 `OffscreenCanvas`, composites the on-air picture onto it on every tick of
 * the program clock, and reports frame stats to the page once a second. Thin by design:
 * the planner (program-plan.ts), the state machine (program-compositor.ts) and the clock
 * (program-clock.ts) are all pure and tested in Node; this file is the only place the
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
 * NO DESKTOP-SHELL (TAURI) GATE HERE. The same JS ships to plain browsers; S5 gates the call site.
 *
 * // S4: encode from `canvas` here on each tick (new VideoFrame(canvas, { timestamp })).
 */

import { ProgramCompositor, type ProgramPainter, type VideoFrameLike } from './program-compositor';
import { createProgramClock, PROGRAM_TICK_MS } from './program-clock';
import { PROGRAM_HEIGHT, PROGRAM_WIDTH, type ProgramFrameWire, type Region, type VideoSlot } from './program-plan';
import type { ProgramAirDecision } from '../live-studio-publish-pure';

/* ── message contract (page ↔ worker) ─────────────────────────────────────── */

export type ProgramCanvasInbound =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'frame'; frame: ProgramFrameWire }
  | { type: 'air'; air: Pick<ProgramAirDecision, 'enforced' | 'permittedSlots'> | null }
  /** A transferred `MediaStreamTrackProcessor.readable` (Chromium path). Null = slot cleared. */
  | { type: 'track'; slot: VideoSlot; readable: ReadableStream<VideoFrame> | null }
  /** A transferred cloned `MediaStreamTrack` (WebKit path — the worker wraps it). */
  | { type: 'track'; slot: VideoSlot; track: MediaStreamTrack };

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
};

export type ProgramCanvasOutbound =
  | { type: 'ready' }
  | { type: 'stats'; stats: ProgramCanvasStats }
  | { type: 'error'; where: string; message: string };

/** How often stats go back to the page. */
export const STATS_INTERVAL_MS = 1000;

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

// The draw loop: a worker timer at 33.3 ms for now (see program-clock.ts).
// S3 replaces this tick with the AudioContext-derived clock
const clock = createProgramClock(
  () => {
    compositor.tick();
    // S4: encode from `canvas` here.
  },
  {
    now: () => performance.now(),
    schedule: (fn, delay) => setTimeout(fn, delay),
    cancel: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  },
  PROGRAM_TICK_MS,
);

let startedAt = 0;
let statsTimer: ReturnType<typeof setInterval> | null = null;

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
  scope.postMessage({
    type: 'stats',
    stats: {
      frameCount: c.frameCount,
      repeatedCount: c.repeatedCount,
      maxGapTicks: k.maxGapTicks,
      maxGapMs: k.maxGapMs,
      maxGapAtMs: k.maxGapAtMs,
      longGaps: k.longGaps,
      elapsedMs: performance.now() - startedAt,
    },
  });
}

scope.addEventListener('message', (ev) => {
  const msg = ev.data;
  switch (msg.type) {
    case 'start':
      startedAt = performance.now();
      clock.start();
      if (statsTimer === null) statsTimer = setInterval(postStats, STATS_INTERVAL_MS);
      return;
    case 'stop':
      clock.stop();
      if (statsTimer !== null) clearInterval(statsTimer);
      statsTimer = null;
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
  }
});

scope.postMessage({ type: 'ready' });
