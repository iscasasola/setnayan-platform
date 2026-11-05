/**
 * lib/print-ground.ts — WHAT IS UNDER A LINE OF TYPE, and the ink that reads on it.
 *
 * Owner 2026-10-16, on the printed Event pass: *"make everything legible"*.
 * A pass is drawn as a flat list of ops (lib/print-layout.ts); the paper a
 * line sits on is whatever those ops laid down before it — the sheet, a veil
 * over the theme's still, the Poster look's band, the seat pill's tint, the
 * code's white tile. This composites them, in drawing order, at a point.
 *
 * A PHOTO (the theme's still, the couple's poster photo) is not one colour: it
 * is taken at both of its measured extremes (`media.samples` light and dark in
 * lib/invite-themes.ts — the registry's own reading of each theme's picture),
 * so a line counts as legible only if it reads on the lightest AND the darkest
 * part of the picture behind it.
 *
 * Shared by the pass layouts (`settlePassInk`, which deepens a line's ink
 * until it reads) and the measurement that holds them to it
 * (`lib/print-fit-measure.ts`) — one compositor, so the fix and the check
 * cannot disagree. PURE.
 */
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import type { PrintOp } from '@/lib/print-layout';

export type Box = { x: number; y: number; w: number; h: number };
export type RGB = [number, number, number];

/** WCAG 2.x AA for body text. */
export const MIN_CONTRAST = 4.5;

/** Bounds of absolute path data (M L H V Q C A Z — what every layout emits). */
export function pathBounds(d: string): Box | null {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  };
  let cmd = '';
  let buf: number[] = [];
  let cx = 0;
  let cy = 0;
  const flush = () => {
    const C = cmd.toUpperCase();
    if (C === 'A') {
      for (let i = 0; i + 6 < buf.length; i += 7) {
        const r = Math.max(buf[i]!, buf[i + 1]!);
        add(cx - r, cy - r);
        add(cx + r, cy + r);
        cx = buf[i + 5]!;
        cy = buf[i + 6]!;
        add(cx, cy);
      }
    } else if (C === 'H') for (const v of buf) add((cx = v), cy);
    else if (C === 'V') for (const v of buf) add(cx, (cy = v));
    else
      for (let i = 0; i + 1 < buf.length; i += 2) {
        add(buf[i]!, buf[i + 1]!);
        cx = buf[i]!;
        cy = buf[i + 1]!;
      }
    buf = [];
  };
  for (const t of tokens) {
    if (/^[a-zA-Z]$/.test(t)) {
      flush();
      cmd = t;
    } else buf.push(Number(t));
  }
  flush();
  return Number.isFinite(minX) ? { x: minX, y: minY, w: maxX - minX, h: maxY - minY } : null;
}

export function hexRgb(hex: string): RGB {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export function rgbHex(c: RGB): string {
  return `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}
const lin = (c: number) => {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
export const lum = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export function contrastRgb(a: RGB, b: RGB): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
/** `top` laid over `under` at opacity `a` — how the backends composite. */
export const over = (top: RGB, under: RGB, a: number): RGB => [0, 1, 2].map((i) => top[i]! * a + under[i]! * (1 - a)) as RGB;

/** Does this op's shape cover (x, y)? Rects and circles exactly; a filled path by its box. */
function covers(o: PrintOp, x: number, y: number): boolean {
  if (o.t === 'rect' || o.t === 'image') return x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h;
  if (o.t === 'circle') return Math.hypot(x - o.cx, y - o.cy) <= o.r;
  const b = pathBounds(o.d);
  return !!b && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

/**
 * The paper colour(s) under (x, y), composited from every op drawn before
 * `index` that fills it. A photo forks the result into its light and dark extremes.
 */
export function groundsAt(ops: readonly PrintOp[], theme: InviteThemeId, index: number, x: number, y: number): RGB[] {
  const samples = INVITE_THEMES[theme].media?.samples;
  let grounds: RGB[] = [hexRgb('#ffffff')];
  for (let i = 0; i < index; i += 1) {
    const o = ops[i]!;
    if (o.t === 'path' && (o.text || o.mark || o.layer === 'white' || !o.fill)) continue;
    if (o.t === 'circle' && !o.fill) continue;
    if (o.t === 'rect' && (!o.fill || o.dash)) continue;
    if (!covers(o, x, y)) continue;
    if (o.t === 'image') {
      if (o.ref === 'still' || o.ref === 'posterBg') {
        const ext = samples ? [hexRgb(samples.light), hexRgb(samples.dark)] : [hexRgb('#ffffff'), hexRgb('#000000')];
        grounds = ext.map((c) => over(c, grounds[0]!, o.opacity ?? 1));
      }
      continue;
    }
    const fill = hexRgb(o.fill!);
    grounds = grounds.map((g) => over(fill, g, o.opacity ?? 1));
  }
  return grounds;
}

/** Five points of a line's ink box — its middle and four inset corners. */
export function samplePoints(b: Box): Array<[number, number]> {
  return [
    [b.x + b.w / 2, b.y + b.h / 2],
    [b.x + b.w * 0.1, b.y + b.h * 0.3],
    [b.x + b.w * 0.9, b.y + b.h * 0.3],
    [b.x + b.w * 0.1, b.y + b.h * 0.7],
    [b.x + b.w * 0.9, b.y + b.h * 0.7],
  ];
}

/** The lowest contrast `ink` at `opacity` has against any of `grounds`. */
export function worstContrast(ink: RGB, opacity: number, grounds: readonly RGB[]): number {
  let min = Infinity;
  for (const g of grounds) min = Math.min(min, contrastRgb(over(ink, g, opacity), g));
  return min;
}

/**
 * THE LEAST CHANGE THAT READS: the same hue, taken toward black (on a light
 * ground) or white (on a dark one) one step at a time until it reaches
 * `MIN_CONTRAST` on every ground — Classic's gold stays gold, only deeper.
 * Null when no shade of it can (a photo too busy to read type on at all).
 */
export function legibleInk(hex: string, grounds: readonly RGB[], target = MIN_CONTRAST + 0.05): string | null {
  const ink = hexRgb(hex);
  if (worstContrast(ink, 1, grounds) >= target) return hex;
  let best: string | null = null;
  let bestT = Infinity;
  for (const toward of [hexRgb('#000000'), hexRgb('#ffffff')]) {
    for (let t = 0.02; t <= 1.0001; t += 0.02) {
      const c = over(toward, ink, t);
      if (worstContrast(c, 1, grounds) >= target) {
        const hexed = rgbHex(c);
        if (!best || t < bestT) {
          best = hexed;
          bestT = t;
        }
        break;
      }
    }
  }
  return best;
}
