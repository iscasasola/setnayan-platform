/**
 * kit/blocky-parts — the BLOCKY KIT (owner 2026-09-06, the third avatar style):
 * the articulated rig's seven body parts as rounded boxes instead of capsules
 * and spheres. Every part keeps the ROUND part's native bounds, so the rig's
 * per-mount positions and scales (THIGH_SCALE_*, HIP_BALL_R, …) apply unchanged
 * and every pose — stand, walk, run, sit, dance, wave — is the same rig, the
 * same clips, the same seat bake. `spec.kit === 'blocky'` selects this table in
 * kit/figure.tsx; nothing else changes.
 *
 * Bounds mirrored from figure.tsx (round → blocky):
 *   arm    capsule r.058 ×.108  → box .116 × .224 × .116
 *   leg    capsule r.075 ×.21   → box .15  × .36  × .15
 *   head   sphere r.16          → box .32  × .30  × .30
 *   joint  UNIT sphere (scaled) → unit box 2 × 2 × 2 (scaled by the ball radius)
 *   hip    capsule ×(1.25,.85,.95) → box .29 × .26 × .22
 *   shoe   sphere r.08          → box .16  × .16  × .16
 *   torso  capsule r.16 ×.24, ×.9 depth, +.27 y → box .34 × .56 × .26 at y .27
 * Procedural, CSP-safe, module-level, shared — never disposed.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type RigParts = {
  arm: THREE.BufferGeometry;
  leg: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  joint: THREE.BufferGeometry;
  hip: THREE.BufferGeometry;
  shoe: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
};

export const RIG_PART_KEYS = ['arm', 'leg', 'head', 'joint', 'hip', 'shoe', 'torso'] as const;

function box(w: number, h: number, d: number, r: number, y = 0): THREE.BufferGeometry {
  const g = new RoundedBoxGeometry(w, h, d, 3, r);
  if (y !== 0) g.translate(0, y, 0);
  return g;
}

export const BLOCKY_PARTS: RigParts = {
  arm: box(0.116, 0.224, 0.116, 0.03),
  leg: box(0.15, 0.36, 0.15, 0.035),
  head: box(0.32, 0.3, 0.3, 0.07),
  joint: box(2, 2, 2, 0.5),
  hip: box(0.29, 0.26, 0.22, 0.06),
  shoe: box(0.16, 0.16, 0.16, 0.04),
  torso: box(0.34, 0.56, 0.26, 0.06, 0.27),
};
