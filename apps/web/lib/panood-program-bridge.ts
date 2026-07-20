/**
 * Same-origin window bridge that lets the chrome-less "Program output" pop-out
 * render the control room's PROGRAM composite for OBS to window-capture.
 *
 * WHY A BRIDGE AND NOT A SECOND CONNECTION — this is the load-bearing constraint
 * (Live_Studio_Repackaging_2026-07-08 § 10, PR #4 note). The WebRTC transport in
 * `lib/panood-webrtc.ts` is ONE PUBLISHER → ONE VIEWER per camera slot: each
 * operator phone offers to whoever answers. If the pop-out opened its own
 * `watchPanoodCameras`, its answer would replace the control room's peer and it
 * would STEAL the phone's stream — the operator's own monitor would go black
 * mid-ceremony. So the pop-out must never touch signaling. It reaches through
 * `window.opener` and re-renders the MediaStream objects the parent already holds.
 *
 * MediaStream instances pass across same-origin windows by reference (no clone,
 * no re-negotiation) — assigning one to a `<video>` in the child plays the exact
 * same live track the parent is receiving. That is the whole trick.
 *
 * Direction of travel is one-way: parent publishes, pop-out subscribes. The
 * pop-out is a dumb surface with no controls — the operator keeps switching in
 * the main window while OBS captures the child.
 */

/** What the pop-out needs to paint a frame. Mirrors the parent's PROGRAM monitor. */
import type { WatermarkReason } from './panood-watermark';

export type ProgramFrame = {
  /** On-air source key (`cam{n}` or a wall key), or null when nothing is cut up. */
  source: string | null;
  /** Human label for the on-air source — shown only in the no-signal state. */
  label: string;
  /** Control-plane live flag. The pop-out shows NO on-air chrome (it's a capture surface). */
  live: boolean;
  /** The on-air camera's live stream, or null for a wall/placeholder source. */
  stream: MediaStream | null;
  /**
   * Split-cam second source (PR #5). When set, the pop-out composites
   * `stream` | `secondaryStream` side by side at `splitRatio`.
   */
  secondaryStream: MediaStream | null;
  /** 0..1 — fraction of width given to the PRIMARY stream. 0.5 = even split. */
  splitRatio: number;
  /**
   * Draw the full-screen SETNAYAN overlay? Decided SERVER-side by `decideWatermark` and pushed
   * down here, so the console and the OBS pop-out can never disagree about whether the paywall
   * is up. The pop-out must not re-derive this — it has no entitlement context and would be the
   * easiest surface to leave uncovered.
   */
  overlay: boolean;
  /** Why the overlay is (or is not) on — drives the pop-out's sub-line. */
  overlayReason: WatermarkReason;
};

export type ProgramBridge = {
  get: () => ProgramFrame;
  subscribe: (fn: (frame: ProgramFrame) => void) => () => void;
};

/** Property name on `window`. Prefixed + versioned so a stale pop-out can't half-bind. */
const BRIDGE_KEY = '__setnayanPanoodProgramV1' as const;

type BridgeHost = Window & { [BRIDGE_KEY]?: ProgramBridge };

export const EMPTY_FRAME: ProgramFrame = {
  source: null,
  label: 'Nothing on program yet',
  live: false,
  stream: null,
  secondaryStream: null,
  splitRatio: 0.5,
  // Fail closed: a pop-out that has not yet heard from the console shows the paywall.
  overlay: true,
  overlayReason: 'unpaid',
};

/**
 * Parent (control room) side: install the bridge on this window and return a
 * setter to push new frames. Call the returned `dispose` on unmount so a
 * re-mounted control room never leaves a dead bridge behind.
 */
export function installProgramBridge(initial: ProgramFrame = EMPTY_FRAME): {
  publish: (frame: ProgramFrame) => void;
  dispose: () => void;
} {
  if (typeof window === 'undefined') {
    return { publish: () => {}, dispose: () => {} };
  }
  const host = window as BridgeHost;
  let frame = initial;
  const listeners = new Set<(f: ProgramFrame) => void>();

  host[BRIDGE_KEY] = {
    get: () => frame,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };

  return {
    publish: (next: ProgramFrame) => {
      frame = next;
      // A throwing listener (a pop-out mid-teardown) must not stop the others.
      for (const fn of listeners) {
        try {
          fn(next);
        } catch {
          /* ignore — the pop-out will resync on its next get() */
        }
      }
    },
    dispose: () => {
      listeners.clear();
      delete host[BRIDGE_KEY];
    },
  };
}

/** Why the pop-out can't render, in a form the UI can explain to a human. */
export type BridgeFailure =
  | 'no-opener' // opened directly / bookmarked — there is no control room behind it
  | 'opener-closed' // the control room tab was closed
  | 'no-bridge'; // opener exists but isn't a control room (or hasn't mounted yet)

/**
 * Pop-out side: resolve the parent's bridge. Returns a failure reason instead of
 * throwing, because every one of these is a real thing an operator can do by
 * accident (bookmark the pop-out, close the console tab) and each needs its own
 * on-screen instruction rather than a blank black window that OBS would happily
 * broadcast.
 */
export function resolveProgramBridge(): ProgramBridge | BridgeFailure {
  if (typeof window === 'undefined') return 'no-opener';
  const opener = window.opener as BridgeHost | null;
  if (!opener) return 'no-opener';
  try {
    if (opener.closed) return 'opener-closed';
    const bridge = opener[BRIDGE_KEY];
    return bridge ?? 'no-bridge';
  } catch {
    // Cross-origin opener — can't happen for our own pop-out, but never throw.
    return 'no-bridge';
  }
}

/* -------------------------------------------------------------------------- */
/*  Split-cam ratio math (PR #5)                                              */
/* -------------------------------------------------------------------------- */

/**
 * Narrowest a split pane may get. Below ~15% a pane is a sliver that reads as a
 * rendering glitch on the venue screen rather than a deliberate composition, and
 * the divider becomes hard to grab back. Symmetric: the other pane is capped at
 * the same bound.
 */
export const SPLIT_RATIO_MIN = 0.15;
export const SPLIT_RATIO_MAX = 0.85;

/** Keyboard nudge step for the divider (arrow keys). */
export const SPLIT_RATIO_STEP = 0.02;

/** Clamp a split ratio into the legible band. NaN/±Infinity collapse to an even split. */
export function clampSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0.5;
  return Math.min(SPLIT_RATIO_MAX, Math.max(SPLIT_RATIO_MIN, ratio));
}

/**
 * Ratio for a pointer at `clientX` over a track spanning [left, left+width].
 * Returns null for a zero-width track (element not laid out yet) so callers
 * leave the ratio alone rather than snapping the divider to a clamp bound.
 */
export function splitRatioFromPointer(
  clientX: number,
  track: { left: number; width: number },
): number | null {
  if (!Number.isFinite(track.width) || track.width <= 0) return null;
  return clampSplitRatio((clientX - track.left) / track.width);
}
