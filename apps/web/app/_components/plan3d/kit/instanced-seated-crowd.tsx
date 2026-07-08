'use client';

/**
 * InstancedSeatedCrowd — the seated-crowd draw-call collapse (2026-07-08),
 * modelled on `instanced-chairs.tsx`. The articulated `<Figure pose="sit">`
 * draws ~14 non-instanced meshes PER occupant; three surfaces mount one per
 * occupied seat with no cap/LOD/instancing, so the phone-first public walk hit
 * ~3.2k color-pass draws + ~250 no-op `useFrame` subscribers at 250 pax. Since
 * the sit pose is a CONSTANT (`sitPose()`), every seated figure shares the
 * IDENTICAL baked joint transform — so the whole seated crowd collapses to ONE
 * InstancedMesh per body part (≈14 draws total, +1 for the optional status
 * ring) and ZERO per-figure `useFrame`.
 *
 * PIXEL-IDENTITY (proven in `lib/figure-sit-bake.test.ts`): each instance's
 * matrix = `seat.matrix × bakedLocal[part]`, where `bakedLocal` comes from the
 * SAME rig constants + `applyPose` the individual `<Figure>` uses (single-
 * sourced in `figure-sit-bake`), and each part draws the SAME geometry buffer
 * exported from `figure.tsx`. The shared material is white `MeshStandardMaterial`
 * at the mannequin's roughness/metalness; `setColorAt` drives the outfit tint,
 * and `instanceColor` multiplies over white — so a neutral stranger (white) and
 * a tinted figure both render byte-identically to `mannequinMaterial(tint)`.
 *
 * WHO STAYS INDIVIDUAL (not passed here): figures with a `photoUrl` (the
 * per-guest GuestPhotoAvatar billboard), the viewer's own SELF figure, and any
 * WALKING figure — all still mount as `<Figure>` exactly as before. The caller
 * collects only the neutral-or-tinted, non-photo, non-self, non-walking seated
 * occupants into `seats[]`.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  buildSitBakedLocals,
  instanceColorFor,
  SIT_PART_KEYS,
  type SitPartKey,
} from '@/lib/figure-sit-bake';
import {
  ARM_GEO,
  LEG_GEO,
  HEAD_GEO,
  NECK_GEO,
  HIP_GEO,
  SHOE_GEO,
  MANNEQUIN_TORSO_GEO,
  STATUS_RING_GEO,
  STATUS_RING_POS_Y,
  STATUS_RING_ROT_X,
  type FigureQuality,
} from './figure';

/** One seated occupant to draw via the instanced crowd. */
export type SeatedInstance = {
  /** The figure ROOT world matrix (position + Y-rotation of the seated
   *  figure) — build it with `seatedFigureMatrix` / `seatRootMatrix` from
   *  `lib/figure-sit-bake` so it matches the individual `<Figure>` nesting. */
  matrix: THREE.Matrix4;
  /** Outfit tint (mood-board attire colour). null/invalid → neutral white,
   *  exactly like `mannequinMaterial(null)`. */
  color?: string | null;
  /** RSVP/side status-ring colour. Falsy → no ring for this occupant (its ring
   *  instance is zero-scaled out). Omit on every seat and the ring InstancedMesh
   *  isn't drawn at all (the public walk's ringless neutral crowd). */
  ringColor?: string | null;
};

/** Which shared geometry buffer each baked body part draws. */
const PART_GEO: Record<SitPartKey, THREE.BufferGeometry> = {
  hip: HIP_GEO,
  thighL: LEG_GEO,
  thighR: LEG_GEO,
  shinL: LEG_GEO,
  shinR: LEG_GEO,
  shoeL: SHOE_GEO,
  shoeR: SHOE_GEO,
  torso: MANNEQUIN_TORSO_GEO,
  neck: NECK_GEO,
  upperArmL: ARM_GEO,
  upperArmR: ARM_GEO,
  forearmL: ARM_GEO,
  forearmR: ARM_GEO,
  head: HEAD_GEO,
};

// Module scratch (rendering + layout writes are single-threaded).
const _m = new THREE.Matrix4();
const _color = new THREE.Color();
const _zero = new THREE.Vector3(0, 0, 0);
const _q = new THREE.Quaternion();
const _s0 = new THREE.Vector3(0, 0, 0);

/**
 * <InstancedSeatedCrowd> — draws every seat in `seats[]` as ~14 InstancedMesh
 * body parts (+ an optional ring). Mount it ONCE at the scene root (not per
 * table) with world-space seat matrices, so the entire room's seated crowd is
 * one batch.
 */
export function InstancedSeatedCrowd({
  seats,
  quality = 'high',
  castShadow: castShadowProp,
}: {
  seats: readonly SeatedInstance[];
  /** Mirrors `<Figure>`'s crowd knob: 'low' drops the shadow-caster pass. */
  quality?: FigureQuality;
  /** Explicit shadow override; defaults to the quality rule (only non-'low'
   *  figures cast) — identical to `<Figure>`. */
  castShadow?: boolean;
}) {
  const count = seats.length;
  // The baked sit-pose local matrices — computed once (the pose never varies).
  const baked = useMemo(() => buildSitBakedLocals(), []);
  // Ring local transform (child of the figure root, NOT pose-driven) — matches
  // the individual figure's ring mesh placement.
  const ringLocal = useMemo(() => {
    _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), STATUS_RING_ROT_X);
    return new THREE.Matrix4().compose(
      new THREE.Vector3(0, STATUS_RING_POS_Y, 0),
      _q,
      new THREE.Vector3(1, 1, 1),
    );
  }, []);
  // Only pay for the ring batch when at least one occupant has a status ring
  // (the public walk's neutral strangers have none — save the draw + material).
  const hasRing = useMemo(() => seats.some((s) => Boolean(s.ringColor)), [seats]);

  const castShadow = castShadowProp ?? quality !== 'low';

  // One InstancedMesh ref per part, in SIT_PART_KEYS order, + the ring.
  const meshRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const ringRef = useRef<THREE.InstancedMesh | null>(null);

  useLayoutEffect(() => {
    for (let p = 0; p < SIT_PART_KEYS.length; p++) {
      const mesh = meshRefs.current[p];
      if (!mesh) continue;
      const local = baked[SIT_PART_KEYS[p]!];
      for (let i = 0; i < count; i++) {
        const s = seats[i]!;
        _m.multiplyMatrices(s.matrix, local);
        mesh.setMatrixAt(i, _m);
        mesh.setColorAt(i, instanceColorFor(s.color, _color));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const ring = ringRef.current;
    if (ring) {
      for (let i = 0; i < count; i++) {
        const s = seats[i]!;
        if (s.ringColor) {
          _m.multiplyMatrices(s.matrix, ringLocal);
          ring.setColorAt(i, _color.set(s.ringColor));
        } else {
          // No ring for this occupant — collapse the instance to nothing (the
          // instanced-chairs `removedSeats` treatment: invisible, no shadow).
          _m.compose(_zero, _q.identity(), _s0);
        }
        ring.setMatrixAt(i, _m);
      }
      ring.instanceMatrix.needsUpdate = true;
      if (ring.instanceColor) ring.instanceColor.needsUpdate = true;
    }
  }, [seats, count, baked, ringLocal]);

  if (count === 0) return null;

  return (
    <>
      {SIT_PART_KEYS.map((key, p) => (
        // `key={count}` recreates the InstancedMesh when the occupant count
        // changes (instance count is fixed at construction). `frustumCulled=
        // false` because an InstancedMesh's bounding sphere is its (small,
        // origin-centred) part geometry's — instances span the whole room and
        // would pop out at screen edges (the same decision InstancedChairs made).
        <instancedMesh
          key={`${key}-${count}`}
          ref={(el) => void (meshRefs.current[p] = el)}
          args={[PART_GEO[key], undefined, count]}
          castShadow={castShadow}
          frustumCulled={false}
        >
          <meshStandardMaterial color="#ffffff" roughness={0.18} metalness={0.02} />
        </instancedMesh>
      ))}
      {hasRing ? (
        <instancedMesh
          key={`ring-${count}`}
          ref={ringRef}
          args={[STATUS_RING_GEO, undefined, count]}
          frustumCulled={false}
        >
          {/* Unlit, DoubleSide — identical to the individual figure's
              statusRingMaterial; instanceColor over white keeps the hue true. */}
          <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
        </instancedMesh>
      ) : null}
    </>
  );
}
