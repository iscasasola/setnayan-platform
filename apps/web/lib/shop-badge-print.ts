import { loadOtFont, type OtFont } from '@/lib/glyph-path';
import { outlineWords, type OtFace } from '@/lib/logo-fonts';
import { setnayanMarkSvg } from '@/lib/qr-style-svg';
import type { ShopBadge } from '@/lib/shop-badges';

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
function face(): OtFace {
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

type Drawn = { svg: string; width: number; height: number };

/** One pill at em size `F`, top-left at (0, 0). */
function pill(b: ShopBadge, F: number, ground: PrintGround, colour: string, idx: number): Drawn {
  const g = ground === 'colour' ? { bg: colour, fg: '#F2EAD8', mk: 'rgba(255,255,255,0.08)' } : GROUNDS[ground];
  const foil = ground === 'dark' || ground === 'colour';
  const f = face();
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
  let tickSvg = '';
  if (tick) {
    const tw = s2 * 0.72;
    const x0 = b2.x2 + 0.7 * s2;
    const yb = y2;
    tickSvg = `<path d="M${n(x0)},${n(yb - tw * 0.45)} L${n(x0 + tw * 0.35)},${n(yb)} L${n(x0 + tw)},${n(yb - tw * 0.95)}" fill="none" stroke="${g.fg}" stroke-width="${n(s2 * 0.16)}" stroke-linecap="round" stroke-linejoin="round"/>`;
    textRight = x0 + tw;
  }
  const W = textRight + padR;
  const cx = padL + circle / 2;
  const cy = H / 2;
  let inCircle: string;
  if (b.glyph === null) inCircle = setnayanMarkSvg(cx, cy, circle * 0.72, GOLD);
  else if (b.glyph === '★') inCircle = `<path d="${starPath(cx, cy + circle * 0.03, circle * 0.3)}" fill="${GOLD}"/>`;
  else {
    const gs = 0.95 * F;
    const gp = outlineWords(f, b.glyph, 0, 0, gs, 0);
    const gb = gp.getBoundingBox();
    const gp2 = outlineWords(f, b.glyph, cx - (gb.x1 + gb.x2) / 2, cy - (gb.y1 + gb.y2) / 2, gs, 0);
    inCircle = `<path d="${gp2.toPathData(2)}" fill="${GOLD}"/>`;
  }
  const foilId = `foil${idx}`;
  const svg =
    `<g data-badge="${b.key}">` +
    `<rect x="0.7" y="0.7" width="${n(W - 1.4)}" height="${n(H - 1.4)}" rx="${n((H - 1.4) / 2)}" fill="${g.bg}" stroke="url(#${foilId})" stroke-width="1.4"/>` +
    `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(circle / 2)}" fill="${g.mk}"/>` +
    inCircle +
    `<path d="${p1.toPathData(2)}" fill="${foil ? `url(#${foilId})` : g.fg}"/>` +
    `<path d="${p2.toPathData(2)}" fill="${g.fg}"/>` +
    tickSvg +
    `</g>`;
  return { svg, width: W, height: H };
}

/**
 * The badges as one SVG document — stacked, one under the next, each its own pill. `F` is the em in points (the
 * pill's height is 3.01 em): 34 pt draws the prototype's "large" pill; the printer scales the vector from there.
 */
export function badgePrintSvg(badges: readonly ShopBadge[], opts: { ground?: PrintGround; colour?: string; em?: number } = {}): string {
  const ground = opts.ground ?? 'light';
  const colour = /^#[0-9a-fA-F]{6}$/.test(opts.colour ?? '') ? opts.colour! : '#1F3A2C';
  const F = opts.em ?? 34;
  const gapY = 0.6 * F;
  const drawn = badges.map((b, i) => pill(b, F, ground, colour, i));
  const W = Math.max(1, ...drawn.map((d) => d.width));
  let y = 0;
  const body = drawn
    .map((d) => {
      const out = `<g transform="translate(0 ${n(y)})">${d.svg}</g>`;
      y += d.height + gapY;
      return out;
    })
    .join('');
  const H = Math.max(1, y - gapY);
  const defs = drawn
    .map(
      (d, i) =>
        `<linearGradient id="foil${i}" x1="0" y1="0" x2="${n(d.width)}" y2="${n(d.height * 0.47)}" gradientUnits="userSpaceOnUse">` +
        FOIL_STOPS.map(([o, c]) => `<stop offset="${o}%" stop-color="${c}"/>`).join('') +
        `</linearGradient>`,
    )
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${n(W)}pt" height="${n(H)}pt" viewBox="0 0 ${n(W)} ${n(H)}">` +
    `<title>SETNAYAN badges</title><defs>${defs}</defs>${body}</svg>`
  );
}
