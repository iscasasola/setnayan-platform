/**
 * Setnayan · Guest Stories — camera-move engine (Tier 1)
 * Spec: 02_Specifications/14_Music_Catalogue_Cowork_Playbook.md §16.9
 *
 * Deterministic, render-target-agnostic. The SAME pure functions drive:
 *   - the §16.8 Phase-1 in-browser live preview (CSS transform / SVG)
 *   - the §16.8 Phase-2 client render (Canvas / WebCodecs)
 *   - a future server render (Remotion / FFmpeg), if ever added
 *
 * No per-render AI. No external call. Tier 1 (the move) costs ₱0 per render.
 * Tiers 2-3 (auto_reframe + parallax depth) only enrich the INPUTS below
 * (a subject center + a per-photo depth value), both computed once at ingest.
 */

export type MoveType =
  | 'push_in' | 'pull_out'
  | 'pan_l' | 'pan_r' | 'pan_u' | 'pan_d'
  | 'roll_cw' | 'roll_ccw'
  | 'orbit_feel';

export type Ease = 'linear' | 'in_out' | 'accel';

export interface CameraMove {
  type: MoveType;
  amount: number;        // 0..1 — how far the move travels over the slot's hold
  ease?: Ease;           // default 'in_out'
  auto_reframe?: boolean; // Tier 2 — keep the detected subject centered
  parallax?: 'none' | 'subtle' | 'strong'; // Tier 3 — needs a depth map
}

/** A uniform 2D camera transform, in viewBox/source units. Apply about the frame center. */
export interface Transform { scale: number; tx: number; ty: number; rot: number; }

const BASE_OVERSCAN = 1.16; // hides edges so pan/roll never reveal the frame border

export function applyEase(p: number, ease: Ease = 'in_out'): number {
  const t = Math.max(0, Math.min(1, p));
  if (ease === 'linear') return t;
  if (ease === 'accel') return t * t;
  return t * t * (3 - 2 * t); // in_out (smoothstep)
}

/**
 * The camera at progress p in [0,1]. Pure: same inputs -> same transform, every render.
 * `amount` scales the magnitude; the constants are the tuned "tasteful" envelope.
 */
export function cameraAt(move: CameraMove, p: number): Transform {
  const a = Math.max(0, Math.min(1, move.amount));
  const e = applyEase(p, move.ease);
  let scale = BASE_OVERSCAN, tx = 0, ty = 0, rot = 0;

  switch (move.type) {
    case 'push_in':  scale = BASE_OVERSCAN + e * a * 0.34; break;
    case 'pull_out': scale = BASE_OVERSCAN + (1 - e) * a * 0.34; break;
    case 'pan_l':    scale = 1.20; tx = (e - 0.5) * a * 84; break;
    case 'pan_r':    scale = 1.20; tx = (0.5 - e) * a * 84; break;
    case 'pan_u':    scale = 1.20; ty = (e - 0.5) * a * 84; break;
    case 'pan_d':    scale = 1.20; ty = (0.5 - e) * a * 84; break;
    case 'roll_cw':  scale = 1.22; rot = (e - 0.5) * a * 7; break;
    case 'roll_ccw': scale = 1.22; rot = (0.5 - e) * a * 7; break;
    case 'orbit_feel': // push_in + small pan + small roll — the "circling" illusion
      scale = BASE_OVERSCAN + e * a * 0.20;
      tx = (0.5 - e) * a * 48;
      rot = (e - 0.5) * a * 3.4;
      break;
  }
  return { scale, tx, ty, rot };
}

/**
 * Tier 3 — per-layer depth parallax. `depth` in [0 (far) .. 1 (near)].
 * Near layers translate more and scale slightly faster -> 2.5D separation.
 * With strength 0 this is the identity (pure Tier-1 rigid move).
 */
export function depthAdjust(
  cam: Transform, depth: number, strength: number,
): Transform {
  if (strength <= 0) return cam;
  const txMul = 0.55 + depth * 0.95 * strength;        // far ~0.55x, near ~1.5x
  const scaleF = 1 + (depth - 0.5) * 0.14 * strength;  // near grows faster on push-in
  return { scale: cam.scale * scaleF, tx: cam.tx * txMul, ty: cam.ty * (txMul), rot: cam.rot };
}

/** `parallax` enum -> strength scalar. */
export function parallaxStrength(p: CameraMove['parallax']): number {
  return p === 'strong' ? 1 : p === 'subtle' ? 0.5 : 0;
}

/**
 * Beat-sync zoom punch (= §16.4 downbeat_accent:"zoom_punch").
 * Returns a transient scale >= 1 that decays over `decayMs` after each downbeat.
 * Compose by multiplying into Transform.scale. amountPct default 4.5%.
 */
export function beatPunch(
  tSec: number, bpm: number, decayMs = 180, amountPct = 0.045,
): number {
  const beatSec = 60 / bpm;
  const since = tSec % beatSec;
  const env = since < decayMs / 1000 ? 1 - since / (decayMs / 1000) : 0;
  return 1 + env * amountPct;
}

/**
 * Build the final CSS/SVG transform string about a center (cx, cy), in source units.
 * Order: pan in screen space, then scale+rotate about the frame center.
 */
export function toSvgTransform(t: Transform, cx: number, cy: number): string {
  return `translate(${t.tx} ${t.ty}) translate(${cx} ${cy}) `
       + `rotate(${t.rot}) scale(${t.scale}) translate(${-cx} ${-cy})`;
}

/**
 * Tasteful default move per slot position — a gentle rotation so a reel varies
 * its camera language without per-slot authoring. The Stories builder calls this
 * when a template's slot doesn't specify its own `cameraMove`.
 */
const DEFAULT_MOVE_CYCLE: MoveType[] = [
  'push_in', 'orbit_feel', 'pan_r', 'push_in', 'roll_cw', 'orbit_feel',
];

export function defaultMoveForIndex(i: number): MoveType {
  const n = DEFAULT_MOVE_CYCLE.length;
  return DEFAULT_MOVE_CYCLE[((i % n) + n) % n] ?? 'push_in';
}

export function defaultCameraMove(i: number, amount = 0.55): CameraMove {
  return {
    type: defaultMoveForIndex(i),
    amount,
    ease: 'in_out',
    auto_reframe: true,
    parallax: 'subtle',
  };
}
