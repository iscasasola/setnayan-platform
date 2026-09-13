/**
 * kit/hair-cap — six hair styles for the mannequin rig's head (Heritage,
 * Blocky), one per `FigureSpec.hairStyle` index (0 … HAIR_STYLE_COUNT − 1).
 *
 * ⚠ THE FIRST VERSION WAS ONE SPHERE SECTION PER STYLE, and the long styles
 * swept the whole head — face included — so a "Long" Heritage guest was a
 * dark ball with no face; and on Blocky the sphere hid INSIDE the box head
 * (owner 2026-09-06: "heritage and blocky's face seem wrong"). Two shapes now:
 *   · round — a CROWN cap (full sweep, down to the brow) plus, for the longer
 *     styles, a DRAPE around the back and sides that leaves the front open:
 *     the sphere's φ sweep starts after the face and ends before it.
 *   · blocky — a rounded-box HELMET sitting on the box head's top, growing
 *     with the style, plus a back panel for the longer styles.
 * Procedural, CSP-safe, cached per (kit, style), shared — never disposed.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { HAIR_STYLE_COUNT } from '@/lib/figure-rig';
import type { RigKit } from './rig-face';

const HEAD_R = 0.16; // kit/figure.tsx HEAD_R
const R = HEAD_R * 1.045;
/** Where the crown cap stops (from the top), in radians — the brow line. */
export const HAIR_CROWN_THETA = 0.46 * Math.PI;
/** The face opening: the drape's φ sweep leaves this much open at the front
 *  (+Z is φ = π/2 on a three.js sphere). Half-angle. */
export const HAIR_FACE_OPENING_HALF = 0.62; // ≈ 71° each side of the nose line
/** [drapeTheta] per style — how far down the back/sides the hair falls
 *  (0 = crown only). */
const DRAPE: readonly number[] = [0, 0, 0.1 * Math.PI, 0.22 * Math.PI, 0.36 * Math.PI, 0.5 * Math.PI];

// Blocky head box: 0.32 × 0.30 × 0.30 (kit/blocky-parts.ts) → top at y = 0.15.
const BOX_W = 0.32, BOX_H = 0.3, BOX_D = 0.3;
/** Helmet slab height per style, and back-panel drop for the longer styles. */
const HELMET_H: readonly number[] = [0.045, 0.06, 0.075, 0.09, 0.1, 0.11];
const BACK_DROP: readonly number[] = [0, 0, 0.04, 0.1, 0.18, 0.26];

const cache = new Map<string, THREE.BufferGeometry>();

function roundHair(style: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [
    new THREE.SphereGeometry(R, 24, 12, 0, Math.PI * 2, 0, HAIR_CROWN_THETA),
  ];
  const drape = DRAPE[style] ?? 0;
  if (drape > 0) {
    // φ runs from just past the face opening, around the back, to just before it.
    const phiStart = Math.PI / 2 + HAIR_FACE_OPENING_HALF;
    const phiLength = Math.PI * 2 - 2 * HAIR_FACE_OPENING_HALF;
    parts.push(new THREE.SphereGeometry(R, 24, 10, phiStart, phiLength, HAIR_CROWN_THETA, drape));
  }
  return parts.length === 1 ? parts[0]! : mergeGeometries(parts, false)!;
}

function blockyHair(style: number): THREE.BufferGeometry {
  const h = HELMET_H[style] ?? 0.06;
  const helmet = new RoundedBoxGeometry(BOX_W + 0.03, h, BOX_D + 0.03, 3, 0.02);
  helmet.translate(0, BOX_H / 2 - 0.01 + h / 2, 0);
  const drop = BACK_DROP[style] ?? 0;
  if (drop <= 0) return helmet;
  const back = new RoundedBoxGeometry(BOX_W + 0.03, drop, 0.05, 3, 0.015);
  back.translate(0, BOX_H / 2 - drop / 2, -(BOX_D / 2 + 0.01));
  return mergeGeometries([helmet, back], false)!;
}

export function hairCapGeometry(style: number, kit: RigKit = 'round'): THREE.BufferGeometry {
  const s = ((Math.round(style) % HAIR_STYLE_COUNT) + HAIR_STYLE_COUNT) % HAIR_STYLE_COUNT;
  const key = `${kit}:${s}`;
  let g = cache.get(key);
  if (!g) {
    g = kit === 'blocky' ? blockyHair(s) : roundHair(s);
    cache.set(key, g);
  }
  return g;
}
