/**
 * kit/rig-face — a face for the articulated rig's DRESSED figures (Heritage,
 * Blocky). Owner 2026-09-06: the styles needed faces. The rig's look system
 * has carried `faceVariant` (0 … FACE_VARIANT_COUNT − 1) since the blob pivot
 * and nothing read it; the chibi already draws eyes and mouths as small ink
 * decals in head space, +Z forward. So a rig face is the chibi's ink for one
 * of three fixed combos, CLONED and scaled from the chibi head radius to the
 * rig's — one geometry per variant, cached, shared, never disposed.
 *
 * ⚠ The blob keeps no face: figure.tsx mounts this only when a spec carries a
 * look (`skinTone`), the same gate as skin and hair.
 */
import type * as THREE from 'three';
import { chibiFaceInkGeo, CHIBI_HEAD_R } from '@/lib/chibi-geometry';
import { FACE_VARIANT_COUNT } from '@/lib/figure-rig';
import type { ChibiEyes, ChibiMouth } from '@/lib/chibi-config';

/** kit/figure.tsx HEAD_R — the head the face sits on. */
export const RIG_HEAD_R = 0.16;
/** chibi head → rig head. */
export const RIG_FACE_SCALE = RIG_HEAD_R / CHIBI_HEAD_R;

/** The three faces, by `faceVariant`. Marks are left off: at rig scale a
 *  beauty mark is a speck. */
export const RIG_FACE_VARIANTS: readonly (readonly [ChibiEyes, ChibiMouth])[] = [
  ['dots', 'smile'],
  ['happy', 'grin'],
  ['dots', 'soft'],
];

const cache = new Map<number, THREE.BufferGeometry | null>();

export function rigFaceGeometry(faceVariant: number): THREE.BufferGeometry | null {
  const v = ((Math.trunc(faceVariant) % FACE_VARIANT_COUNT) + FACE_VARIANT_COUNT) % FACE_VARIANT_COUNT;
  if (cache.has(v)) return cache.get(v)!;
  const [eyes, mouth] = RIG_FACE_VARIANTS[v] ?? RIG_FACE_VARIANTS[0]!;
  const shared = chibiFaceInkGeo(eyes, mouth, 'none');
  // clone() — the chibi's cache is shared with every mounted chibi and must
  // not be scaled in place.
  const g = shared ? shared.clone().scale(RIG_FACE_SCALE, RIG_FACE_SCALE, RIG_FACE_SCALE) : null;
  cache.set(v, g);
  return g;
}
