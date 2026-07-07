'use client';

/**
 * kit/active-chair — the ONE real chair mesh that stands in for a detached
 * InstancedChairs instance during the sit choreography (2026-07-08 slice).
 *
 * An InstancedMesh can't animate a single instance without rewriting its whole
 * buffer every frame, so the sequence is: `detachChair(tableId, seat)`
 * zero-scales the instance and hands back its world transform → this component
 * mounts at that transform → the sit controller animates it (pull back, tuck
 * in) → on handoff the controller unmounts it and `restoreChair` un-hides the
 * instance. For that swap to be invisible, this mesh must be pixel-for-pixel
 * the instanced chair: it REUSES the exported module-scope CHAIR_* buffers
 * (never re-models) and mirrors the instanced composition exactly — chair
 * origin on the floor under the cushion centre, cushion at CHAIR_SEAT_Y,
 * backrest at the CHAIR_BACK_LOCAL offset, yaw = the group's rotation.y (the
 * same backrest-heading convention as `ChairPlacement.faceY`).
 *
 * Colour: the instanced chairs draw a WHITE material tinted per-instance via
 * `instanceColor` (base = the caller's `palette.wall`); a lone mesh needs no
 * instance tint, so the material carries the base colour directly — identical
 * shading, one keyed cached material per (colour, roughness) so repeated sit
 * clips never grow the GPU program count (the statusRingMaterial precedent).
 */

import * as THREE from 'three';
import {
  CHAIR_SEAT_GEO,
  CHAIR_BACK_GEO,
  CHAIR_SEAT_Y,
  CHAIR_BACK_LOCAL,
} from '@/app/_components/plan3d/instanced-chairs';

const chairMats = new Map<string, THREE.MeshStandardMaterial>();
function chairMaterial(color: string, roughness: number): THREE.MeshStandardMaterial {
  const key = `${color}|${roughness}`;
  let m = chairMats.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness });
    chairMats.set(key, m);
  }
  return m;
}

export type ActiveChairProps = {
  /** The controller drives position/rotation through this group ref. */
  ref?: React.Ref<THREE.Group>;
  /** Base chair colour — pass the SAME `palette.wall` the table's
   *  InstancedChairs gets, or the detach/restore swap will flash. */
  color: string;
  /** Match the instanced default (wood-grade 0.6) unless the caller overrode it there too. */
  roughness?: number;
  castShadow?: boolean;
};

/**
 * <ActiveChair> — a single animatable chair, chair-local like one instanced
 * slot: mount it in world space (position = the detached transform's floor
 * point, rotation.y = its yaw) and move the group. Dumb on purpose — the sit
 * controller owns every transform write.
 */
export function ActiveChair({ ref, color, roughness = 0.6, castShadow = true }: ActiveChairProps) {
  const mat = chairMaterial(color, roughness);
  return (
    <group ref={ref}>
      <mesh geometry={CHAIR_SEAT_GEO} material={mat} position={[0, CHAIR_SEAT_Y, 0]} castShadow={castShadow} />
      <mesh
        geometry={CHAIR_BACK_GEO}
        material={mat}
        position={[CHAIR_BACK_LOCAL.x, CHAIR_BACK_LOCAL.y, CHAIR_BACK_LOCAL.z]}
        castShadow={castShadow}
      />
    </group>
  );
}
