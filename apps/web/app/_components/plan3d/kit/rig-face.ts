/**
 * kit/rig-face — a face for the articulated rig's DRESSED figures (Heritage,
 * Blocky). The chibi's ink decals (eyes + mouth), cloned, scaled from the
 * chibi head to the rig head, and pushed PROUD of whichever head the kit
 * draws — a sphere (round) or a box (blocky).
 *
 * ⚠ THE FIRST VERSION SCALED AND STOPPED. The chibi keeps its own ink just
 * inside its (z-squashed) head sphere and lets the tube thickness poke
 * through; scaled by 0.47 the tubes are 3 mm and nothing pokes through, so
 * on Heritage the whole face vanished inside the sphere and on Blocky only
 * the eyes broke the box's front as two dark holes (owner 2026-09-06:
 * "heritage and blocky's face seem wrong"). The fix is geometric: after
 * scaling, translate so the face's furthest point sits `RIG_FACE_PROUD_M` in
 * front of the head's front surface for THAT kit — a fact the unit suite
 * measures on the bounding box, not a magic number.
 *
 * The blob keeps no face: figure.tsx mounts this only when a spec carries a
 * look (`skinTone`), the same gate as skin and hair.
 */
import type * as THREE from 'three';
import { chibiFaceInkGeo, CHIBI_HEAD_R } from '@/lib/chibi-geometry';
import { FACE_VARIANT_COUNT } from '@/lib/figure-rig';
import type { ChibiEyes, ChibiMouth } from '@/lib/chibi-config';

export type RigKit = 'round' | 'blocky';

/** kit/figure.tsx HEAD_R — the round head the face sits on. */
export const RIG_HEAD_R = 0.16;
/** kit/blocky-parts.ts head box is 0.32 × 0.30 × 0.30 → its front is at z = 0.15. */
export const BLOCKY_HEAD_FRONT_Z = 0.15;
/** chibi head → rig head. */
export const RIG_FACE_SCALE = RIG_HEAD_R / CHIBI_HEAD_R;
/** How far the face's furthest point sits in front of the head surface. */
export const RIG_FACE_PROUD_M = 0.008;

export function rigHeadFrontZ(kit: RigKit): number {
  return kit === 'blocky' ? BLOCKY_HEAD_FRONT_Z : RIG_HEAD_R;
}

/** The three faces, by `faceVariant`. Marks are left off: at rig scale a
 *  beauty mark is a speck. */
export const RIG_FACE_VARIANTS: readonly (readonly [ChibiEyes, ChibiMouth])[] = [
  ['dots', 'smile'],
  ['happy', 'grin'],
  ['dots', 'soft'],
];

const cache = new Map<string, THREE.BufferGeometry | null>();

export function rigFaceGeometry(faceVariant: number, kit: RigKit = 'round'): THREE.BufferGeometry | null {
  const v = ((Math.trunc(faceVariant) % FACE_VARIANT_COUNT) + FACE_VARIANT_COUNT) % FACE_VARIANT_COUNT;
  const key = `${kit}:${v}`;
  if (cache.has(key)) return cache.get(key)!;
  const [eyes, mouth] = RIG_FACE_VARIANTS[v] ?? RIG_FACE_VARIANTS[0]!;
  const shared = chibiFaceInkGeo(eyes, mouth, 'none');
  let g: THREE.BufferGeometry | null = null;
  if (shared) {
    // clone() — the chibi's cache is shared with every mounted chibi and must
    // not be scaled in place.
    g = shared.clone().scale(RIG_FACE_SCALE, RIG_FACE_SCALE, RIG_FACE_SCALE);
    g.computeBoundingBox();
    const maxZ = g.boundingBox!.max.z;
    g.translate(0, 0, rigHeadFrontZ(kit) + RIG_FACE_PROUD_M - maxZ);
    g.computeBoundingBox();
  }
  cache.set(key, g);
  return g;
}
