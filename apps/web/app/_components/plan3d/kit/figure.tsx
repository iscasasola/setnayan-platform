'use client';

/**
 * kit/figure — the articulated one-piece "blob" figure every 3D seat-plan
 * surface shares (owner-locked 2026-07-09, ref: the Meccha one-piece white
 * character — a faceless, palette-tinted, soft mannequin: no neck, no feet,
 * chunky fused limbs, one continuous form). Replaced the cylinder+sphere
 * GuestToken / Walker tokens on all three surfaces — homepage demo, couple
 * lab, and the public guest venue walk (Fable slice 7). One rig, five poses
 * (stand · walk · run · sit · dance):
 *
 *   group hierarchy: pelvis → torso → head, with two 2-segment arms
 *   (shoulder→elbow) and two 2-segment legs (hip→knee) hanging off it. Pose
 *   records come VERBATIM from `lib/figure-rig.ts` (pure, unit-tested) — this
 *   file only owns applying them to group rotations and the mesh dressing.
 *
 * BUDGET (why the numbers below): every geometry is a MODULE-SCOPE shared
 * buffer (the lab's GOWN_GEO/SUIT_GEO precedent) — this file owns the arm +
 * leg capsules, head sphere, status ring, and the unit JOINT_GEO ball.
 * Meshes per figure: 8 limb segments + 8 joint-blend balls (2026-07-09
 * seamless-joints pass) + pelvis + torso + head + 2 leg stumps + the
 * status ring ≈ 21 — no neck, no shoes since the one-piece silhouette pass
 * (same day). All ONE shared body material, so a 200-guest room still
 * shares a handful of GPU programs.
 *
 * MOTION RULES (house):
 *   · All smoothing is frame-rate independent via the shared `damp(base,
 *     delta)` pattern (re-exported by figure-rig) — pose-preset changes blend
 *     over ~⅓ s identically at 30 or 120 fps.
 *   · `usePrefersReducedMotion` → a STATIC pose (no walk-cycle limb swing, no
 *     idle sway); the figure still relocates/sits, so every flow completes.
 *   · quality 'low' bakes the pose once and never touches joints per frame —
 *     the phone-crowd budget knob.
 *
 * SELFIE PATH: a `photoUrl` mounts the EXISTING `GuestPhotoAvatar` billboard
 * disc (shared refcounted texture cache — NOT re-implemented here) INSTEAD OF
 * the blank ball head — the same "photo disc replaces the head" treatment the
 * pre-kit tokens used. It must replace, not overlay: the disc is a transparent
 * billboard, so an opaque sphere behind it wins the depth test and blanks the
 * photo across the whole silhouette. Without a photo the head is a single
 * featureless sphere (no face, no hair — the blob) and the status colour
 * renders as a small floor ring instead.
 */

import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import {
  standPose,
  walkCyclePose,
  runCyclePose,
  jellySquash,
  sitPose,
  idleSway,
  staffIdle,
  dancePose,
  overlayPose,
  damp,
  JOINTS,
  ZERO_POSE,
  type FigureSpec,
  type JellyScale,
  type Pose,
  type StaffIdleKind,
} from '@/lib/figure-rig';
import { GuestPhotoAvatar } from '@/app/_components/plan3d/guest-avatar';
import { mannequinMaterial } from './outfits';
// Rig proportions + leaf placements + the pose applier now live in the PURE,
// unit-tested `lib/figure-sit-bake` so the SINGLE source drives BOTH this
// rendered figure AND the instanced seated crowd's baked-pose extraction — the
// two can never silently diverge (that's the crowd's pixel-identity guarantee).
import {
  PELVIS_Y,
  HIP_X,
  THIGH_LEN,
  SHIN_LEN,
  SHOULDER_X,
  SHOULDER_Y,
  UPPER_ARM_LEN,
  FOREARM_LEN,
  NECK_Y,
  HEAD_LIFT,
  HIP_BLOCK_Y,
  THIGH_SCALE_XZ,
  THIGH_SCALE_Y,
  SHIN_SCALE_XZ,
  SHIN_SCALE_Y,
  SHOE_POS_Y,
  SHOE_POS_Z,
  SHOE_SCALE_X,
  SHOE_SCALE_Y,
  SHOE_SCALE_Z,
  UPPER_ARM_SCALE_XZ,
  UPPER_ARM_SCALE_Y,
  FOREARM_SCALE_XZ,
  FOREARM_SCALE_Y,
  KNEE_BALL_R,
  HIP_BALL_R,
  ELBOW_BALL_R,
  SHOULDER_BALL_R,
  applyPose,
  type JointGroups,
} from '@/lib/figure-sit-bake';

// ── Rig proportions (metres, adult at scale 1) ───────────────────────────────
// Sized against the PRODUCT-TRUE furniture: 0.46 m chair seats + 0.74 m
// tables. Standing hip pivot at 0.80 puts the head centre at ≈1.44 (a ~1.56 m
// figure); the sitPose −0.30 m drop lands the hips at ≈0.50 — on the seat —
// with the head at ≈1.14, matching where today's seated photo discs float.
// (The numeric constants themselves are imported from figure-sit-bake above.)
const HEAD_R = 0.16; // one-piece pass (2026-07-09): big ball head resting ON the shoulders

// ── Shared geometry owned by this file (module scope — 4 buffers) ───────────
// The native (unscaled) capsule lengths these buffers expose — LEG_GEO_LEN /
// ARM_GEO_LEN — are imported from figure-sit-bake alongside the proportions, so
// the leaf stretch factors stay single-sourced with the baker.
// EXPORTED so `kit/instanced-seated-crowd.tsx` draws the seated crowd with the
// IDENTICAL geometry buffers (an instanced figure must be pixel-for-pixel the
// figure it replaces — same buffer, never a re-model).
// One-piece silhouette pass (2026-07-09, owner: the Meccha-blob direction):
// CHUNKY low-taper limbs — radii up ~38%, native lengths UNCHANGED (r + mid
// still sum to the same LEG/ARM_GEO_LEN, so every leaf scale stays valid).
export const ARM_GEO = new THREE.CapsuleGeometry(0.058, 0.108, 6, 14); // native ≈0.224 long
export const LEG_GEO = new THREE.CapsuleGeometry(0.075, 0.21, 6, 14); // native ≈0.36 long
export const HEAD_GEO = new THREE.SphereGeometry(HEAD_R, 28, 20); // mascot-smooth: no visible facets on close-ups
// 2026-07-08 leg pass: the hip block that joins trousered legs (a squashed
// capsule reads as soft tailoring, not a box) + the shoe nose.
export const HIP_GEO = (() => {
  // One-piece pass: a fuller pelvis capsule that overlaps the torso bottom AND
  // the thigh tops — the body reads as one form flowing into the legs.
  const g = new THREE.CapsuleGeometry(0.115, 0.08, 6, 14);
  g.scale(1.25, 0.85, 0.95);
  return g;
})();
export const SHOE_GEO = (() => {
  // One-piece pass: no shoes — the leg ends in a ROUNDED STUMP that grazes the
  // ground (the reference blob has no feet). Historical export name kept (the
  // baked part keys are 'shoeL/R').
  const g = new THREE.SphereGeometry(0.08, 16, 12);
  return g;
})();
export const STATUS_RING_GEO = new THREE.RingGeometry(0.16, 0.235, 24);
// Joint-blend ball (2026-07-09 seamless-joints pass — owner: "no twisted
// balloon"): a UNIT sphere scaled per joint to the radii in figure-sit-bake
// (KNEE/HIP/ELBOW/SHOULDER_BALL_R). One sphere at each bending pivot bridges
// the two capsule ends so a bent limb reads as one smooth tube — no pinch, no
// taper step. Same body material → the union is seamless.
export const JOINT_GEO = new THREE.SphereGeometry(1, 20, 16);
// 2026-07-08 AVATAR PIVOT: the plump featureless mannequin torso — one smooth
// capsule, softly flattened front-to-back. No shells, no wardrobe.
export const MANNEQUIN_TORSO_GEO = (() => {
  // One-piece pass round 2: slimmer + rounder, so the chunky arms hang JUST
  // outside the body instead of merging into one lump.
  const g = new THREE.CapsuleGeometry(0.16, 0.24, 10, 24);
  g.scale(1, 1.02, 0.9);
  g.translate(0, 0.27, 0);
  return g;
})();

/** The status ring's fixed local placement under the figure root (child of
 *  root, NOT pose-driven). Exported so the instanced crowd's ring instances
 *  land exactly where the individual figure's ring mesh does. */
export const STATUS_RING_POS_Y = 0.012;
export const STATUS_RING_ROT_X = -Math.PI / 2;

// Status-ring materials: the existing ring/marker convention (GuestToken's
// photo ring, the roam seat marker) — unlit so the status colour stays true.
const statusMats = new Map<string, THREE.MeshBasicMaterial>();
function statusRingMaterial(color: string): THREE.MeshBasicMaterial {
  let m = statusMats.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    statusMats.set(color, m);
  }
  return m;
}

// Preset base poses — module singletons (they're constant records; no reason
// to re-derive per figure per frame).
const STAND_BASE = standPose();
const SIT_BASE = sitPose();

// Meccha-style jelly squash-&-stretch (the ChameleonMovement prototype port,
// 2026-07-09): the torso squashes WIDE at each footfall and stretches tall
// toward the bounce apex — impact-weighted (squash > stretch, the jelly-toy
// weight landing), computed by the PURE `jellySquash` in lib/figure-rig and
// applied to the TORSO group only (legs keep their plant). `applyPose` never
// writes torso.scale, so this survives the frame. Two numbers per gait to
// tune ("more/less spring"); the run squashes harder than the walk.
const GAIT_SQUASH: Record<'walk' | 'run', { squash: number; stretch: number }> = {
  walk: { squash: 0.09, stretch: 0.05 },
  run: { squash: 0.14, stretch: 0.08 },
};

export type FigurePoseName = 'stand' | 'walk' | 'run' | 'sit' | 'dance';
export type FigureQuality = 'high' | 'low';

// `JointGroups` + `applyPose` are imported from `lib/figure-sit-bake` (the
// single source shared with the instanced-crowd baker).

export type FigureProps = {
  spec: FigureSpec;
  /** Which figure-rig preset drives the joints. Default 'stand'. */
  pose?: FigurePoseName;
  /**
   * Gait phase in radians — advance by `WALK_CLOCK_RAD_S` (or
   * `RUN_CLOCK_RAD_S` for pose 'run') from lib/figure-rig while translating;
   * freeze it on arrival exactly as today. Pass a ref to advance the gait
   * WITHOUT re-rendering React each frame — the figure reads `.current`
   * inside its own useFrame.
   */
  phase?: number | React.MutableRefObject<number>;
  /** 'low' bakes a static pose (no per-frame joint updates) — the crowd /
   *  phone budget knob, mirroring SceneLightingQuality's intent. */
  quality?: FigureQuality;
  /** Display name for the selfie path's initials fallback (GuestPhotoAvatar).
   *  Falls back to the spec id — pass the guest's name when you have one. */
  name?: string;
  /**
   * Booth-staff idle clip (2026-07-08 booth kit): replaces idleSway on the
   * STAND pose with the named staff loop (lib/figure-rig staffIdle — pure,
   * wall-clock time-based). Quality 'low' and reduced motion both bake the
   * clip's HELD t=0 pose (a barista frozen mid-tamp still reads as a
   * barista) — with the catalog complete, a phone room can hold 10+ booths
   * × up to 3 staff, which IS the crowd scale the 'low' knob exists for; the
   * original "a clip un-bakes 'low'" carve-out is gone (catalog-complete
   * review, 2026-07-08).
   */
  idleClip?: StaffIdleKind;
  /**
   * Explicit shadow-cast override. Default keeps the quality rule (only
   * 'high' figures cast); booth staff pass `false` so they keep the crowd
   * knob's shadow saving even while animating at quality 'high'.
   */
  castShadow?: boolean;
};

/**
 * Freeze/unfreeze local-matrix composition for a statically-baked figure.
 * three recomposes position/rotation/scale → matrix for every node with
 * `matrixAutoUpdate` each frame; a baked figure's ~26 nodes never change, so
 * composing them 60×/s per crowd figure is pure waste. The billboard subtree
 * (the selfie disc — flagged via `userData.kitKeepAutoMatrix`) is skipped: it
 * re-orients to the camera every frame and must keep composing.
 */
function setMatrixFrozen(o: THREE.Object3D, frozen: boolean): void {
  if (o.userData.kitKeepAutoMatrix) return; // billboard keeps facing the camera
  if (frozen) {
    o.updateMatrix(); // capture the baked transform before switching off
    o.matrixAutoUpdate = false;
  } else {
    o.matrixAutoUpdate = true;
  }
  for (const c of o.children) setMatrixFrozen(c, frozen);
}

/**
 * The per-frame joint driver — mounted by <Figure> ONLY while it animates
 * (quality 'high' AND motion allowed). A STATIC figure (quality 'low' or
 * reduced motion — the phone-crowd budget knob) simply doesn't render this
 * child, so it registers NO `useFrame`: a room of baked seated guests costs
 * ZERO frame-callback subscriptions instead of one no-op subscriber apiece.
 * (The instanced seated crowd removes the many; this removes the few that stay
 * individual — photo seats, the viewer's own figure.) Splitting the loop into
 * a child keeps the subscription rules-of-hooks-clean: this component always
 * calls `useFrame`; <Figure> just conditionally MOUNTS it.
 *
 * Owns all the smoothing state (it's the only reader): the frame-rate-
 * independent preset blend so sit→stand→walk eases instead of popping, plus the
 * reused per-figure pose buffers that avoid per-frame record allocation.
 */
function FigureFrameDriver({
  groups,
  pose,
  phase,
  specId,
  idleClip,
}: {
  groups: React.MutableRefObject<JointGroups>;
  pose: FigurePoseName;
  phase: number | React.MutableRefObject<number>;
  specId: string;
  idleClip?: StaffIdleKind;
}) {
  const cur = useRef<Pose | null>(null);
  const from = useRef<Pose | null>(null);
  const blend = useRef(1);
  const prevPose = useRef<FigurePoseName>(pose);
  const targetBuf = useRef<Pose>({ ...ZERO_POSE });
  const swayBuf = useRef<Partial<Pose>>({});
  const jellyBuf = useRef<JellyScale>({ y: 1, xz: 1 });
  // Live squash/stretch amplitudes — damped toward the pose's GAIT_SQUASH
  // targets (or 0) each frame; see the jelly block at the bottom of the loop.
  // A driver that MOUNTS mid-gait (the SitController arrival handoff, where a
  // fresh Figure takes over a walker frozen mid-run) starts at the gait's
  // settled amplitudes — starting from 0 would un-squash the torso in one
  // frame, the scale half of the very snap the handoff fix removes.
  const jellyAmp = useRef(
    pose === 'walk' || pose === 'run' ? { ...GAIT_SQUASH[pose] } : { squash: 0, stretch: 0 },
  );

  useFrame(({ clock }, delta) => {
    const ph = typeof phase === 'number' ? phase : phase.current;
    // Walk/run take the raw cycle (phase is already continuous + frame-rate
    // independent at the caller); stand/sit layer the per-id idle life on top.
    const target =
      pose === 'walk'
        ? walkCyclePose(ph, targetBuf.current)
        : pose === 'run'
          ? runCyclePose(ph, targetBuf.current)
          : pose === 'dance'
            ? // Tap-the-dance-floor: the looping dance clip layered over the
              // stand base — same additive composition, same wall-clock time base
              // as idleSway/staffIdle. The walk→dance / dance→walk preset switch
              // eases through the generic blend below (no special-casing).
              overlayPose(STAND_BASE, dancePose(specId, clock.elapsedTime, swayBuf.current), targetBuf.current)
            : overlayPose(
                pose === 'sit' ? SIT_BASE : STAND_BASE,
                // Booth staff swap the guests' idleSway for their job's clip —
                // same additive-overlay composition, same wall-clock time base.
                idleClip && pose === 'stand'
                  ? staffIdle(idleClip, specId, clock.elapsedTime, swayBuf.current)
                  : idleSway(specId, clock.elapsedTime, swayBuf.current),
                targetBuf.current,
              );
    if (!cur.current || !from.current) {
      cur.current = { ...target };
      from.current = { ...target };
    }
    if (prevPose.current !== pose) {
      // Preset switched — blend from wherever the joints ARE right now.
      prevPose.current = pose;
      from.current = { ...cur.current };
      blend.current = 0;
    }
    // ~0.2% of the transition left after one second — settles in ≈⅓ s.
    blend.current += (1 - blend.current) * damp(0.002, delta);
    const b = blend.current;
    const c = cur.current;
    const f = from.current;
    for (const j of JOINTS) c[j] = f[j] + (target[j] - f[j]) * b;
    applyPose(groups.current, c);
    // Jelly squash-&-stretch: the squash/stretch AMPLITUDES are damped toward
    // the current pose's targets (zero when not gaited) with the same
    // frame-rate-independent ⅓ s settle as the joint blend — so walk→run
    // deepens the jelly smoothly, and a figure that stops mid-squash relaxes
    // to neutral instead of popping in one frame. At rest the amplitudes decay
    // to ~0 and the torso holds 1,1,1 (jellySquash(ph, 0, 0) is exactly 1).
    const torso = groups.current.torso;
    if (torso) {
      const jt = pose === 'walk' || pose === 'run' ? GAIT_SQUASH[pose] : null;
      const amp = jellyAmp.current;
      const k = damp(0.002, delta);
      amp.squash += ((jt?.squash ?? 0) - amp.squash) * k;
      amp.stretch += ((jt?.stretch ?? 0) - amp.stretch) * k;
      const jelly = jellySquash(ph, amp.squash, amp.stretch, jellyBuf.current);
      torso.scale.set(jelly.xz, jelly.y, jelly.xz);
    }
  });

  return null;
}

/**
 * <Figure> — one articulated guest. Position/heading are the PARENT's job
 * (exactly like today's tokens: the Walker group moves, the token dresses),
 * so existing walk/roam/seat plumbing needs no changes to adopt it.
 *
 * Memoised: specs are stable per guest at every call site (the demo's
 * figureSpecs map, the lab's per-guest token memo), so crowd-wide re-renders
 * triggered by walker/mover state changes bail out here instead of
 * re-reconciling ~26 R3F elements per figure.
 */
export const Figure = memo(function Figure({
  spec,
  pose = 'stand',
  phase = 0,
  quality = 'high',
  name,
  idleClip,
  castShadow: castShadowProp,
}: FigureProps) {
  const reduced = usePrefersReducedMotion();
  // Static mode: bake once, never animate. Reduced motion and quality 'low'
  // both bake; an idle clip bakes to its held t=0 pose (see FigureProps).
  const staticMode = quality === 'low' || reduced;
  const rootRef = useRef<THREE.Group>(null);

  const groups = useRef<JointGroups>({
    pelvis: null,
    torso: null,
    head: null,
    lShoulder: null,
    rShoulder: null,
    lElbow: null,
    rElbow: null,
    lHip: null,
    rHip: null,
    lKnee: null,
    rKnee: null,
  });

  // Snapshot of a number-typed phase for the static bake (a ref-typed phase
  // is read imperatively and deliberately does NOT re-trigger the effect).
  const staticPhase = typeof phase === 'number' ? phase : 0;

  // Static bake: apply the preset once per (pose, mode) change. Reduced-motion
  // walkers hold a neutral stand (a frozen mid-stride reads like a glitch, and
  // the parent still moves them — the flow completes); quality-'low' walkers
  // keep a baked stride sample so a paused crowd still reads as "in motion".
  useEffect(() => {
    if (!staticMode) return;
    const p =
      pose === 'sit'
        ? SIT_BASE
        : pose === 'walk' || pose === 'run'
          ? reduced
            ? STAND_BASE
            : (pose === 'run' ? runCyclePose : walkCyclePose)(typeof phase === 'number' ? phase : phase.current)
          : pose === 'dance'
            ? // Static dancer (reduced motion OR quality 'low'): hold the
              // dance clip's t=0 pose — a paused dancer, arms raised, still
              // reads as dancing, and the tap-to-dance flow completes without
              // motion (the figure still walked ONTO the floor to get here).
              overlayPose(STAND_BASE, dancePose(spec.id, 0))
            : idleClip
              ? // Static staff (reduced motion OR quality 'low'): hold the
                // clip's t=0 pose — a barista frozen mid-tamp still reads
                // as a barista, and the booth flow completes without motion.
                overlayPose(STAND_BASE, staffIdle(idleClip, spec.id, 0))
              : STAND_BASE;
    applyPose(groups.current, p);
    // A driver that unmounted mid-gait leaves the torso at its last jelly
    // squash — a baked figure must hold the neutral body, or the matrix
    // freeze below would capture the squashed scale forever.
    groups.current.torso?.scale.set(1, 1, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticMode, pose, reduced, staticPhase, idleClip, spec.id]);

  // PERF (declared AFTER the bake effect so the freeze captures the baked
  // pose): while static, stop three recomposing the figure's local matrices
  // every frame; re-enable the moment the figure animates again. Runs on
  // every commit — re-renders of a baked figure are rare and the traversal is
  // ~26 nodes, so re-freezing (which also picks up any prop-driven transform
  // change) is cheaper than tracking exact dependencies.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    setMatrixFrozen(root, staticMode);
  });

  // 2026-07-08 AVATAR PIVOT: one blank glossy body material for everything —
  // white by default, tintable via the spec's outfitColor (flat colour slate).
  const bodyMat = mannequinMaterial(spec.outfitColor);

  // Shell placement: the re-proportioned lathe shells (2026-07-08 silhouette
  // pass) are authored directly in torso space — collar at ≈0.50, waist,
  // hips, hem — so they mount at the origin, unscaled. The old cone-era
  // shellY/stretch compensation is gone with the cones.

  // PERF — the other half of the crowd budget knob: a quality-'low' figure
  // (the >60-guest crowd, the phone walk's seated room) doesn't submit its
  // ~12 meshes to the shadow depth pass. The old 2-mesh tokens cost 2 shadow
  // casters each; a kit crowd at 12 apiece doubled-plus the shadow pass on
  // exactly the devices 'low' exists for. Ground contact still reads — the
  // room, tables and 'high' figures keep casting. An explicit prop wins
  // (booth staff stay shadowless at every quality).
  const castShadow = castShadowProp ?? quality !== 'low';

  return (
    <group ref={rootRef} scale={spec.scale ?? 1}>
      {/* Per-frame joints ONLY while animating — a static (baked) figure never
          mounts the driver, so it holds zero useFrame subscriptions. */}
      {staticMode ? null : (
        <FigureFrameDriver groups={groups} pose={pose} phase={phase} specId={spec.id} idleClip={idleClip} />
      )}
      {/* Status colour, the existing ring convention: the selfie path gets it
          on the GuestPhotoAvatar disc; a drawn face gets a floor ring. Booth
          STAFF pass an empty statusColor — they have no RSVP status, so no
          ring renders (2026-07-08 booth kit). */}
      {!spec.photoUrl && spec.statusColor ? (
        <mesh
          geometry={STATUS_RING_GEO}
          material={statusRingMaterial(spec.statusColor)}
          rotation={[STATUS_RING_ROT_X, 0, 0]}
          position={[0, STATUS_RING_POS_Y, 0]}
        />
      ) : null}

      <group ref={(el) => void (groups.current.pelvis = el)} position={[0, PELVIS_Y, 0]}>
        {/* ── Legs: hip → knee. Thigh meshes hide under a skirted shell. ──
            2026-07-08 leg pass (owner: "the 2 oblong look for the legs"): a
            HIP BLOCK joins the leg tops so trousers read as one garment, the
            stance narrows, and every visible leg ends in a SHOE — the two
            floating capsules become a person standing in shoes. */}
        <mesh geometry={HIP_GEO} material={bodyMat} position={[0, HIP_BLOCK_Y, 0]} castShadow={castShadow} />
        {[-1, 1].map((side) => (
          <group
            key={side}
            ref={(el) => void (groups.current[side < 0 ? 'lHip' : 'rHip'] = el)}
            position={[side * HIP_X, 0, 0]}
          >
            <mesh
              geometry={LEG_GEO}
              material={bodyMat}
              position={[0, -THIGH_LEN / 2, 0]}
              scale={[THIGH_SCALE_XZ, THIGH_SCALE_Y, THIGH_SCALE_XZ]}
              castShadow={castShadow}
            />
            {/* Hip joint-blend ball — fills the groin crease when the hip folds
                (seated); hides inside the hip block + thigh when standing. */}
            <mesh
              geometry={JOINT_GEO}
              material={bodyMat}
              scale={[HIP_BALL_R, HIP_BALL_R, HIP_BALL_R]}
              castShadow={castShadow}
            />
            <group
              ref={(el) => void (groups.current[side < 0 ? 'lKnee' : 'rKnee'] = el)}
              position={[0, -THIGH_LEN, 0]}
            >
              <mesh
                geometry={LEG_GEO}
                material={bodyMat}
                position={[0, -SHIN_LEN / 2, 0]}
                scale={[SHIN_SCALE_XZ, SHIN_SCALE_Y, SHIN_SCALE_XZ]}
                castShadow={castShadow}
              />
              {/* Knee joint-blend ball — the bent knee reads as one smooth
                  tube instead of two capsules pinching (balloon twist). */}
              <mesh
                geometry={JOINT_GEO}
                material={bodyMat}
                scale={[KNEE_BALL_R, KNEE_BALL_R, KNEE_BALL_R]}
                castShadow={castShadow}
              />
              {/* Rounded leg stump — the one-piece blob has no feet; it still
                  swings with the knee group so the gait reads. */}
              <mesh
                geometry={SHOE_GEO}
                material={bodyMat}
                position={[0, SHOE_POS_Y, SHOE_POS_Z]}
                scale={[SHOE_SCALE_X, SHOE_SCALE_Y, SHOE_SCALE_Z]}
                castShadow={castShadow}
              />
            </group>
          </group>
        ))}

        {/* ── Torso: the blank plump mannequin body (2026-07-08 avatar pivot —
            no wardrobe, no shells) + arms + head ride the lean/sway together. ── */}
        <group ref={(el) => void (groups.current.torso = el)}>
          <mesh geometry={MANNEQUIN_TORSO_GEO} material={bodyMat} castShadow={castShadow} />

          {/* ── Arms: shoulder → elbow. ── */}
          {[-1, 1].map((side) => (
            <group
              key={side}
              ref={(el) => void (groups.current[side < 0 ? 'lShoulder' : 'rShoulder'] = el)}
              position={[side * SHOULDER_X, SHOULDER_Y, 0]}
            >
              <mesh
                geometry={ARM_GEO}
                material={bodyMat}
                position={[0, -UPPER_ARM_LEN / 2, 0]}
                scale={[UPPER_ARM_SCALE_XZ, UPPER_ARM_SCALE_Y, UPPER_ARM_SCALE_XZ]}
                castShadow={castShadow}
              />
              {/* Shoulder joint-blend ball — a soft deltoid that keeps the
                  swinging arm attached to the torso (no armpit gap). */}
              <mesh
                geometry={JOINT_GEO}
                material={bodyMat}
                scale={[SHOULDER_BALL_R, SHOULDER_BALL_R, SHOULDER_BALL_R]}
                castShadow={castShadow}
              />
              <group
                ref={(el) => void (groups.current[side < 0 ? 'lElbow' : 'rElbow'] = el)}
                position={[0, -UPPER_ARM_LEN, 0]}
              >
                <mesh
                  geometry={ARM_GEO}
                  material={bodyMat}
                  position={[0, -FOREARM_LEN / 2, 0]}
                  scale={[FOREARM_SCALE_XZ, FOREARM_SCALE_Y, FOREARM_SCALE_XZ]}
                  castShadow={castShadow}
                />
                {/* Elbow joint-blend ball — smooth bent-elbow bend. */}
                <mesh
                  geometry={JOINT_GEO}
                  material={bodyMat}
                  scale={[ELBOW_BALL_R, ELBOW_BALL_R, ELBOW_BALL_R]}
                  castShadow={castShadow}
                />
              </group>
            </group>
          ))}

          {/* ── Head: selfie disc OR the blank ball head. The photo path
              REPLACES the head sphere (the pre-kit token treatment): the disc
              is a transparent billboard, so an opaque sphere behind it would
              win the depth test and blank the photo across its whole
              silhouette. The no-photo branch is a single featureless sphere —
              no face, no hair (the one-piece blob, owner-locked). ── */}
          <group ref={(el) => void (groups.current.head = el)} position={[0, NECK_Y, 0]}>
            <group position={[0, HEAD_LIFT, 0]}>
              {spec.photoUrl ? (
                // The shared billboard disc (refcounted texture cache, initials
                // fallback), ringed in the status colour — it never casts a
                // shadow (GuestPhotoAvatar already doesn't). The wrapper group
                // is flagged so the static-bake matrix freeze skips the
                // billboard, which must keep re-orienting to the camera.
                <group userData={{ kitKeepAutoMatrix: true }}>
                  <GuestPhotoAvatar
                    photoUrl={spec.photoUrl}
                    name={name ?? spec.id}
                    ringColor={spec.statusColor}
                    height={0.02}
                    radius={0.16}
                  />
                </group>
              ) : (
                // 2026-07-08 avatar pivot: the blank featureless head — no
                // face, no hair. Pure silhouette (the owner's blueprint).
                <mesh geometry={HEAD_GEO} material={bodyMat} castShadow={castShadow} />
              )}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
});

/** A figure seated on a chair — position it at the chair centre, facing the
 *  table, exactly where today's SeatedAvatar/GuestToken goes. */
export function SeatedFigure(props: Omit<FigureProps, 'pose'>) {
  return <Figure {...props} pose="sit" />;
}

/** A figure mid-walk — drop inside a moving group (the demo Walker, the lab
 *  MoverToken) and feed its walk clock through `phase`. */
export function WalkingFigure(props: Omit<FigureProps, 'pose'>) {
  return <Figure {...props} pose="walk" />;
}
