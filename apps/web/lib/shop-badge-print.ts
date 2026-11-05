import { loadOtFont, type OtFont } from '@/lib/glyph-path';
import { outlineWords, type OtFace } from '@/lib/logo-fonts';
import { SETNAYAN_MARK_PATH, SETNAYAN_MARK_TRANSFORM, SETNAYAN_MARK_VIEWBOX, setnayanMarkSvg } from '@/lib/qr-style-svg';
import { flattenSvgMark, type FlatMark } from '@/lib/print-mark';
import { scalePath, type PrintOp } from '@/lib/print-layout';
import type { ShopBadge } from '@/lib/shop-badges';
import { TIERS } from '@/lib/badge-tiers';

/**
 * 🖨 THE PILL ON PAPER — the badges as ONE vector file a printer can scale from a calling card to an 8 × 8 ft tarp
 * (owner 2026-10-28: *"we can add this on their tarps?"*). The SAME shape `ShopBadgePill` draws on screen, measured in
 * ems of one size: the mark (or number / ★) in a circle, two tracked lines, a gold-foil edge.
 *
 * 🔑 THE TYPE IS OUTLINED. A print shop's machine does not have Jost; letters as paths print the same everywhere. The
 * outlines come from the hub's own Jost file (`public/logo-fonts/jost.ttf`, already traced into every lambda by
 * `next.config.ts` for the event prints). Jost carries no ✓ or ★, so those two are drawn as shapes.
 *
 * The badges handed in are `badgesForPrint(...)` from facts READ AT PRINT TIME (`/api/vendor/badges`) — nothing here
 * decides what a shop has earned.
 */

export type PrintGround = 'light' | 'white' | 'dark' | 'colour';

const GROUNDS: Record<Exclude<PrintGround, 'colour'>, { bg: string; fg: string; mk: string }> = {
  light: { bg: '#F7F2E8', fg: '#2B2620', mk: '#FFFFFF' },
  white: { bg: '#FFFFFF', fg: '#1E1A12', mk: '#F7F2E8' },
  dark: { bg: '#151312', fg: '#F4EFE6', mk: '#24211E' },
};

const FOIL_STOPS: Array<[number, string]> = [
  [0, '#8a6a2c'],
  [18, '#d9b866'],
  [28, '#f6e7b0'],
  [42, '#b88d3b'],
  [58, '#e9cf86'],
  [74, '#8e6b2b'],
  [100, '#e6c97d'],
];
const GOLD = '#cb9e4b';

let jost: OtFont | null = null;
/** The hub's Jost, loaded once — the door sticker outlines its words with the same face (`lib/door-sticker-print.ts`). */
export function jostFace(): OtFace {
  jost ??= loadOtFont('public/logo-fonts/jost.ttf');
  return jost as unknown as OtFace;
}

const n = (v: number) => String(Math.round(v * 100) / 100);

/** A five-point star of outer radius r centred on (cx, cy). */
function starPath(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${n(cx + rad * Math.cos(a))},${n(cy + rad * Math.sin(a))}`);
  }
  return `M${pts.join('L')}Z`;
}

type Drawn = { svg: string; defs: string; width: number; height: number };

function grad(id: string, stops: readonly string[], w: number, h: number): string {
  return (
    `<linearGradient id="${id}" x1="0" y1="0" x2="${n(w)}" y2="${n(h * 0.47)}" gradientUnits="userSpaceOnUse">` +
    stops.map((c, i) => `<stop offset="${n((i / Math.max(1, stops.length - 1)) * 100)}%" stop-color="${c}"/>`).join('') +
    `</linearGradient>`
  );
}

/** The laurel over the top step's pill — two sprigs, gold. */
function laurelSvg(cx: number, top: number, w: number): string {
  const k = w / 40;
  const t = (x: number, y: number) => `${n(cx + (x - 20) * k)},${n(top + y * k)}`;
  return `<g fill="none" stroke="#d9b866" stroke-width="${n(1.4 * k)}" stroke-linecap="round"><path d="M${t(20, 18)} Q${t(10, 15)} ${t(5, 3)}"/><path d="M${t(20, 18)} Q${t(30, 15)} ${t(35, 3)}"/><path d="M${t(8, 9)} L${t(13, 12)} M${t(6, 5)} L${t(10, 8)} M${t(32, 9)} L${t(27, 12)} M${t(34, 5)} L${t(30, 8)}"/></g>`;
}

/**
 * One pill's GEOMETRY at em size `F`, top-left at (0, 0) — measured ONCE, then drawn two ways: as SVG with its foil
 * gradients (`pill`, the badges file) and as print ops in flat inks (`badgePillOps`, the door sticker's PDF + SVG).
 */
function pillParts(b: ShopBadge, F: number, ground: PrintGround, colour: string) {
  const tier = b.tier ? TIERS.find((t) => t.key === b.tier) ?? null : null;
  const paint = tier ? tier[ground === 'dark' || ground === 'colour' ? 'dark' : 'light'] : null;
  const g = paint
    ? { bg: paint.bg, fg: paint.fg, mk: paint.mk }
    : ground === 'colour'
      ? { bg: colour, fg: '#F2EAD8', mk: 'rgba(255,255,255,0.08)' }
      : GROUNDS[ground];
  const foil = paint !== null || ground === 'dark' || ground === 'colour';
  const glyphInk = paint ? paint.mkc : GOLD;
  const f = jostFace();
  const padY = 0.38 * F;
  const padL = 0.42 * F;
  const padR = 1.15 * F;
  const circle = 2.25 * F;
  const gap = 0.55 * F;
  const H = circle + padY * 2;
  const s1 = 0.82 * F;
  const s2 = 0.68 * F;
  const tick = b.line2.endsWith(' ✓');
  const line2 = tick ? b.line2.slice(0, -2) : b.line2;
  const tx = padL + circle + gap;
  // The two lines as one block, centred on the circle: cap height ≈ 0.7 of the size.
  const block = s1 * 0.7 + 0.32 * F + s2 * 0.7;
  const y1 = H / 2 - block / 2 + s1 * 0.7;
  const y2 = y1 + 0.32 * F + s2 * 0.7;
  const p1 = outlineWords(f, b.line1, tx, y1, s1, 32);
  const p2 = outlineWords(f, line2, tx, y2, s2, 42);
  const b1 = p1.getBoundingBox();
  const b2 = p2.getBoundingBox();
  let textRight = Math.max(b1.x2, b2.x2);
  let tickD: string | null = null;
  if (tick) {
    const tw = s2 * 0.72;
    const x0 = b2.x2 + 0.7 * s2;
    const yb = y2;
    tickD = `M${n(x0)},${n(yb - tw * 0.45)} L${n(x0 + tw * 0.35)},${n(yb)} L${n(x0 + tw)},${n(yb - tw * 0.95)}`;
    textRight = x0 + tw;
  }
  const W = textRight + padR;
  const cx = padL + circle / 2;
  const cy = H / 2;
  type InCircle = { kind: 'mark' } | { kind: 'star'; d: string } | { kind: 'glyph'; d: string };
  let inCircle: InCircle;
  if (b.glyph === null) inCircle = { kind: 'mark' };
  else if (b.glyph === '★') inCircle = { kind: 'star', d: starPath(cx, cy + circle * 0.03, circle * 0.3) };
  else {
    const gs = (b.glyph.length >= 3 ? 0.76 : 0.95) * F;
    const gp = outlineWords(f, b.glyph, 0, 0, gs, 0);
    const gb = gp.getBoundingBox();
    const gp2 = outlineWords(f, b.glyph, cx - (gb.x1 + gb.x2) / 2, cy - (gb.y1 + gb.y2) / 2, gs, 0);
    inCircle = { kind: 'glyph', d: gp2.toPathData(2) };
  }
  return { tier, paint, g, foil, glyphInk, W, H, cx, cy, circle, s2, line1D: p1.toPathData(2), line2D: p2.toPathData(2), tickD, inCircle };
}

/** One pill at em size `F`, top-left at (0, 0). */
function pill(b: ShopBadge, F: number, ground: PrintGround, colour: string, idx: number): Drawn {
  const { tier, paint, g, foil, glyphInk, W, H, cx, cy, circle, s2, line1D, line2D, tickD, inCircle } = pillParts(b, F, ground, colour);
  const tickSvg = tickD
    ? `<path d="${tickD}" fill="none" stroke="${g.fg}" stroke-width="${n(s2 * 0.16)}" stroke-linecap="round" stroke-linejoin="round"/>`
    : '';
  const inCircleSvg =
    inCircle.kind === 'mark'
      ? setnayanMarkSvg(cx, cy, circle * 0.72, GOLD)
      : inCircle.kind === 'star'
        ? `<path d="${inCircle.d}" fill="${GOLD}"/>`
        : `<path d="${inCircle.d}" fill="${glyphInk}"/>`;
  const edgeId = `edge${idx}`;
  const foilId = `foil${idx}`;
  const defs =
    grad(edgeId, paint ? paint.edge : FOIL_STOPS.map(([, c]) => c), W, H) +
    grad(foilId, paint ? paint.foil : FOIL_STOPS.map(([, c]) => c), W, H);
  const svg =
    `<g data-badge="${b.key}"${tier ? ` data-tier="${tier.key}"` : ''}>` +
    `<rect x="0.7" y="0.7" width="${n(W - 1.4)}" height="${n(H - 1.4)}" rx="${n((H - 1.4) / 2)}" fill="${g.bg}" stroke="url(#${edgeId})" stroke-width="1.4"/>` +
    (tier?.laurel ? laurelSvg(W / 2, -0.95 * F, 2.6 * F) : '') +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(circle / 2)}" fill="${g.mk}"/>` +
    inCircleSvg +
    `<path d="${line1D}" fill="${foil ? `url(#${foilId})` : g.fg}"/>` +
    `<path d="${line2D}" fill="${g.fg}"/>` +
    tickSvg +
    `</g>`;
  return { svg, defs, width: W, height: H };
}

/* ── The same pill as print ops (the door sticker) ─────────────────────────────────────────────────────────── */

let markFlat: FlatMark | null = null;
/**
 * The Setnayan mark as outlines, fitted into a `box`-wide square centred on (cx, cy) the way `setnayanMarkSvg` fits
 * it (the whole artwork's view box, so the two read the same). Flattened ONCE from the shipped artwork — never a redraw.
 */
export function setnayanMarkOps(cx: number, cy: number, box: number, fill: string): PrintOp[] {
  markFlat ??= flattenSvgMark(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SETNAYAN_MARK_VIEWBOX}"><path d="${SETNAYAN_MARK_PATH}" transform="${SETNAYAN_MARK_TRANSFORM}"/></svg>`,
  );
  if (!markFlat) throw new Error('[shop-badge-print] the Setnayan mark did not flatten');
  const vb = SETNAYAN_MARK_VIEWBOX.split(/\s+/).map(Number);
  const side = Math.max(vb[2] ?? 1, vb[3] ?? 1);
  const s = box / side;
  const ox = cx - box / 2 - (vb[0] ?? 0) * s;
  const oy = cy - box / 2 - (vb[1] ?? 0) * s;
  return markFlat.parts.map((p) => ({ t: 'path' as const, d: scalePath(p.d, s, ox, oy), fill, evenOdd: p.evenOdd || undefined, mark: true as const }));
}

/** A flat ink a PDF can draw (`#RRGGBB`); a gradient or an `rgba()` falls back to `fallback`. */
function flat(c: string | undefined, fallback: string): string {
  return c && /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
}

/** A pill-shaped outline (a rounded rectangle whose radius is half its height), top-left at (x, y). */
function pillPath(x: number, y: number, w: number, h: number): string {
  const r = h / 2;
  return `M${n(x + r)} ${n(y)}H${n(x + w - r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + w - r)} ${n(y + h)}H${n(x + r)}A${n(r)} ${n(r)} 0 0 1 ${n(x + r)} ${n(y)}Z`;
}

/**
 * 🚪 ONE BADGE as print ops at em size `F`, top-left at (x, y) — the SAME pill the badges file draws (`pillParts`), in
 * flat inks: a sign or sticker printer's PDF has no foil gradient, so the foil edge and the foil "SETNAYAN" print in the
 * foil's own gold. Used by the door sticker (`lib/door-sticker-print.ts`); the badges file keeps its foil.
 */
export function badgePillOps(b: ShopBadge, F: number, x: number, y: number, ground: Exclude<PrintGround, 'colour'> = 'light'): { ops: PrintOp[]; width: number; height: number } {
  const { tier, paint, g, foil, glyphInk, W, H, cx, cy, circle, s2, line1D, line2D, tickD, inCircle } = pillParts(b, F, ground, '#1F3A2C');
  const at = (d: string) => scalePath(d, 1, x, y);
  const edge = flat(paint?.edge[0], GOLD); // the edge's first stop — every tier's darkest, so a pale foil still shows its rim
  const ops: PrintOp[] = [
    { t: 'path', d: pillPath(x + 0.7, y + 0.7, W - 1.4, H - 1.4), fill: flat(g.bg, '#FFFFFF'), stroke: edge, sw: 1.4 },
  ];
  if (tier?.laurel) {
    // The laurel's two sprigs, as the badges file draws them, in the foil's gold.
    const k = (2.6 * F) / 40;
    const t = (px: number, py: number) => `${n(x + W / 2 + (px - 20) * k)},${n(y - 0.95 * F + py * k)}`;
    for (const d of [
      `M${t(20, 18)} Q${t(10, 15)} ${t(5, 3)}`,
      `M${t(20, 18)} Q${t(30, 15)} ${t(35, 3)}`,
      `M${t(8, 9)} L${t(13, 12)} M${t(6, 5)} L${t(10, 8)} M${t(32, 9)} L${t(27, 12)} M${t(34, 5)} L${t(30, 8)}`,
    ]) {
      ops.push({ t: 'path', d, stroke: '#d9b866', sw: 1.4 * k });
    }
  }
  ops.push({ t: 'circle', cx: x + cx, cy: y + cy, r: circle / 2, fill: flat(g.mk, flat(g.bg, '#FFFFFF')) });
  if (inCircle.kind === 'mark') ops.push(...setnayanMarkOps(x + cx, y + cy, circle * 0.72, GOLD));
  else ops.push({ t: 'path', d: at(inCircle.d), fill: inCircle.kind === 'star' ? GOLD : flat(glyphInk, GOLD) });
  ops.push({ t: 'path', d: at(line1D), fill: foil ? flat(paint?.foil[0], GOLD) : flat(g.fg, '#2B2620') });
  ops.push({ t: 'path', d: at(line2D), fill: flat(g.fg, '#2B2620') });
  if (tickD) ops.push({ t: 'path', d: at(tickD), stroke: flat(g.fg, '#2B2620'), sw: s2 * 0.16 });
  return { ops, width: W, height: H };
}

/**
 * The badges as one SVG document — stacked, one under the next, each its own pill. `F` is the em in points (the
 * pill's height is 3.01 em): 34 pt draws the prototype's "large" pill; the printer scales the vector from there.
 */
export function badgePrintSvg(badges: readonly ShopBadge[], opts: { ground?: PrintGround; colour?: string; em?: number } = {}): string {
  const ground = opts.ground ?? 'light';
  const colour = /^#[0-9a-fA-F]{6}$/.test(opts.colour ?? '') ? opts.colour! : '#1F3A2C';
  const F = opts.em ?? 34;
  const gapY = 1.1 * F;
  const drawn = badges.map((b, i) => pill(b, F, ground, colour, i));
  const W = Math.max(1, ...drawn.map((d) => d.width));
  let y = F; // room for a laurel above the first pill
  const body = drawn
    .map((d) => {
      const out = `<g transform="translate(0 ${n(y)})">${d.svg}</g>`;
      y += d.height + gapY;
      return out;
    })
    .join('');
  const H = Math.max(1, y - gapY);
  const defs = drawn.map((d) => d.defs).join('');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}pt" height="${n(H)}pt" viewBox="0 0 ${n(W)} ${n(H)}">` +
    `<title>SETNAYAN badges</title><defs>${defs}</defs>${body}</svg>`
  );
}
