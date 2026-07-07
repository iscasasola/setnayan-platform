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
 * disc (shared refcounted texture cache — NOT re-implemented here) as the
 * face, ringed in `statusColor`, exactly like today's tokens. Without a
 * photo, the drawn face decal (kit/face.ts) curves over the head and the
 * status colour renders as a small floor ring instead.
 */

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { usePrefersReducedMotion } from '@/lib/use-responsive';
import {
  resolveFigureLook,
  standPose,
  walkCyclePose,
  sitPose,
  idleSway,
  overlayPose,
  damp,
  JOINTS,
  type FigureSpec,
  type Pose,
} from '@/lib/figure-rig';
import { GuestPhotoAvatar } from '@/app/_components/plan3d/guest-avatar';
import {
  outfitGeometry,
  outfitIsSkirted,
  outfitMaterial,
  trouserMaterial,
  plainMaterial,
  SLEEVE_GEO,
} from './outfits';
import { hairPartsFor, hairMaterial } from './hair';
import { FACE_GEO, faceMaterial } from './face';

// ── Rig proportions (metres, adult at scale 1) ───────────────────────────────
// Sized against the PRODUCT-TRUE furniture: 0.46 m chair seats + 0.74 m
// tables. Standing hip pivot at 0.80 puts the head centre at ≈1.44 (a ~1.56 m
// figure); the sitPose −0.30 m drop lands the hips at ≈0.50 — on the seat —
// with the head at ≈1.14, matching where today's seated photo discs float.
const PELVIS_Y = 0.8;
const HIP_X = 0.075;
const THIGH_LEN = 0.34;
const SHIN_LEN = 0.44;
const SHOULDER_X = 0.165;
const SHOULDER_Y = 0.46;
const UPPER_ARM_LEN = 0.22;
const FOREARM_LEN = 0.2;
const NECK_Y = 0.52;
const HEAD_LIFT = 0.12; // neck pivot → head centre
const HEAD_R = 0.12; // matches the lab token head so scale reads unchanged

// ── Shared geometry owned by this file (module scope — 4 buffers) ───────────
const ARM_GEO = new THREE.CapsuleGeometry(0.042, 0.14, 3, 8); // native ≈0.224 long
const ARM_GEO_LEN = 0.224;
const LEG_GEO = new THREE.CapsuleGeometry(0.055, 0.25, 3, 8); // native ≈0.36 long
const LEG_GEO_LEN = 0.36;
const HEAD_GEO = new THREE.SphereGeometry(HEAD_R, 16, 12);
const STATUS_RING_GEO = new THREE.RingGeometry(0.16, 0.235, 24);

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
};

/**
 * <Figure> — one articulated guest. Position/heading are the PARENT's job
 * (exactly like today's tokens: the Walker group moves, the token dresses),
 * so existing walk/roam/seat plumbing needs no changes to adopt it.
 */
export function Figure({ spec, pose = 'stand', phase = 0, quality = 'high', name }: FigureProps) {
  const reduced = usePrefersReducedMotion();
  // Static mode: bake once, never animate. Reduced motion wins over quality.
  const staticMode = quality === 'low' || reduced;

  const look = useMemo(
    () => resolveFigureLook(spec),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spec.id, spec.skinTone, spec.hairStyle, spec.hairColor],
  );

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
          : STAND_BASE;
    cur.current = { ...p };
    applyPose(groups.current, p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staticMode, pose, reduced, staticPhase]);

  useFrame(({ clock }, delta) => {
    if (staticMode) return;
    const ph = typeof phase === 'number' ? phase : phase.current;
    // Walk takes the raw cycle (phase is already continuous + frame-rate
    // independent at the caller); stand/sit layer the per-id idle life on top.
    const target =
      pose === 'walk'
        ? walkCyclePose(ph)
        : overlayPose(pose === 'sit' ? SIT_BASE : STAND_BASE, idleSway(spec.id, clock.elapsedTime));
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

  const skirted = outfitIsSkirted(spec.outfit);
  const outfitGeo = outfitGeometry(spec.outfit);
  const outfitMat = outfitMaterial(spec.outfit, spec.outfitColor);
  const trouserMat = trouserMaterial(spec.outfit, spec.outfitColor);
  const skinMat = plainMaterial(look.skinTone);
  const hairMat = hairMaterial(look.hairColor);
  const hairParts = hairPartsFor(look.hairStyle);
  // Skirted outfits bare the arms + shins (skin); trousered ones sleeve the
  // upper arm in the shell cloth and trouser the whole leg.
  const upperArmMat = skirted ? skinMat : outfitMat;
  const shinMat = skirted ? skinMat : trouserMat;

  // Shell placement: suit/neutral shells hang off the shoulders as authored;
  // the gown shell (0.56 tall, a seated-token asset) is stretched ~1.9× so a
  // STANDING figure's skirt falls to calf length — same silhouette, floor
  // proportions. (The lab's seated gowns never showed legs; the kit keeps
  // shins so a walking gown still shows footfall.)
  const shellY = skirted ? -0.01 : spec.outfit === 'neutral' ? 0.3 : 0.27;
  const shellScale: [number, number, number] = skirted ? [1.05, 1.9, 1.05] : [1, 1, 1];

  return (
    <group scale={spec.scale ?? 1}>
      {/* Status colour, the existing ring convention: the selfie path gets it
          on the GuestPhotoAvatar disc; a drawn face gets a floor ring. */}
      {!spec.photoUrl ? (
        <mesh
          geometry={STATUS_RING_GEO}
          material={statusRingMaterial(spec.statusColor)}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.012, 0]}
        />
      ) : null}

      <group ref={(el) => void (groups.current.pelvis = el)} position={[0, PELVIS_Y, 0]}>
        {/* ── Legs: hip → knee. Thigh meshes hide under a skirted shell. ── */}
        {[-1, 1].map((side) => (
          <group
            key={side}
            ref={(el) => void (groups.current[side < 0 ? 'lHip' : 'rHip'] = el)}
            position={[side * HIP_X, 0, 0]}
          >
            {!skirted ? (
              <mesh
                geometry={LEG_GEO}
                material={trouserMat}
                position={[0, -THIGH_LEN / 2, 0]}
                scale={[1, THIGH_LEN / LEG_GEO_LEN, 1]}
                castShadow
              />
            ) : null}
            <group
              ref={(el) => void (groups.current[side < 0 ? 'lKnee' : 'rKnee'] = el)}
              position={[0, -THIGH_LEN, 0]}
            >
              <mesh
                geometry={LEG_GEO}
                material={shinMat}
                position={[0, -SHIN_LEN / 2, 0]}
                scale={[0.85, SHIN_LEN / LEG_GEO_LEN, 0.85]}
                castShadow
              />
            </group>
          </group>
        ))}

        {/* ── Torso: shell + arms + head ride the lean/sway together. ── */}
        <group ref={(el) => void (groups.current.torso = el)}>
          <mesh geometry={outfitGeo} material={outfitMat} position={[0, shellY, 0]} scale={shellScale} castShadow />

          {/* Filipiniana: the terno's butterfly sleeves — two flattened
              spheres peaking just above the shoulder line. */}
          {spec.outfit === 'filipiniana'
            ? [-1, 1].map((side) => (
                <mesh
                  key={side}
                  geometry={SLEEVE_GEO}
                  material={outfitMat}
                  position={[side * SHOULDER_X, SHOULDER_Y + 0.03, 0]}
                  scale={[1.5, 0.8, 1.05]}
                  castShadow
                />
              ))
            : null}

          {/* ── Arms: shoulder → elbow. ── */}
          {[-1, 1].map((side) => (
            <group
              key={side}
              ref={(el) => void (groups.current[side < 0 ? 'lShoulder' : 'rShoulder'] = el)}
              position={[side * SHOULDER_X, SHOULDER_Y, 0]}
            >
              <mesh
                geometry={ARM_GEO}
                material={upperArmMat}
                position={[0, -UPPER_ARM_LEN / 2, 0]}
                scale={[1, UPPER_ARM_LEN / ARM_GEO_LEN, 1]}
                castShadow
              />
              <group
                ref={(el) => void (groups.current[side < 0 ? 'lElbow' : 'rElbow'] = el)}
                position={[0, -UPPER_ARM_LEN, 0]}
              >
                <mesh
                  geometry={ARM_GEO}
                  material={skinMat}
                  position={[0, -FOREARM_LEN / 2, 0]}
                  scale={[0.88, FOREARM_LEN / ARM_GEO_LEN, 0.88]}
                  castShadow
                />
              </group>
            </group>
          ))}

          {/* ── Head: skull + face (decal or selfie disc) + hair. ── */}
          <group ref={(el) => void (groups.current.head = el)} position={[0, NECK_Y, 0]}>
            <group position={[0, HEAD_LIFT, 0]}>
              <mesh geometry={HEAD_GEO} material={skinMat} castShadow />
              {spec.photoUrl ? (
                // The shared billboard disc (refcounted texture cache, initials
                // fallback) rides just off the face — the disc must NOT cast a
                // shadow (GuestPhotoAvatar already never does).
                <GuestPhotoAvatar
                  photoUrl={spec.photoUrl}
                  name={name ?? spec.id}
                  ringColor={spec.statusColor}
                  height={0.02}
                  radius={0.13}
                />
              ) : (
                <mesh geometry={FACE_GEO} material={faceMaterial(look.faceVariant)} />
              )}
              {hairParts.map((h, i) => (
                <mesh
                  key={i}
                  geometry={h.geo}
                  material={hairMat}
                  position={[h.position[0], h.position[1], h.position[2]]}
                  scale={[h.scale[0], h.scale[1], h.scale[2]]}
                  rotation={[h.rotation[0], h.rotation[1], h.rotation[2]]}
                  castShadow
                />
              ))}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

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
