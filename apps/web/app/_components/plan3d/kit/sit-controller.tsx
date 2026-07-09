'use client';

/**
 * kit/sit-controller — the headless choreographer for ONE figure sitting into
 * (or standing out of) ONE chair. Owner-locked sit sequence (2026-07-08):
 *
 *   (a) the walker arrives at `approachPoint` — 0.55 m out along −faceY,
 *       directly behind the chair (the CALLER's walk system delivers it there;
 *       this controller takes over the figure group from that spot). When the
 *       caller passes `arrivePose`/`arrivePhase`, the figure STARTS in that
 *       frozen gait sample and eases to 'stand' over the kit's ⅓ s blend
 *       DURING the pull — the arrival-blend fix (2026-07-09); previously the
 *       remounted figure snapped to neutral in one frame;
 *   (b) PULL   — the chair eases BACK 0.35 m along −faceY, 350 ms ease-out;
 *   (c) STEP   — the figure steps into the gap, turns to the seat gaze via a
 *       shortest-arc angle lerp, and blends stand→sit over 450 ms (the kit
 *       <Figure>'s internal damp blend covers the joints; this controller
 *       times the window and moves the root);
 *   (d) TUCK   — chair + figure slide forward TOGETHER 0.3 m, 400 ms;
 *   (e) SETTLE + HANDOFF — the 0.35 pull / 0.30 tuck asymmetry leaves the
 *       chair 5 cm shy of flush, so a short damp settle closes that gap BEFORE
 *       `onSeated()` fires — otherwise the swap back to the instanced chair
 *       (which lives exactly at flush) would pop 5 cm on handoff. The caller
 *       then swaps the guest to the normal seated path and unmounts this
 *       controller; the unmount cleanup restores the instanced chair.
 *
 * The REVERSE clip (mode 'stand', for future seat-swap animations) mirrors it:
 * UNTUCK (chair + figure back 0.3 m together) → RISE (sit→stand blend, the
 * figure steps back to the approach point and turns to its depart heading) →
 * RETURN (the chair eases home) → `onStood()`.
 *
 * Conventions (all from the SeatPose work in lib/seating-3d.ts):
 *   · `seat.faceY` is the seated guest's GAZE (toward the table), walkVector
 *     heading convention — figure group rotation.y = heading. The CHAIR yaw
 *     (backrest heading, what InstancedChairs composes) is gaze + π, so
 *     "the figure turns to chair faceY + π" and "turns to the seat gaze" are
 *     the same statement in the two vocabularies.
 *   · The figure's seated root sits FIGURE_NUDGE_M (0.04 m) table-ward of the
 *     chair origin — the lab's seated `[0, 0, −0.04]` chair-local nudge — so
 *     the handoff to the normal seated render is transform-identical.
 *   · During STEP the figure passes through the pulled-back chair's cushion
 *     for a beat — accepted stylisation (Sims-like, matches the owner brief's
 *     "steps into the gap"; a side-step arc is a future polish, not V1).
 *
 * MOTION RULES (house): every ease is frame-rate independent — timed phases
 * run on accumulated delta with fixed-duration easing curves, the settle uses
 * the shared `damp(base, delta)`. Completion is WALL-CLOCK-owned, never
 * frame-count-owned: phase hand-offs carry the clock remainder forward and the
 * frame loop resolves every phase that time already paid for in the SAME
 * frame — a starved rAF stream (hidden tab, the embedded dev-preview panel
 * that delivers frames in on-demand bursts) still lands `onSeated()` on its
 * next available frame instead of needing one frame per phase (the 2026-07-08
 * arrival-chain hang: the clip LOOKED seated while finish() sat 3+ frames of
 * pull→step→tuck→settle away, and those frames never came). Reduced motion
 * NEVER animates: it snaps to the end-state instantly, never detaches the
 * instanced chair (so there is nothing to restore or double-draw), and STILL
 * fires the completion callback — every flow completes.
 *
 * Pure rendering + math: no server actions, no DB, no PII.
 */

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import { damp } from '@/lib/figure-rig';
import type { SeatPose } from '@/lib/seating-3d';
import {
  detachChair,
  restoreChair,
  type DetachedChairTransform,
} from '@/app/_components/plan3d/instanced-chairs';
import { ActiveChair } from './active-chair';
import type { FigurePoseName } from './figure';

// ── Owner-locked choreography constants (metres / milliseconds) ─────────────
export const SIT_TIMING = {
  /** Walker's standing spot behind the chair — MUST mirror `approachPoint`'s
   *  0.55 m default (lib/seating-3d.ts) or step distances drift. */
  APPROACH_M: 0.55,
  /** (b) chair pull-back distance + duration (ease-out). */
  PULL_BACK_M: 0.35,
  PULL_MS: 350,
  /** (c) step-into-the-gap + stand→sit blend window. */
  SIT_BLEND_MS: 450,
  /** (d) joint chair+figure tuck distance + duration. */
  TUCK_M: 0.3,
  TUCK_MS: 400,
  /** Seated root offset table-ward of the chair origin (lab parity, see header). */
  FIGURE_NUDGE_M: 0.04,
  /** Settle damp base (fraction of gap REMAINING after 1 s — effectively
   *  closes the 5 cm under-tuck in ~0.2 s) + the snap-to-flush threshold. */
  SETTLE_DAMP_BASE: 1e-6,
  SETTLE_EPS_M: 0.004,
} as const;

export type SitPhase =
  | 'pull'
  | 'step'
  | 'tuck'
  | 'settle'
  | 'seated'
  | 'untuck'
  | 'rise'
  | 'return'
  | 'stood';

/** Ken-Perlin smootherstep — the house walk ease (plan3d-scene precedent). */
function smootherstep(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return c * c * c * (c * (c * 6 - 15) + 10);
}

/** Ease-out cubic — fast start, gentle stop: the chair "pull" reads like a
 *  hand grabbing and releasing, not a metronome. */
function easeOutCubic(x: number): number {
  const c = Math.max(0, Math.min(1, x));
  return 1 - (1 - c) * (1 - c) * (1 - c);
}

/** Shortest-arc angle lerp so the turn-to-seat never spins the long way round
 *  (local copy of the plan3d-scene Walker's idiom — 3 lines, not worth a
 *  cross-module export of a private helper). */
function lerpAngle(a: number, b: number, k: number): number {
  const d = Math.atan2(Math.sin(b - a), Math.cos(b - a));
  return a + d * k;
}

/** Normalize into atan2's (−π, π] range (seating-3d's private wrapAngle). */
function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

// The chair's rest pose + derived axes, computed once per clip. `gaze` points
// AT the table (seat.faceY); (dirX, dirZ) is its unit vector, so "back along
// −faceY" = rest − dist·dir and "table-ward" = rest + dist·dir.
type Rest = { x: number; z: number; yaw: number; gaze: number; dirX: number; dirZ: number };

function restFromSeat(seat: SeatPose): Rest {
  return restFromChair({ x: seat.x, z: seat.z, yaw: wrapAngle(seat.faceY + Math.PI) });
}

function restFromChair(t: DetachedChairTransform): Rest {
  const gaze = wrapAngle(t.yaw + Math.PI);
  return { x: t.x, z: t.z, yaw: t.yaw, gaze, dirX: Math.sin(gaze), dirZ: Math.cos(gaze) };
}

export type SitControllerOptions = {
  /** World seat pose (`worldSeatPose` / `seatWorld`). Locked for the clip's
   *  lifetime — key the controller by (tableId, seatIndex) to restart. */
  seat: SeatPose;
  /** Registry key of the table's InstancedChairs (its new `tableId` prop). */
  tableId: string;
  /** Chair index at that table (the same index `seated`/`removedSeats` use). */
  seatIndex: number;
  /** 'sit' (default) runs (b)→(e); 'stand' runs the reverse clip. Locked at
   *  mount — remount (key change) to flip direction. */
  mode?: 'sit' | 'stand';
  /** Root group of the figure (the controller owns its position + rotation.y
   *  for the whole clip — the walker must have released it). */
  figureRef: React.RefObject<THREE.Group | null>;
  /** Root group of the mounted <ActiveChair>. */
  chairRef: React.RefObject<THREE.Group | null>;
  /** Walker heading on arrival (start of the shortest-arc turn). Defaults to
   *  the seat gaze — a straight walk-in needs no turn. */
  arriveHeading?: number;
  /**
   * Gait pose the walker ARRIVED in ('walk' | 'run') — the arrival-blend fix
   * (2026-07-09): mounting this controller REMOUNTS the kit <Figure>, and a
   * fresh FigureFrameDriver initialises cur = from = target, so without this
   * the mid-stride pose snapped to neutral 'stand' in ONE frame (clearly
   * visible since the walkers went 'run' — ±0.85 rad hips + jelly squash).
   * With it, the controller starts the figure IN this pose (frozen at
   * `arrivePhase`), holds it for exactly one rendered frame (the fresh
   * driver's first frame snapshots it as its blend source), then flips to
   * 'stand' — the kit's ⅓ s preset blend eases the limbs down WHILE the
   * chair pulls back (350 ms — the two windows overlap almost exactly).
   * Ignored under reduced motion (which snaps to the end state, as ever).
   */
  arrivePose?: FigurePoseName;
  /** The walker's frozen gait-clock value at arrival — feeds the figure's
   *  `phase` so the first painted sample matches the unmounted walker's last
   *  frame exactly (same pose + same phase ⇒ identical joints). */
  arrivePhase?: number;
  /** Heading the stand-up clip turns to while rising. Defaults to gaze + π
   *  (facing away from the table, ready to walk off). */
  departHeading?: number;
  /** Fired exactly once when the sit clip reaches flush-seated (or instantly
   *  under reduced motion). */
  onSeated?: () => void;
  /** Fired exactly once when the reverse clip's chair is back home. */
  onStood?: () => void;
};

export type SitControllerHandles = {
  /** Feed this to the figure's `pose` prop — flips stand→sit at STEP start
   *  (or sit→stand at RISE start); the kit <Figure> damp-blends the joints. */
  pose: FigurePoseName;
  /** True ⇒ the caller must NOT mount an <ActiveChair> (nothing was detached). */
  reduced: boolean;
  /** Live phase, for debugging / gating callers. Ref — never re-renders. */
  phaseRef: React.RefObject<SitPhase>;
};

/**
 * useSitController — the headless core. Owns detach/restore of the instanced
 * chair, every transform write on the chair + figure groups, and the phase
 * clock. `<SitController>` below is the batteries-included wrapper that also
 * mounts the ActiveChair and the figure group for you.
 */
export function useSitController({
  seat,
  tableId,
  seatIndex,
  mode = 'sit',
  figureRef,
  chairRef,
  arriveHeading,
  arrivePose,
  arrivePhase,
  departHeading,
  onSeated,
  onStood,
}: SitControllerOptions): SitControllerHandles {
  const reduced = usePrefersReducedMotion();
  // The forward clip starts in the walker's arrival gait when given (see the
  // arrivePose doc) — reduced motion keeps the plain 'stand' start, since it
  // never animates and 'run'+reduced would bake a neutral stand anyway.
  const startsGaited = mode === 'sit' && !reduced && (arrivePose === 'walk' || arrivePose === 'run');
  const [pose, setPose] = useState<FigurePoseName>(
    mode === 'sit' ? (startsGaited ? arrivePose! : 'stand') : 'sit',
  );
  // One-rendered-frame hold on the arrival gait: the fresh FigureFrameDriver's
  // FIRST frame snapshots the frozen mid-stride sample as its blend source
  // (cur = from = target); flipping to 'stand' any earlier would hand it the
  // stand target instead and re-introduce the one-frame snap this exists to
  // kill. Decremented in the frame loop below.
  const arriveHold = useRef(startsGaited ? 1 : 0);

  // Clip state lives in refs — the frame loop is the only writer and React
  // re-renders only on the two pose flips.
  const rest = useRef<Rest | null>(null);
  if (rest.current === null) rest.current = restFromSeat(seat);
  const phaseRef = useRef<SitPhase>(mode === 'sit' ? 'pull' : 'untuck');
  const tMs = useRef(0);
  /** Chair's current pull-back distance along −gaze (0 = flush at rest). */
  const chairBack = useRef(0);
  const headingFrom = useRef(0);
  const doneRef = useRef(false);

  // Latest-closure callback refs so a re-rendered parent passing a fresh
  // lambda never re-arms effects or fires twice.
  const onSeatedRef = useRef(onSeated);
  const onStoodRef = useRef(onStood);
  useEffect(() => {
    onSeatedRef.current = onSeated;
    onStoodRef.current = onStood;
  });

  const finish = (): void => {
    if (doneRef.current) return;
    doneRef.current = true;
    (mode === 'sit' ? onSeatedRef.current : onStoodRef.current)?.();
  };

  // Detach the instanced chair BEFORE paint so its zero-scale hole and the
  // ActiveChair land in the same frame (no double-draw flash). The rendered
  // transform it returns beats the math-derived rest: table drag slide-lag
  // can hold the group a touch off its pct home. Reduced motion never
  // detaches — the chair never moves, so there's nothing to swap or restore.
  useLayoutEffect(() => {
    if (reduced) return;
    const t = detachChair(tableId, seatIndex);
    if (t) rest.current = restFromChair(t);
    return () => restoreChair(tableId, seatIndex);
  }, [reduced, tableId, seatIndex]);

  // Initial placement, also pre-paint. Sit: chair at rest, figure at the
  // approach point in its arrival heading. Stand: figure seated on the flush
  // chair. Reduced motion: SNAP straight to the end-state (seated / stood).
  useLayoutEffect(() => {
    const r = rest.current;
    if (!r) return;
    const chair = chairRef.current;
    if (chair) {
      chair.position.set(r.x, 0, r.z);
      chair.rotation.y = r.yaw;
    }
    const fig = figureRef.current;
    if (!fig) return;
    const sitEnd = mode === 'sit';
    const snapSeated = reduced ? sitEnd : !sitEnd; // where each mode STARTS or ENDS seated
    if (snapSeated) {
      fig.position.set(r.x + r.dirX * SIT_TIMING.FIGURE_NUDGE_M, 0, r.z + r.dirZ * SIT_TIMING.FIGURE_NUDGE_M);
      fig.rotation.y = r.gaze;
    } else {
      fig.position.set(r.x - r.dirX * SIT_TIMING.APPROACH_M, 0, r.z - r.dirZ * SIT_TIMING.APPROACH_M);
      fig.rotation.y = reduced
        ? (departHeading ?? wrapAngle(r.gaze + Math.PI)) // reduced stand: already departed
        : (arriveHeading ?? r.gaze);
    }
    // Headings are mount-time inputs by contract (seat/mode locked per clip).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, mode]);

  // Reduced motion completes the flow without animating: end-state pose
  // (post-paint, after the snap placement above) + the completion callback.
  useEffect(() => {
    if (!reduced) return;
    setPose(mode === 'sit' ? 'sit' : 'stand');
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, mode]);

  useFrame((_, delta) => {
    if (reduced) return;
    const fig = figureRef.current;
    const chair = chairRef.current;
    const r = rest.current;
    if (!fig || !chair || !r) return;
    const T = SIT_TIMING;
    tMs.current += delta * 1000;

    // Arrival-gait ease-out (see arriveHold above): after the driver's first
    // frame captured the frozen stride, flip to 'stand' — the kit's ⅓ s blend
    // rides the chair's 350 ms pull. Runs BEFORE the phase machine so a
    // starved first frame that resolves the whole pull can still setPose('sit')
    // afterwards and win (run → sit blends directly; no snap either way).
    if (arriveHold.current > 0) {
      arriveHold.current -= 1;
      if (arriveHold.current === 0) setPose('stand');
    }

    // Once the figure owns the chair (STEP end onward, and throughout the
    // reverse clip's seated stretch) its root rides the chair: nudge table-ward
    // of wherever the chair currently is.
    const rideChair = (): void => {
      const o = -chairBack.current + T.FIGURE_NUDGE_M;
      fig.position.set(r.x + r.dirX * o, 0, r.z + r.dirZ * o);
    };
    // Hand-off CARRIES the clock remainder into the next phase instead of
    // zeroing it — the wall-clock-owned completion contract (header). At a
    // healthy 60 fps the carry is <17 ms (no visible change, just no dead
    // frame at each boundary); after a starved stretch it is the WHOLE owed
    // clip, and the loop below resolves every overdue phase this same frame.
    const advance = (next: SitPhase, spentMs: number): void => {
      phaseRef.current = next;
      tMs.current = Math.max(0, tMs.current - spentMs);
    };

    // Resolve phases until one is still mid-flight this frame. Bounded by the
    // clip length: a full forward clip is pull→step→tuck→settle→seated —
    // 5 hops; the terminal hold phases never advance, so 6 always suffices.
    for (let hop = 0; hop < 6; hop++) {
      const phase = phaseRef.current;
      switch (phase) {
        // ── forward clip: sit ──────────────────────────────────────────────
        case 'pull': {
          const k = Math.min(1, tMs.current / T.PULL_MS);
          chairBack.current = T.PULL_BACK_M * easeOutCubic(k);
          if (k >= 1) {
            headingFrom.current = fig.rotation.y;
            setPose('sit'); // the kit Figure's damp blend rides the 450 ms window
            advance('step', T.PULL_MS);
          }
          break;
        }
        case 'step': {
          const e = smootherstep(Math.min(1, tMs.current / T.SIT_BLEND_MS));
          // Approach spot → seated spot on the PULLED-BACK chair.
          const from = -T.APPROACH_M;
          const to = -T.PULL_BACK_M + T.FIGURE_NUDGE_M;
          const o = from + (to - from) * e;
          fig.position.set(r.x + r.dirX * o, 0, r.z + r.dirZ * o);
          fig.rotation.y = lerpAngle(headingFrom.current, r.gaze, e);
          if (e >= 1) advance('tuck', T.SIT_BLEND_MS);
          break;
        }
        case 'tuck': {
          const k = Math.min(1, tMs.current / T.TUCK_MS);
          chairBack.current = T.PULL_BACK_M - T.TUCK_M * smootherstep(k);
          rideChair();
          if (k >= 1) advance('settle', T.TUCK_MS);
          break;
        }
        case 'settle': {
          // Close the 5 cm under-tuck (0.35 pull vs 0.30 tuck) so the handoff to
          // the flush instanced chair can't pop — see the header's (e). The damp
          // consumes the time accrued since the LAST settle iteration: tMs is
          // the carried remainder on entry (a resumed tab closes the whole gap
          // in one hop) and the plain frame delta on every later frame.
          const dtSec = tMs.current / 1000;
          tMs.current = 0;
          chairBack.current += (0 - chairBack.current) * damp(T.SETTLE_DAMP_BASE, dtSec);
          if (Math.abs(chairBack.current) < T.SETTLE_EPS_M) {
            chairBack.current = 0;
            advance('seated', 0);
            finish();
          }
          rideChair();
          break;
        }
        case 'seated': {
          // Hold the exact rest transform until the caller swaps the guest to
          // the normal seated path and unmounts us (cleanup restores the chair).
          chairBack.current = 0;
          rideChair();
          fig.rotation.y = r.gaze;
          break;
        }

        // ── reverse clip: stand-up ─────────────────────────────────────────
        case 'untuck': {
          const k = Math.min(1, tMs.current / T.TUCK_MS);
          chairBack.current = T.TUCK_M * smootherstep(k);
          rideChair();
          if (k >= 1) {
            headingFrom.current = fig.rotation.y;
            setPose('stand');
            advance('rise', T.TUCK_MS);
          }
          break;
        }
        case 'rise': {
          const e = smootherstep(Math.min(1, tMs.current / T.SIT_BLEND_MS));
          const from = -T.TUCK_M + T.FIGURE_NUDGE_M;
          const to = -T.APPROACH_M;
          const o = from + (to - from) * e;
          fig.position.set(r.x + r.dirX * o, 0, r.z + r.dirZ * o);
          fig.rotation.y = lerpAngle(headingFrom.current, departHeading ?? wrapAngle(r.gaze + Math.PI), e);
          if (e >= 1) advance('return', T.SIT_BLEND_MS);
          break;
        }
        case 'return': {
          const k = Math.min(1, tMs.current / T.PULL_MS);
          chairBack.current = T.TUCK_M * (1 - easeOutCubic(k));
          if (k >= 1) {
            chairBack.current = 0;
            advance('stood', T.PULL_MS);
            finish();
          }
          break;
        }
        case 'stood':
          break;
      }
      // Still mid-phase (or holding a terminal pose) — this frame is resolved.
      if (phaseRef.current === phase) break;
    }

    // One authoritative chair write per frame, whatever the phase did.
    chair.position.set(r.x - r.dirX * chairBack.current, 0, r.z - r.dirZ * chairBack.current);
  });

  return { pose, reduced, phaseRef };
}

export type SitControllerProps = Omit<SitControllerOptions, 'figureRef' | 'chairRef'> & {
  /** Chair colour — the SAME `palette.wall` the table's InstancedChairs gets. */
  chairColor: string;
  chairRoughness?: number;
  chairCastShadow?: boolean;
  /** Render-prop for the figure: gets the live pose to feed `<Figure pose>`,
   *  plus the frozen arrival gait phase for `<Figure phase>` (0 when no
   *  arrivePose was given — stand/sit ignore it). Renders inside the
   *  controller-owned group — position nothing yourself. */
  children: (pose: FigurePoseName, phase: number) => ReactNode;
};

/**
 * <SitController> — the drop-in wrapper: mounts the detached ActiveChair (skipped
 * under reduced motion, where nothing detaches) and the controller-owned figure
 * group, and threads the pose to your figure via the children render-prop.
 *
 *   <SitController seat={seatWorld(t, n, room)} tableId={t.id} seatIndex={n}
 *                  chairColor={palette.wall} onSeated={handleSeated}>
 *     {(pose) => <Figure spec={spec} pose={pose} name={name} />}
 *   </SitController>
 */
export function SitController({
  chairColor,
  chairRoughness,
  chairCastShadow,
  children,
  ...opts
}: SitControllerProps) {
  const figureRef = useRef<THREE.Group>(null);
  const chairRef = useRef<THREE.Group>(null);
  const { pose, reduced } = useSitController({ ...opts, figureRef, chairRef });
  return (
    <>
      {!reduced ? (
        <ActiveChair ref={chairRef} color={chairColor} roughness={chairRoughness} castShadow={chairCastShadow} />
      ) : null}
      <group ref={figureRef}>{children(pose, opts.arrivePhase ?? 0)}</group>
    </>
  );
}
