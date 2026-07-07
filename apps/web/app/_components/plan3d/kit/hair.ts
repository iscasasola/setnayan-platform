/**
 * kit/hair — 4–6 procedural hairstyles from shared primitives for the 3D
 * figure kit. Pure data + module-scope geometry (the lab's GOWN_GEO/SUIT_GEO
 * precedent): each style is a small list of parts — a shared BufferGeometry
 * plus a head-local transform — that the renderer maps to meshes coloured by
 * the figure's resolved hair colour. No per-figure geometry allocation, no
 * fetched assets; variety comes entirely from placement + scale of five
 * shared primitives.
 *
 * COORDINATES: head-local, origin at the head-sphere CENTRE (radius 0.12 —
 * `HEAD_R` in kit/figure.tsx), figure facing +Z (the demo Walker's facing
 * convention: rotation.y = heading looks down +Z at heading 0). Hair sits
 * up/back (−Z) so it never occludes the face decal on the +Z hemisphere.
 *
 * STYLE INDEX CONTRACT: `hairPartsFor(i)` for i in 0..HAIR_STYLE_COUNT-1
 * (lib/figure-rig.ts) — resolveFigureLook hands out indices into THIS table,
 * and the deterministic-look promise means entries must never be reordered,
 * only appended (bump HAIR_STYLE_COUNT together).
 */

import * as THREE from 'three';
import { HAIR_STYLE_COUNT } from '@/lib/figure-rig';
import { plainMaterial } from './outfits';

// ── Shared primitives (module scope — one GPU buffer each) ──────────────────

/** Upper-hemisphere-ish cap, slightly proud of the 0.12 head so it reads as
 *  hair over scalp, not a painted head. The base of most styles. */
const CAP_GEO = new THREE.SphereGeometry(0.138, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.56); // mascot head (0.13) + smooth

/** Small sphere — the bun, and (scaled) side volume. */
const BUN_GEO = new THREE.SphereGeometry(0.066, 12, 9);

/** Short capsule — the ponytail tail. */
const TAIL_GEO = new THREE.CapsuleGeometry(0.038, 0.14, 3, 6);

/** Longer capsule — the long-fall sheet, flattened via part scale. */
const LONG_GEO = new THREE.CapsuleGeometry(0.08, 0.2, 3, 8);

/** Faceted icosahedron — the short-spiked crop's choppy read. */
const SPIKE_GEO = new THREE.IcosahedronGeometry(0.135, 1); // one subdivision — choppy but not shard-y

/** One placed primitive of a hairstyle. Rotation in radians (XYZ order). */
export type HairPart = {
  geo: THREE.BufferGeometry;
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  rotation: readonly [number, number, number];
};

const NO_ROT = [0, 0, 0] as const;

/**
 * The style table. Index = the `hairStyle` from resolveFigureLook. Kept to
 * 1–2 parts per style so a full figure stays inside its mesh budget.
 *
 *   0 · crop        — a single close cap
 *   1 · bun         — cap + a bun high on the back of the crown
 *   2 · ponytail    — cap + a tail angled down the back
 *   3 · side part   — two offset caps, the smaller sweeping to one side
 *   4 · short spike — a faceted crown, squashed onto the scalp
 *   5 · long fall   — cap + a flattened sheet down the back
 */
const HAIR_STYLES: readonly (readonly HairPart[])[] = [
  // 0 · crop
  [{ geo: CAP_GEO, position: [0, 0.012, -0.008], scale: [1, 1, 1], rotation: NO_ROT }],
  // 1 · bun
  [
    { geo: CAP_GEO, position: [0, 0.012, -0.008], scale: [1, 0.96, 1], rotation: NO_ROT },
    { geo: BUN_GEO, position: [0, 0.085, -0.105], scale: [1, 1, 1], rotation: NO_ROT },
  ],
  // 2 · ponytail — tail pivots off the back of the crown, hanging down-back.
  [
    { geo: CAP_GEO, position: [0, 0.012, -0.008], scale: [1, 0.98, 1], rotation: NO_ROT },
    { geo: TAIL_GEO, position: [0, -0.02, -0.135], scale: [1, 1, 1], rotation: [0.45, 0, 0] },
  ],
  // 3 · side part — main cap nudged one way, a smaller sweep the other.
  [
    { geo: CAP_GEO, position: [0.014, 0.012, -0.006], scale: [0.98, 0.95, 1], rotation: [0, 0, -0.1] },
    { geo: CAP_GEO, position: [-0.035, 0.028, -0.012], scale: [0.8, 0.75, 0.88], rotation: [0, 0, 0.28] },
  ],
  // 4 · short spike — a squashed faceted crown; the flat icosa faces read as
  // chopped tufts at seat-plan camera distances.
  [{ geo: SPIKE_GEO, position: [0, 0.07, -0.01], scale: [0.95, 0.6, 0.95], rotation: [0, 0.35, 0] }],
  // 5 · long fall — flattened capsule sheet down the nape.
  [
    { geo: CAP_GEO, position: [0, 0.012, -0.008], scale: [1.02, 1, 1.02], rotation: NO_ROT },
    { geo: LONG_GEO, position: [0, -0.1, -0.1], scale: [1.15, 1, 0.5], rotation: [0.12, 0, 0] },
  ],
];

// The rig math promises HAIR_STYLE_COUNT styles; catch a drift at module load
// (a mismatch would send resolved indices out of the table).
if (HAIR_STYLES.length !== HAIR_STYLE_COUNT) {
  throw new Error(
    `kit/hair styles (${HAIR_STYLES.length}) out of sync with HAIR_STYLE_COUNT (${HAIR_STYLE_COUNT})`,
  );
}

/** Parts for a resolved style index. Indices are wrapped defensively (the
 *  resolver already ranges them; a stale caller still gets A hairstyle). */
export function hairPartsFor(style: number): readonly HairPart[] {
  return HAIR_STYLES[Math.abs(Math.trunc(style)) % HAIR_STYLES.length]!;
}

/** Cached hair material per colour — the shared plain-material cache with the
 *  kit's matte finish (hair highlights come from the IBL, not gloss). */
export function hairMaterial(color: string): THREE.MeshStandardMaterial {
  return plainMaterial(color);
}
