'use client';

/**
 * kit/figure — the articulated "Sims-like" figure every 3D seat-plan surface
 * will share (owner-locked direction; replaces the cylinder+sphere GuestToken
 * / Walker tokens in a later integration stage). One rig, three poses:
 *
 *   group hierarchy: pelvis → torso → head, with two 2-segment arms
 *   (shoulder→elbow) and two 2-segment legs (hip→knee) hanging off it. Pose
 *   records come VERBATIM from `lib/figure-rig.ts` (pure, unit-tested) — this
 *   file only owns applying them to group rotations and the mesh dressing.
 *
 * BUDGET (why the numbers below): every geometry is a MODULE-SCOPE shared
 * buffer (the lab's GOWN_GEO/SUIT_GEO precedent) — this file owns 4 (arm +
 * leg capsules, head sphere, status ring) and borrows the outfit / hair /
 * face buffers from their kit modules. Meshes per figure: 8 limb segments +
 * torso + head + face decal + 1–2 hair parts + the status ring ≈ 12–13 for a
 * trousered outfit; skirted outfits hide the thigh meshes under the flared
 * shell (→ 10–11). Materials come from keyed module caches, so a 200-guest
 * room shares a handful of GPU programs.
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
 * the skull/face/hair — the same "photo disc replaces the head" treatment the
 * pre-kit tokens used. It must replace, not overlay: the disc is a transparent
 * billboard, so an opaque skull behind it wins the depth test and blanks the
 * photo across the whole silhouette. Without a photo, the drawn face decal
 * (kit/face.ts) curves over the head and the status colour renders as a small
 * floor ring instead.
 */

import { memo, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import {
  standPose,
  walkCyclePose,
  sitPose,
  idleSway,
  staffIdle,
  overlayPose,
  damp,
  JOINTS,
  ZERO_POSE,
  type FigureSpec,
  type Pose,
  type StaffIdleKind,
} from '@/lib/figure-rig';
import { GuestPhotoAvatar } from '@/app/_components/plan3d/guest-avatar';
import { plainMaterial, mannequinMaterial } from './outfits';

// ── Rig proportions (metres, adult at scale 1) ───────────────────────────────
// Sized against the PRODUCT-TRUE furniture: 0.46 m chair seats + 0.74 m
// tables. Standing hip pivot at 0.80 puts the head centre at ≈1.44 (a ~1.56 m
// figure); the sitPose −0.30 m drop lands the hips at ≈0.50 — on the seat —
// with the head at ≈1.14, matching where today's seated photo discs float.
const PELVIS_Y = 0.8;
const HIP_X = 0.062; // narrowed 2026-07-08 leg pass — closes the between-legs gap
const THIGH_LEN = 0.34;
const SHIN_LEN = 0.44;
const SHOULDER_X = 0.165;
const SHOULDER_Y = 0.46;
const UPPER_ARM_LEN = 0.22;
const FOREARM_LEN = 0.2;
const NECK_Y = 0.52;
const HEAD_LIFT = 0.12; // neck pivot → head centre
const HEAD_R = 0.13; // mascot-smooth pass (2026-07-08): a touch larger head reads friendlier

// ── Shared geometry owned by this file (module scope — 4 buffers) ───────────
const ARM_GEO = new THREE.CapsuleGeometry(0.042, 0.14, 6, 14); // native ≈0.224 long · mascot-smooth segments
const ARM_GEO_LEN = 0.224;
const LEG_GEO = new THREE.CapsuleGeometry(0.055, 0.25, 6, 14); // native ≈0.36 long · mascot-smooth segments
const LEG_GEO_LEN = 0.36;
const HEAD_GEO = new THREE.SphereGeometry(HEAD_R, 28, 20); // mascot-smooth: no visible facets on close-ups
const NECK_GEO = new THREE.CylinderGeometry(0.042, 0.048, 0.09, 14); // silhouette pass — collar→head bridge
// 2026-07-08 leg pass: the hip block that joins trousered legs (a squashed
// capsule reads as soft tailoring, not a box) + the shoe nose.
const HIP_GEO = (() => {
  const g = new THREE.CapsuleGeometry(0.095, 0.05, 6, 14);
  g.scale(1.3, 0.66, 1.0);
  return g;
})();
const SHOE_GEO = (() => {
  const g = new THREE.CapsuleGeometry(0.036, 0.055, 6, 12);
  g.rotateX(Math.PI / 2); // long axis forward
  g.scale(1.05, 0.62, 1.15);
  return g;
})();
const STATUS_RING_GEO = new THREE.RingGeometry(0.16, 0.235, 24);
// 2026-07-08 AVATAR PIVOT: the plump featureless mannequin torso — one smooth
// capsule, softly flattened front-to-back. No shells, no wardrobe.
const MANNEQUIN_TORSO_GEO = (() => {
  const g = new THREE.CapsuleGeometry(0.175, 0.22, 10, 24);
  g.scale(1, 1.05, 0.84);
  g.translate(0, 0.27, 0);
  return g;
})();

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

export type FigurePoseName = 'stand' | 'walk' | 'sit';
export type FigureQuality = 'high' | 'low';

type JointGroups = {
  pelvis: THREE.Group | null;
  torso: THREE.Group | null;
  head: THREE.Group | null;
  lShoulder: THREE.Group | null;
  rShoulder: THREE.Group | null;
  lElbow: THREE.Group | null;
  rElbow: THREE.Group | null;
  lHip: THREE.Group | null;
  rHip: THREE.Group | null;
  lKnee: THREE.Group | null;
  rKnee: THREE.Group | null;
};

/**
 * Write a rig-space pose onto the joint groups. The rig convention is
 * "positive = swings forward"; three's +X rotation swings a hanging limb
 * BACKWARD, hence the negations (documented in figure-rig's header).
 */
function applyPose(g: JointGroups, p: Pose): void {
  if (g.pelvis) g.pelvis.position.set(0, PELVIS_Y + p.pelvisY, p.pelvisZ);
  if (g.torso) {
    g.torso.rotation.x = -p.torsoLean;
    g.torso.rotation.z = p.torsoSway;
  }
  if (g.head) {
    g.head.rotation.y = p.headYaw;
    g.head.rotation.x = p.headPitch;
  }
  if (g.lShoulder) g.lShoulder.rotation.x = -p.leftShoulder;
  if (g.rShoulder) g.rShoulder.rotation.x = -p.rightShoulder;
  if (g.lElbow) g.lElbow.rotation.x = -p.leftElbow;
  if (g.rElbow) g.rElbow.rotation.x = -p.rightElbow;
  if (g.lHip) g.lHip.rotation.x = -p.leftHip;
  if (g.rHip) g.rHip.rotation.x = -p.rightHip;
  if (g.lKnee) g.lKnee.rotation.x = -p.leftKnee;
  if (g.rKnee) g.rKnee.rotation.x = -p.rightKnee;
}

export type FigureProps = {
  spec: FigureSpec;
  /** Which figure-rig preset drives the joints. Default 'stand'. */
  pose?: FigurePoseName;
  /**
   * Walk-cycle phase in radians (the demo Walker's existing ~9 rad/s bob
   * clock plugs straight in; freeze it on arrival exactly as today). Pass a
   * ref to advance the gait WITHOUT re-rendering React each frame — the
   * figure reads `.current` inside its own useFrame.
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
   * wall-clock time-based). A clip OVERRIDES the quality-'low' static bake
   * for its ≤3 figures per booth (that knob exists for 60-guest crowds; the
   * shadow-cast saving still applies) — but never reduced motion, which
   * bakes the clip's held t=0 pose so the mascot still reads in-character.
   */
  idleClip?: StaffIdleKind;
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
}: FigureProps) {
  const reduced = usePrefersReducedMotion();
  // Static mode: bake once, never animate. Reduced motion wins over quality
  // AND over an idle clip; a clip un-bakes quality-'low' (see FigureProps).
  const staticMode = (quality === 'low' && !idleClip) || reduced;
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

  // Live joint state for the frame-rate-independent preset blend: on a pose
  // change we snapshot the CURRENT joints and damp toward the new target, so
  // sit→stand→walk transitions ease instead of popping.
  const cur = useRef<Pose | null>(null);
  const from = useRef<Pose | null>(null);
  const blend = useRef(1);
  const prevPose = useRef<FigurePoseName>(pose);

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
        : pose === 'walk'
          ? reduced
            ? STAND_BASE
            : walkCyclePose(typeof phase === 'number' ? phase : phase.current)
          : idleClip
            ? // Reduced-motion staff (the only static path with a clip): hold
              // the clip's t=0 pose — a barista frozen mid-tamp still reads
              // as a barista, and the booth flow completes without motion.
              overlayPose(STAND_BASE, staffIdle(idleClip, spec.id, 0))
            : STAND_BASE;
    cur.current = { ...p };
    applyPose(groups.current, p);
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

  // Reusable per-figure pose buffers — the frame loop writes targets into
  // these instead of allocating 2–3 fresh 15-key records per figure per frame
  // (60 animated guests × 60 fps was ~7k short-lived objects/s of GC churn).
  const targetBuf = useRef<Pose>({ ...ZERO_POSE });
  const swayBuf = useRef<Partial<Pose>>({});

  useFrame(({ clock }, delta) => {
    if (staticMode) return;
    const ph = typeof phase === 'number' ? phase : phase.current;
    // Walk takes the raw cycle (phase is already continuous + frame-rate
    // independent at the caller); stand/sit layer the per-id idle life on top.
    const target =
      pose === 'walk'
        ? walkCyclePose(ph, targetBuf.current)
        : overlayPose(
            pose === 'sit' ? SIT_BASE : STAND_BASE,
            // Booth staff swap the guests' idleSway for their job's clip —
            // same additive-overlay composition, same wall-clock time base.
            idleClip && pose === 'stand'
              ? staffIdle(idleClip, spec.id, clock.elapsedTime, swayBuf.current)
              : idleSway(spec.id, clock.elapsedTime, swayBuf.current),
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
  // room, tables and 'high' figures keep casting.
  const castShadow = quality !== 'low';

  return (
    <group ref={rootRef} scale={spec.scale ?? 1}>
      {/* Status colour, the existing ring convention: the selfie path gets it
          on the GuestPhotoAvatar disc; a drawn face gets a floor ring. Booth
          STAFF pass an empty statusColor — they have no RSVP status, so no
          ring renders (2026-07-08 booth kit). */}
      {!spec.photoUrl && spec.statusColor ? (
        <mesh
          geometry={STATUS_RING_GEO}
          material={statusRingMaterial(spec.statusColor)}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.012, 0]}
        />
      ) : null}

      <group ref={(el) => void (groups.current.pelvis = el)} position={[0, PELVIS_Y, 0]}>
        {/* ── Legs: hip → knee. Thigh meshes hide under a skirted shell. ──
            2026-07-08 leg pass (owner: "the 2 oblong look for the legs"): a
            HIP BLOCK joins the leg tops so trousers read as one garment, the
            stance narrows, and every visible leg ends in a SHOE — the two
            floating capsules become a person standing in shoes. */}
        <mesh geometry={HIP_GEO} material={bodyMat} position={[0, -0.045, 0]} castShadow={castShadow} />
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
              scale={[1.28, THIGH_LEN / LEG_GEO_LEN, 1.28]}
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
                scale={[1.08, SHIN_LEN / LEG_GEO_LEN, 1.08]}
                castShadow={castShadow}
              />
              {/* Foot nub — same blank material (the mannequin has no shoes),
                  still swinging with the knee group. */}
              <mesh
                geometry={SHOE_GEO}
                material={bodyMat}
                position={[0, -SHIN_LEN + 0.03, 0.04]}
                scale={[1.4, 0.75, 1.4]}
                castShadow={castShadow}
              />
            </group>
          </group>
        ))}

        {/* ── Torso: the blank plump mannequin body (2026-07-08 avatar pivot —
            no wardrobe, no shells) + arms + head ride the lean/sway together. ── */}
        <group ref={(el) => void (groups.current.torso = el)}>
          <mesh geometry={MANNEQUIN_TORSO_GEO} material={bodyMat} castShadow={castShadow} />
          <mesh geometry={NECK_GEO} material={bodyMat} position={[0, 0.545, 0]} castShadow={castShadow} />

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
                scale={[1, UPPER_ARM_LEN / ARM_GEO_LEN, 1]}
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
                  scale={[0.88, FOREARM_LEN / ARM_GEO_LEN, 0.88]}
                  castShadow={castShadow}
                />
              </group>
            </group>
          ))}

          {/* ── Head: selfie disc OR skull + drawn face + hair. The photo path
              REPLACES the head meshes (the pre-kit token treatment): the disc
              is a transparent billboard, so an opaque skull sphere behind it
              would win the depth test and blank the photo across its whole
              silhouette — the sphere, face decal and hair only exist on the
              drawn-face branch. ── */}
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
                    radius={0.13}
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
