/**
 * kit/hair-cap — six hair caps for the mannequin rig's head (Heritage style).
 * Sphere sections hugging HEAD_GEO, one per `FigureSpec.hairStyle` index
 * (0 … HAIR_STYLE_COUNT − 1): coverage grows from a short crop to a long
 * fall. Procedural, CSP-safe, cached per style, shared — never disposed.
 */
import * as THREE from 'three';
import { HAIR_STYLE_COUNT } from '@/lib/figure-rig';

const HEAD_R = 0.16; // kit/figure.tsx HEAD_R — the head the caps sit on
const R = HEAD_R * 1.045;

/** [thetaLength, yLift, backTilt] per style — crown coverage, how high it sits,
 *  and a small backward roll so the fringe clears the brow. */
const CAPS: readonly (readonly [number, number, number])[] = [
  [0.48 * Math.PI, 0.005, 0.0], // 0 · crop
  [0.55 * Math.PI, 0.004, 0.06], // 1 · short
  [0.62 * Math.PI, 0.003, 0.1], // 2 · side-swept
  [0.7 * Math.PI, 0.002, 0.16], // 3 · bob
  [0.8 * Math.PI, 0.0, 0.22], // 4 · shoulder
  [0.92 * Math.PI, -0.004, 0.26], // 5 · long
];

const cache = new Map<number, THREE.BufferGeometry>();

export function hairCapGeometry(style: number): THREE.BufferGeometry {
  const s = ((Math.round(style) % HAIR_STYLE_COUNT) + HAIR_STYLE_COUNT) % HAIR_STYLE_COUNT;
  let g = cache.get(s);
  if (!g) {
    const [theta, lift, tilt] = CAPS[s]!;
    g = new THREE.SphereGeometry(R, 24, 14, 0, Math.PI * 2, 0, theta);
    g.rotateX(tilt);
    g.translate(0, lift, 0);
    cache.set(s, g);
  }
  return g;
}
