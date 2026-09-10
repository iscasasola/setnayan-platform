/**
 * chibi-sit — a chibi in a chair, and a room full of them in ~30 draws. PURE.
 *
 * ── THE SIT (rig spec § 9.1 / § 5, owner-locked 2026-07-19) ─────────────────
 * "sit = hips to seat, legs dangle (charming, intended)". The chibi bakes legs,
 * shoes and outfit into merged, jointless buffers — it cannot bend at the hip —
 * and the spec never asked it to: a seated chibi is the STANDING figure lowered
 * so its hem rests on the chair seat, moved forward so the legs hang past the
 * seat's edge. No new geometry; every part buffer is the one the maker draws.
 *
 * ── THE CROWD (chibi-geometry's BATCHING CONTRACT, § 6) ──────────────────────
 * One InstancedMesh per DISTINCT PART BUFFER over a WHITE material, per-guest
 * colour via instanceColor from the SAME `resolveChibiPaint` the individual
 * figure uses — so a seated chibi and the maker's chibi can never drift.
 * Buffers are shared module caches keyed by variant (`buildChibiGeometry`), so
 * grouping by `part.name` groups by geometry identity — asserted in the test.
 *
 * Pure: three.js math only, no React, no fiber — runs under `tsx --test`.
 */
import * as THREE from 'three';
import {
  buildChibiGeometry,
  resolveChibiPaint,
  CHIBI_HEAD_Y,
  CHIBI_OUTFIT_RECIPES,
  type ChibiPart,
} from './chibi-geometry';
import { effectiveChibiColors, type ChibiAvatarConfig, type ChibiOutfit } from './chibi-config';

/** Top surface of a chair seat: `CHAIR_SEAT_Y` (0.46, instanced-chairs.tsx) +
 *  half the seat box's 0.07 height. Pinned to those constants by the test. */
export const CHIBI_SEAT_TOP_Y = 0.495;
/** How far past the chair's centre the figure sits so the legs dangle off the
 *  front edge (seat box is 0.42 deep) instead of through the cushion. */
export const CHIBI_SIT_FORWARD_M = 0.16;

/** The outfit's hem — where the chibi's "hips" are for sitting purposes: the
 *  body lathe ends at y = 0.1 and exposed legs run from there up to
 *  0.1 + legLevel (chibi-geometry OutfitRecipe). */
export function chibiHemY(outfit: ChibiOutfit): number {
  return 0.1 + CHIBI_OUTFIT_RECIPES[outfit].legLevel;
}

export function chibiSitOffset(outfit: ChibiOutfit): { lift: number; forward: number } {
  return { lift: CHIBI_SEAT_TOP_Y - chibiHemY(outfit), forward: CHIBI_SIT_FORWARD_M };
}

const _p = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3(1, 1, 1);
const _sit = new THREE.Matrix4();
const _head = new THREE.Matrix4().makeTranslation(0, CHIBI_HEAD_Y, 0);

/** seat root (from `seatedFigureMatrix`) × the sit offset = the figure root. */
export function chibiSeatRoot(seatMatrix: THREE.Matrix4, outfit: ChibiOutfit, out?: THREE.Matrix4): THREE.Matrix4 {
  const o = chibiSitOffset(outfit);
  _p.set(0, o.lift, o.forward);
  _q.identity();
  _sit.compose(_p, _q, _s);
  return (out ?? new THREE.Matrix4()).multiplyMatrices(seatMatrix, _sit);
}

export type ChibiSeat = { matrix: THREE.Matrix4; config: ChibiAvatarConfig };

export type ChibiCrowdBatch = {
  /** `part.name` — the batch key; same name ⇒ same shared geometry object. */
  key: string;
  geometry: THREE.BufferGeometry;
  roughness: number;
  instances: { matrix: THREE.Matrix4; hex: string }[];
};

/**
 * Group N seated chibis into one batch per distinct part buffer. Head parts
 * ride the figure root at CHIBI_HEAD_Y exactly as `<ChibiFigure>` mounts them.
 * Batch count is bounded by the catalog (≈ parts × variants present), never by
 * guest count — the § 6 promise.
 */
export function chibiCrowdBatches(seats: readonly ChibiSeat[]): ChibiCrowdBatch[] {
  const byKey = new Map<string, ChibiCrowdBatch>();
  const add = (part: ChibiPart, matrix: THREE.Matrix4, hex: string) => {
    let b = byKey.get(part.name);
    if (!b) {
      b = { key: part.name, geometry: part.geometry, roughness: part.roughness, instances: [] };
      byKey.set(part.name, b);
    }
    b.instances.push({ matrix, hex });
  };
  for (const seat of seats) {
    const bundle = buildChibiGeometry(seat.config);
    const colors = effectiveChibiColors(seat.config);
    const root = chibiSeatRoot(seat.matrix, seat.config.outfit);
    const headRoot = new THREE.Matrix4().multiplyMatrices(root, _head);
    for (const part of bundle.body) add(part, root, resolveChibiPaint(part.paint, colors));
    for (const part of bundle.head) add(part, headRoot, resolveChibiPaint(part.paint, colors));
  }
  return [...byKey.values()];
}
