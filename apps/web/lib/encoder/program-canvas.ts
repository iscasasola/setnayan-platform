/**
 * S1 · the program canvas — page side.
 *
 * Subscribes to the program bridge ON THIS WINDOW (the controller page installs it; the
 * canvas runs beside the controller, not in a pop-out), forwards every `ProgramFrame` and
 * every track change to `program-canvas.worker.ts`, and surfaces the worker's frame stats.
 *
 * It re-resolves the bridge on the same 2 s cadence the pop-out uses, for the same reason:
 * a remounted controller installs a NEW bridge object over the same key, and a canvas
 * latched to the old one would hold a still photograph with no error state.
 *
 * Plain browser code — no desktop-shell (Tauri) gate here. S5 gates the call site.
 *
 * Every browser touch-point is injectable (`deps`) so the whole page-side contract runs in
 * Node against a fake worker and a fake bridge.
 */

import {
  resolveLocalProgramBridge,
  type ProgramBridge,
  type ProgramFrame,
} from '../panood-program-bridge';
import type { ProgramAirDecision } from '../live-studio-publish-pure';
import type { ResolvedOverlays } from '../live-studio-overlays';
import { toWireFrame, type VideoSlot } from './program-plan';
import type { ProgramCanvasInbound, ProgramCanvasOutbound, ProgramCanvasStats } from './program-canvas.worker';

export type { ProgramCanvasStats } from './program-canvas.worker';

/** The slice of `Worker` the controller uses; a test passes a recorder. */
export type ProgramWorkerLike = {
  postMessage: (message: ProgramCanvasInbound, transfer?: Transferable[]) => void;
  addEventListener: (type: 'message', fn: (ev: { data: ProgramCanvasOutbound }) => void) => void;
  terminate: () => void;
};

/** `MediaStreamTrackProcessor` as the page sees it (not in TS's lib.dom yet). */
type TrackProcessorCtor = new (init: { track: MediaStreamTrack }) => {
  readable: ReadableStream<VideoFrame>;
};

export type ProgramCanvasDeps = {
  createWorker: () => ProgramWorkerLike;
  resolveBridge: () => ProgramBridge | null;
  /** Chromium exposes the processor on the page; WebKit only inside workers. */
  trackProcessor: TrackProcessorCtor | null;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
};

export type ProgramCanvasOptions = {
  /** Server-resolved program-output entitlement, as the controller page already holds it. */
  air?: Pick<ProgramAirDecision, 'enforced' | 'permittedSlots'> | null;
  /**
   * S2 · the ₱0 broadcast extras, as the controller page already holds them
   * (`airOverlays` — `resolveOverlays({ owned, ... })`). Passed once, exactly like
   * `air` above: this page never re-derives `owned` and never calls `resolveOverlays`
   * itself, it only forwards the already-resolved decision to the worker.
   */
  overlays?: {
    resolved: ResolvedOverlays | null;
    /** The same-origin QR route the page already builds (`/api/website/qr/<slug>`),
     *  or null for a slug-less event. Resolved to an ABSOLUTE url before crossing
     *  into the worker — a relative fetch there would resolve against the WORKER's
     *  own script URL, not this page's. */
    qrSrc: string | null;
    /** The couple's monogram text — the DOM's `lowerThirdFallback` prop, unchanged. */
    lowerThirdFallback: string;
  } | null;
  deps?: Partial<ProgramCanvasDeps>;
};

/** Pure so it is directly testable without a `location` global (Node has none). */
export function resolveQrUrl(qrSrc: string | null): string | null {
  if (!qrSrc) return null;
  if (typeof location === 'undefined') return qrSrc;
  try {
    return new URL(qrSrc, location.href).href;
  } catch {
    return qrSrc;
  }
}

export type ProgramCanvas = {
  start(): void;
  stop(): void;
  /** Called about once a second with the worker's counters while running. */
  onFrameCount(fn: (stats: ProgramCanvasStats) => void): () => void;
  onError(fn: (where: string, message: string) => void): () => void;
};

/** Which way a track crosses into the worker. Pure, so the choice is testable. */
export function chooseTrackTransport(hasPageProcessor: boolean): 'readable' | 'track' {
  return hasPageProcessor ? 'readable' : 'track';
}

/** The pop-out's cadence for noticing a remounted controller. */
export const BRIDGE_REPOLL_MS = 2_000;

function browserDeps(): ProgramCanvasDeps {
  return {
    createWorker: () =>
      new Worker(new URL('./program-canvas.worker.ts', import.meta.url)) as unknown as ProgramWorkerLike,
    resolveBridge: () => {
      const r = resolveLocalProgramBridge();
      return typeof r === 'string' ? null : r;
    },
    trackProcessor:
      (globalThis as unknown as { MediaStreamTrackProcessor?: TrackProcessorCtor })
        .MediaStreamTrackProcessor ?? null,
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  };
}

export function createProgramCanvas(options: ProgramCanvasOptions = {}): ProgramCanvas {
  const deps: ProgramCanvasDeps = { ...browserDeps(), ...options.deps };
  const statsListeners = new Set<(s: ProgramCanvasStats) => void>();
  const errorListeners = new Set<(where: string, message: string) => void>();

  let worker: ProgramWorkerLike | null = null;
  let bound: ProgramBridge | null = null;
  let unsubscribe: (() => void) | null = null;
  let repoll: unknown = null;
  /** Identity of the stream last sent per slot, so an unchanged stream is never re-sent. */
  const sent: Record<VideoSlot, MediaStream | null> = { primary: null, secondary: null };
  /** Our clones of the on-air tracks; stopped when replaced so the pool is released. */
  const clones: Record<VideoSlot, MediaStreamTrack | null> = { primary: null, secondary: null };

  function post(message: ProgramCanvasInbound, transfer?: Transferable[]): void {
    worker?.postMessage(message, transfer);
  }

  function sendTrack(slot: VideoSlot, stream: MediaStream | null): void {
    clones[slot]?.stop();
    clones[slot] = null;
    const track = stream?.getVideoTracks()[0] ?? null;
    if (!track) {
      post({ type: 'track', slot, readable: null });
      return;
    }
    // Always a CLONE: the original keeps feeding the controller's monitor, and on the
    // WebKit path a transferred track is detached from this thread entirely.
    const clone = track.clone();
    clones[slot] = clone;
    if (chooseTrackTransport(deps.trackProcessor !== null) === 'readable') {
      const readable = new deps.trackProcessor!({ track: clone }).readable;
      post({ type: 'track', slot, readable }, [readable as unknown as Transferable]);
    } else {
      post({ type: 'track', slot, track: clone }, [clone as unknown as Transferable]);
    }
  }

  function forward(frame: ProgramFrame): void {
    post({ type: 'frame', frame: toWireFrame(frame) });
    if (frame.stream !== sent.primary) {
      sent.primary = frame.stream;
      sendTrack('primary', frame.stream);
    }
    if (frame.secondaryStream !== sent.secondary) {
      sent.secondary = frame.secondaryStream;
      sendTrack('secondary', frame.secondaryStream);
    }
  }

  function attach(bridge: ProgramBridge): void {
    unsubscribe?.();
    bound = bridge;
    forward(bridge.get());
    unsubscribe = bridge.subscribe(forward);
  }

  function poll(): void {
    const resolved = deps.resolveBridge();
    if (!resolved) {
      // Controller mid-remount. Keep the worker ticking on the last frame; reattach later.
      if (bound) {
        unsubscribe?.();
        unsubscribe = null;
        bound = null;
      }
      return;
    }
    if (resolved !== bound) attach(resolved);
  }

  return {
    start() {
      if (worker) return;
      worker = deps.createWorker();
      worker.addEventListener('message', (ev) => {
        const msg = ev.data;
        if (msg.type === 'stats') for (const fn of statsListeners) fn(msg.stats);
        else if (msg.type === 'error') for (const fn of errorListeners) fn(msg.where, msg.message);
      });
      post({ type: 'air', air: options.air ?? null });
      post({
        type: 'overlays',
        overlays: options.overlays?.resolved ?? null,
        qrSrc: resolveQrUrl(options.overlays?.qrSrc ?? null),
        lowerThirdFallback: options.overlays?.lowerThirdFallback ?? '',
      });
      post({ type: 'start' });
      poll();
      repoll = deps.setInterval(poll, BRIDGE_REPOLL_MS);
    },
    stop() {
      if (repoll !== null) deps.clearInterval(repoll);
      repoll = null;
      unsubscribe?.();
      unsubscribe = null;
      bound = null;
      for (const slot of ['primary', 'secondary'] as const) {
        clones[slot]?.stop();
        clones[slot] = null;
        sent[slot] = null;
      }
      post({ type: 'stop' });
      worker?.terminate();
      worker = null;
    },
    onFrameCount(fn) {
      statsListeners.add(fn);
      return () => statsListeners.delete(fn);
    },
    onError(fn) {
      errorListeners.add(fn);
      return () => errorListeners.delete(fn);
    },
  };
}
