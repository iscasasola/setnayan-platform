/**
 * paintWaxSeal — the deterministic Canvas-2D wax-seal painter (0024 §3 · PR2).
 *
 * The single renderer shared by the candle-stamp MAKER (live preview) and the
 * live guest REVEAL (a one-shot paint on mount). Given the same recipe + die +
 * colour it produces the same pixels — so what the couple mints is exactly what
 * a guest sees. Pure: all per-pour variation comes from `mulberry32(seed)`; no
 * `Math.random` / `Date.now`. Colour recolours from the Mood Board deep accent
 * at render time (₱0). No drop shadow — material only (owner-explicit §1a).
 *
 * The monogram is the STAMP DIE: `buildMarkCanvas` rasterises the couple's mark
 * SVG (or luminance-thresholds a raster upload) into a white-on-transparent
 * silhouette, which the painter presses in as a raised emboss relief. Falls back
 * to the lettered monogram when there's no usable die.
 */

import { mulberry32, type WaxFinish, type WaxSealConfig } from './types';

type RGB = { r: number; g: number; b: number };

function parseHex(hex: string): RGB {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  const n = parseInt(m?.[1] ?? '5c2542', 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function mix(c: RGB, t: RGB, k: number): RGB {
  return { r: c.r + (t.r - c.r) * k, g: c.g + (t.g - c.g) * k, b: c.b + (t.b - c.b) * k };
}
const lighten = (c: RGB, k: number) => mix(c, { r: 255, g: 255, b: 255 }, k);
const darken = (c: RGB, k: number) => mix(c, { r: 0, g: 0, b: 0 }, k);
const rgba = (c: RGB, a = 1) =>
  `rgba(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)},${a})`;

export type PaintOpts = {
  /** The minted recipe, or null → render from default levers seeded by `seed`. */
  config: WaxSealConfig | null;
  /** Prepared die silhouette (white-on-transparent), or null → lettered seal. */
  mark: CanvasImageSource | null;
  /** Lettered fallback, e.g. "A & J". */
  monogramText: string;
  /** Resolved wax colour (hex) — config override ?? Mood Board deep accent. */
  waxColor: string;
  /** Resolved finish — config ?? 'matte'. */
  finish: WaxFinish;
  /** Uniqueness anchor — config.seed ?? a public_id-derived fallback. */
  seed: number;
  /** CSS-pixel diameter. */
  size: number;
  /** devicePixelRatio for crispness. */
  dpr: number;
  /** When false, render just the molten puddle (no impression yet) — the maker
   *  uses this for the pour/cool beats before the stamp is pressed. Default true. */
  pressed?: boolean;
};

/** One tinted copy of the die/letters, for an emboss relief layer. */
function tintedMark(
  mark: CanvasImageSource | null,
  text: string,
  color: string,
  S: number,
  cx: number,
  cy: number,
  scale: number,
  offset: readonly [number, number],
  skew: number,
  R: number,
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const t = c.getContext('2d');
  if (!t) return c;
  t.translate(cx + offset[0] * R * 0.12, cy + offset[1] * R * 0.12);
  t.rotate(skew * 0.08);
  if (mark) {
    const mw = (mark as { width?: number }).width || scale;
    const mh = (mark as { height?: number }).height || scale;
    const k = scale / Math.max(mw, mh);
    t.drawImage(mark, (-mw * k) / 2, (-mh * k) / 2, mw * k, mh * k);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = color;
    t.fillRect(-S, -S, S * 2, S * 2);
  } else {
    t.fillStyle = color;
    t.font = `italic ${Math.round(scale * 0.4)}px Georgia, "Times New Roman", serif`;
    t.textAlign = 'center';
    t.textBaseline = 'middle';
    t.fillText(text || '✦', 0, 0);
  }
  return c;
}

export function paintWaxSeal(ctx: CanvasRenderingContext2D, opts: PaintOpts): void {
  const { config, mark, monogramText, waxColor, finish, seed, size, dpr } = opts;
  const S = Math.max(1, Math.round(size * dpr));
  ctx.clearRect(0, 0, S, S);

  const rnd = mulberry32(seed);
  const wax = parseHex(waxColor);
  const cx = S / 2;
  const cy = S / 2;

  const amount = config?.pour.amount ?? 0.6;
  const irregularity = config?.pour.irregularity ?? 0.3;
  const bubbles = config?.pour.bubbles ?? 0;
  const crispness = config?.press.crispness ?? 0.7;
  const depth = config?.press.depth ?? 0.7;
  const offset = config?.press.offset ?? [0, 0];
  const skew = config?.press.skew ?? 0;

  // ── self-levelled puddle outline (seeded organic blob) ──
  const R = S * 0.3 * (0.86 + amount * 0.28);
  const N = 64;
  const ph1 = rnd() * Math.PI * 2;
  const ph2 = rnd() * Math.PI * 2;
  const ph3 = rnd() * Math.PI * 2;
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const wob =
      1 +
      irregularity * 0.085 * Math.sin(a * 3 + ph1) +
      irregularity * 0.05 * Math.sin(a * 5 + ph2) +
      irregularity * 0.03 * Math.sin(a * 8 + ph3) +
      (rnd() - 0.5) * irregularity * 0.02;
    pts.push([cx + Math.cos(a) * R * wob, cy + Math.sin(a) * R * wob]);
  }
  const puddle = new Path2D();
  const first = pts[0]!;
  const last = pts[N - 1]!;
  puddle.moveTo((first[0] + last[0]) / 2, (first[1] + last[1]) / 2);
  for (let i = 0; i < N; i++) {
    const p = pts[i]!;
    const nxt = pts[(i + 1) % N]!;
    puddle.quadraticCurveTo(p[0], p[1], (p[0] + nxt[0]) / 2, (p[1] + nxt[1]) / 2);
  }
  puddle.closePath();

  ctx.save();
  ctx.clip(puddle);

  // ── puddle body — radial, lit from the upper-left ──
  const g = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.32, R * 0.08, cx, cy, R * 1.18);
  g.addColorStop(0, rgba(lighten(wax, 0.2)));
  g.addColorStop(0.55, rgba(wax));
  g.addColorStop(1, rgba(darken(wax, 0.3)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);

  // ── monogram relief — raised emboss (highlight up-left, shadow down-right,
  //    mid face on top); depth scales with crispness. Skipped pre-press (maker
  //    pour/cool beats show just the molten puddle). ──
  if (opts.pressed !== false) {
    const o = Math.max(1, S * 0.008 * (0.4 + depth));
    const scale = R * 1.5;
    ctx.drawImage(
      tintedMark(mark, monogramText, rgba(lighten(wax, 0.34 * crispness + 0.14)), S, cx, cy, scale, offset, skew, R),
      -o,
      -o,
    );
    ctx.drawImage(
      tintedMark(mark, monogramText, rgba(darken(wax, 0.34 * crispness + 0.08)), S, cx, cy, scale, offset, skew, R),
      o,
      o,
    );
    ctx.drawImage(
      tintedMark(mark, monogramText, rgba(darken(wax, 0.12)), S, cx, cy, scale, offset, skew, R),
      0,
      0,
    );
  }

  // ── overheat micro-bubbles ──
  if (bubbles > 0) {
    const nb = Math.round(bubbles * 8);
    for (let i = 0; i < nb; i++) {
      const a = rnd() * Math.PI * 2;
      const rr = rnd() * R * 0.78;
      const bx = cx + Math.cos(a) * rr;
      const by = cy + Math.sin(a) * rr;
      const br = S * (0.006 + rnd() * 0.01);
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fillStyle = rgba(darken(wax, 0.3), 0.55);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx - br * 0.3, by - br * 0.3, br * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = rgba(lighten(wax, 0.35), 0.7);
      ctx.fill();
    }
  }

  // ── rim bulge — a soft highlight ring just inside the edge (displaced wax) ──
  ctx.lineWidth = S * 0.03;
  ctx.strokeStyle = rgba(lighten(wax, 0.28), 0.45);
  ctx.stroke(puddle);

  // ── sheen — matte = broad soft; glossy = tighter + a specular dot ──
  if (finish === 'glossy') {
    const sg = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.36, R * 0.04, cx - R * 0.18, cy - R * 0.26, R * 0.75);
    sg.addColorStop(0, 'rgba(255,255,255,0.5)');
    sg.addColorStop(0.5, 'rgba(255,255,255,0.08)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, S, S);
    ctx.beginPath();
    ctx.ellipse(cx - R * 0.32, cy - R * 0.4, R * 0.12, R * 0.06, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fill();
  } else {
    const sg = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.44, R * 0.05, cx - R * 0.1, cy - R * 0.2, R * 0.95);
    sg.addColorStop(0, 'rgba(255,255,255,0.16)');
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, S, S);
  }

  ctx.restore();
}

/**
 * Rasterise the couple's monogram into a white-on-transparent silhouette to use
 * as the stamp die. Vector marks → alpha silhouette; raster `<image>` uploads →
 * luminance threshold (dark ink raised). Returns null for no/empty die so the
 * caller falls back to the lettered seal. Client-only (uses Image/canvas).
 */
export async function buildMarkCanvas(
  markSvg: string | null,
  res = 256,
): Promise<HTMLCanvasElement | null> {
  if (!markSvg || typeof document === 'undefined') return null;
  const isRaster = /<image[\s/>]/i.test(markSvg);
  const img = new Image();
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(markSvg)}`;
  const ok = await new Promise<boolean>((resolve) => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
  if (!ok) return null;

  const c = document.createElement('canvas');
  c.width = res;
  c.height = res;
  const t = c.getContext('2d');
  if (!t) return null;

  const iw = img.naturalWidth || res;
  const ih = img.naturalHeight || res;
  const k = Math.min(res / iw, res / ih) * 0.92;
  const dw = iw * k;
  const dh = ih * k;
  t.drawImage(img, (res - dw) / 2, (res - dh) / 2, dw, dh);

  if (isRaster) {
    let data: ImageData;
    try {
      data = t.getImageData(0, 0, res, res);
    } catch {
      return null; // tainted (shouldn't happen for same-origin data URIs)
    }
    const px = data.data;
    let kept = 0;
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i] ?? 0;
      const gch = px[i + 1] ?? 0;
      const b = px[i + 2] ?? 0;
      const a = px[i + 3] ?? 0;
      const lum = (0.299 * r + 0.587 * gch + 0.114 * b) / 255;
      if (a > 12 && lum < 0.62) {
        px[i] = 255;
        px[i + 1] = 255;
        px[i + 2] = 255;
        px[i + 3] = 255;
        kept++;
      } else {
        px[i + 3] = 0;
      }
    }
    if (kept < res * res * 0.002) return null; // near-empty → lettered fallback
    t.putImageData(data, 0, 0);
  } else {
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = '#fff';
    t.fillRect(0, 0, res, res);
  }
  return c;
}
