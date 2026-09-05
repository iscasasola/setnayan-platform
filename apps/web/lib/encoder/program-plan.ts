/**
 * S1 · the PURE composition planner for the program canvas.
 *
 * Turns one `ProgramFrame` (in its structured-cloneable wire form) into a list of draw ops
 * for a 1280×720 surface. No canvas, no DOM, no worker globals: this is the half of the
 * compositor that a Node test can hold to account with a synthetic frame, and it is the
 * half where every paywall-shaped decision lives — so the tests here ARE the guards.
 *
 * It mirrors `app/panood/program/[eventId]/program-surface.tsx` branch for branch, in the
 * same order, because that surface is what the couple rehearsed against:
 *
 *   refused source           → the withheld card, nothing else
 *   primary + secondary      → split at clampSplitRatio(splitRatio)
 *   primary                  → full frame, object-contain (never crop the couple's frame)
 *   nothing                  → the no-signal card, drawing `frame.label`
 *   + requestedSource ≠ source → the pinned-channel notice over the picture (Wave 5)
 *
 * What it deliberately does NOT do:
 *   · read `frame.overlay` / `overlayReason` — the legacy full-screen paywall is retired on
 *     this path (rule 18; the unified bridge publishes `overlay: false` unconditionally).
 *     There is no overlay or watermark op KIND, so an `EMPTY_FRAME` — whose `overlay` is
 *     still `true` for the pop-out's fail-closed default — can only ever plan the
 *     "Nothing on program yet" card.
 *   · draw the broadcast extras (`ResolvedOverlays`) — S2 draws those; see the named hook in
 *     program-compositor.ts.
 *   · decide entitlement — `air` arrives already decided from the server, exactly as the
 *     pop-out receives it, and is only ever CONSULTED here via `programSourceAllowed`.
 */

import { clampSplitRatio, type ProgramFrame } from '../panood-program-bridge';
import { programSourceAllowed, type ProgramAirDecision } from '../live-studio-publish-pure';
import { WITHHELD_CARD, pinnedChannelNotice } from './program-strings';

export const PROGRAM_WIDTH = 1280;
export const PROGRAM_HEIGHT = 720;

/** Width of the split divider, matching the pop-out's 2px `bg-white/25` rule. */
export const SPLIT_DIVIDER_WIDTH = 2;

/**
 * `ProgramFrame` with the two `MediaStream`s reduced to booleans. A `MediaStream` is not
 * structured-cloneable, so this is the shape that crosses into the worker; the streams
 * themselves travel separately as tracks (see program-canvas.ts).
 */
export type ProgramFrameWire = {
  source: string | null;
  requestedSource: string | null;
  label: string;
  live: boolean;
  hasStream: boolean;
  hasSecondaryStream: boolean;
  splitRatio: number;
};

export function toWireFrame(frame: ProgramFrame): ProgramFrameWire {
  return {
    source: frame.source,
    requestedSource: frame.requestedSource ?? null,
    label: frame.label,
    live: frame.live,
    hasStream: frame.stream !== null,
    hasSecondaryStream: frame.secondaryStream !== null,
    splitRatio: frame.splitRatio,
  };
}

export type Region = { x: number; y: number; w: number; h: number };

export type VideoSlot = 'primary' | 'secondary';

/**
 * The op vocabulary. Deliberately closed: there is no `overlay` and no `watermark` kind, and
 * the tests assert that by name so a future edit cannot add one without being noticed.
 */
export type DrawOp =
  | { kind: 'clear' }
  /** Paint the slot's latest decoded frame, object-contain, inside `region`. */
  | { kind: 'video'; slot: VideoSlot; region: Region }
  | { kind: 'divider'; x: number; width: number }
  | { kind: 'card'; card: 'no-signal'; lines: readonly [string] }
  | { kind: 'card'; card: 'withheld-source'; lines: readonly [string, string, string, string] }
  | { kind: 'notice'; notice: 'withheld-cut'; text: string };

export type ProgramPlan = readonly DrawOp[];

export type PlanInput = {
  frame: ProgramFrameWire;
  /**
   * Server-resolved program-output entitlement, if the call site has it (the controller
   * page does). Null = nothing is restricted — the flag is off or this is a legacy Cast
   * broadcast — and the surface behaves as before.
   */
  air: Pick<ProgramAirDecision, 'enforced' | 'permittedSlots'> | null;
};

const FULL: Region = { x: 0, y: 0, w: PROGRAM_WIDTH, h: PROGRAM_HEIGHT };

export function planProgram({ frame, air }: PlanInput): ProgramPlan {
  const ops: DrawOp[] = [{ kind: 'clear' }];

  // ── WAVE 5 · THE GATE, applied to the frame that actually arrived ─────────────
  // Same helper, same order as the pop-out. Anything not on the permitted list is dropped
  // and named — never a black frame, never a substituted camera.
  const sourceAllowed = air ? programSourceAllowed(air, frame.source) : true;
  const refusedSource = Boolean(air?.enforced && !sourceAllowed);
  if (refusedSource) {
    ops.push({
      kind: 'card',
      card: 'withheld-source',
      lines: [WITHHELD_CARD.kicker, WITHHELD_CARD.title, WITHHELD_CARD.body, WITHHELD_CARD.hint],
    });
    return ops;
  }

  // A null stream plans NO video op, whatever frame the compositor may still be holding
  // from the previous camera. The placeholder is the picture, not a stale frame.
  const hasPrimary = frame.hasStream;
  const hasSecondary = frame.hasSecondaryStream;

  if (hasPrimary && hasSecondary) {
    // Split honoured ONLY with a real second stream (rule 21: no live publisher sends one
    // today — `ProgramBridgeHost` hard-codes `secondaryStream: null, splitRatio: 0.5`).
    const ratio = clampSplitRatio(frame.splitRatio);
    const primaryW = Math.round(ratio * PROGRAM_WIDTH);
    ops.push({ kind: 'video', slot: 'primary', region: { x: 0, y: 0, w: primaryW, h: PROGRAM_HEIGHT } });
    ops.push({ kind: 'divider', x: primaryW, width: SPLIT_DIVIDER_WIDTH });
    ops.push({
      kind: 'video',
      slot: 'secondary',
      region: {
        x: primaryW + SPLIT_DIVIDER_WIDTH,
        y: 0,
        w: PROGRAM_WIDTH - primaryW - SPLIT_DIVIDER_WIDTH,
        h: PROGRAM_HEIGHT,
      },
    });
  } else if (hasPrimary) {
    ops.push({ kind: 'video', slot: 'primary', region: FULL });
  } else {
    ops.push({ kind: 'card', card: 'no-signal', lines: [frame.label] });
  }

  // ── WAVE 5 · the host's cut is not what is going out ──────────────────────────
  // Only ever true on the free tier: for an entitled host `decideProgramAir` sets
  // `airSlot === requestedSlot`, so the two fields agree. When `air` is known we also
  // require it to be enforcing, exactly as the pop-out does.
  const cutWithheld = Boolean(
    frame.requestedSource &&
      frame.requestedSource !== frame.source &&
      (air ? air.enforced : true),
  );
  if (cutWithheld) {
    ops.push({ kind: 'notice', notice: 'withheld-cut', text: pinnedChannelNotice(frame.label) });
  }

  return ops;
}

/**
 * `object-contain`: the largest box of the source's aspect that fits inside `region`,
 * centred. Never crops. Degenerate sources (0×0, NaN) collapse to the whole region rather
 * than throwing mid-broadcast.
 */
export function fitContain(srcW: number, srcH: number, region: Region): Region {
  if (!(srcW > 0) || !(srcH > 0) || !Number.isFinite(srcW) || !Number.isFinite(srcH)) {
    return { ...region };
  }
  const scale = Math.min(region.w / srcW, region.h / srcH);
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  return {
    x: region.x + Math.round((region.w - w) / 2),
    y: region.y + Math.round((region.h - h) / 2),
    w,
    h,
  };
}
