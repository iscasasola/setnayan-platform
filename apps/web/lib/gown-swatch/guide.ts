/**
 * 👗 GUIDED FABRIC PHOTOS → SLIDER STARTS (gown maker port step B14, DATA SIDE ONLY; corpus INTEGRATION-PLAN v189
 * "6.4c, guided photos"). Pure, in the designer's browser, no network, no AI.
 *
 * Each photo only SUGGESTS where a slider starts; the designer's own slider always wins, and every photo can be
 * skipped (a skipped photo suggests nothing and leaves that slider at the cloth's own value).
 *   · Tilted to the window → Shine: how much brighter the highlight is than the cloth's own tone.
 *   · Over the hand → See-through: how far the cloth's colour moves toward the hand behind it, against the same cloth
 *     on the white card (the flat photo).
 *   · The bend test → Body: asked as three pictures to tap (stands · folds · falls), never read from a photo.
 * Results are offsets from the fabric type's own values (the shop sheet's `tune`), within ±1, rounded to 0.01.
 *
 * ⚠ The thresholds are this port's own judgement (the prototype never built 6.4c); the screens that ask for the
 * photos wait for an approved drawing (coordinator, 28 Nov).
 * 🔒 lib/gown-swatch/guide.test.ts
 */
import type { GownFabricTune } from '../gown-maker';

/** A photo as the browser reads it: RGBA bytes, row by row. */
export type GownPhoto = { data: ArrayLike<number>; width: number; height: number };
export type GownBend = 'stands' | 'folds' | 'falls';

/** The three bend pictures → Body (stiffness, 0 soft … 1 stiff). */
export const GOWN_BEND_BODY: Record<GownBend, number> = { stands: 0.8, folds: 0.5, falls: 0.2 };

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** The centre half of the photo (where the guide asks the cloth to be), every 2nd pixel. */
function centre(p: GownPhoto): number[][] {
  const out: number[][] = [];
  const x0 = Math.floor(p.width / 4), x1 = Math.ceil((p.width * 3) / 4), y0 = Math.floor(p.height / 4), y1 = Math.ceil((p.height * 3) / 4);
  for (let y = y0; y < y1; y += 2) for (let x = x0; x < x1; x += 2) {
    const i = (y * p.width + x) * 4;
    if ((p.data[i + 3] ?? 255) < 8) continue;
    out.push([p.data[i]!, p.data[i + 1]!, p.data[i + 2]!]);
  }
  return out;
}
const quantile = (xs: number[], q: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))] ?? 0;
};
const mean = (px: number[][]) => px.reduce((a, p) => [a[0]! + p[0]!, a[1]! + p[1]!, a[2]! + p[2]!], [0, 0, 0]).map((v) => v / Math.max(1, px.length));

/**
 * Shine from the tilted photo: the brightest 2 % against the cloth's median tone, as a share of the room left above
 * that tone. A matte cloth's top pixels sit near its median (≈ 0); a satin's highlight runs to white (≈ 1).
 */
export function shineFromTilted(p: GownPhoto): number | null {
  const L = centre(p).map(([r, g, b]) => lum(r!, g!, b!));
  if (L.length < 16) return null;
  const med = quantile(L, 0.5);
  const top = quantile(L, 0.98);
  return clamp01((top - med) / Math.max(1, 255 - med));
}

/**
 * See-through from the over-the-hand photo against the flat one: how far the cloth's colour moved toward the hand
 * behind it. `hand` is the bare-hand colour the guide samples beside the cloth (or a typical skin tone when skipped).
 */
export function sheerFromHand(overHand: GownPhoto, flat: GownPhoto, hand: readonly [number, number, number] = [196, 150, 120]): number | null {
  const a = centre(overHand), b = centre(flat);
  if (a.length < 16 || b.length < 16) return null;
  const mh = mean(a), mf = mean(b);
  const toHand = Math.hypot(hand[0] - mf[0]!, hand[1] - mf[1]!, hand[2] - mf[2]!);
  if (toHand < 20) return null; // the cloth is skin-coloured: the photo cannot tell
  const moved = Math.hypot(mh[0]! - mf[0]!, mh[1]! - mf[1]!, mh[2]! - mf[2]!);
  return clamp01(moved / toHand);
}

/** What the type's own values are, as the sliders' starting points. */
export type GownTypeLook = { sheen: number; sheer: number; stiff: number };

/** The readings → offsets from the type (the shop sheet's `tune`), skipping whatever was skipped. */
export function gownTuneFromPhotos(
  type: GownTypeLook,
  readings: { shine?: number | null; sheer?: number | null; bend?: GownBend | null },
): GownFabricTune {
  const off = (v: number, base: number) => Math.max(-1, Math.min(1, Math.round((v - base) * 100) / 100));
  const out: GownFabricTune = {};
  if (readings.shine != null) out.shine = off(readings.shine, type.sheen);
  if (readings.sheer != null) out.sheer = off(readings.sheer, type.sheer);
  if (readings.bend) out.body = off(GOWN_BEND_BODY[readings.bend], type.stiff);
  for (const k of Object.keys(out) as (keyof GownFabricTune)[]) if (out[k] === 0) delete out[k];
  return out;
}
