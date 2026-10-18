/**
 * ❦ THE LOGO'S ORNAMENTS (L5 — owner 2026-10-08, DECISION_LOG "LOGO MAKER REPLOT APPROVED, WITH ORNAMENT", verbatim
 * *"approve add ornament"*, which REVERSES the 2026-10-06 removal). ＋ Add layer = Text · Image · Frame · Ornament; the
 * Add list's line reads "A flourish, a leaf, a star".
 *
 * A CLOSED SET, never free drawing — exactly as the frames (`frameBody`). The six are the prototype's own
 * (`logo_maker_replot_2026-10-08_fable.html`, `ORN = ['❦','✿','❧','✦','⚜','❖']`), drawn here as plain filled paths so
 * every surface that draws a logo (the player, print, the ink box) draws them with no font and no image.
 *
 * 🔑 WHICH ORNAMENT IT IS LIVES IN ITS SHAPES, NOT IN THE CONFIG: the body's one group carries `data-ornament="<key>"`
 * and the body round-trips through the composed file like an image's (`parseLogoSvg`). So the stored layer needs no new
 * field, `sanitizeLogoLayers` (first-load code) grows by one kind only, and this file is imported by the lazy
 * `maker-logo.tsx` alone — the Maker's first-load budget does not pay for six ornaments.
 *
 * PURE — no DOM, no IO.
 */

import { R } from './logo-layers';

export const LOGO_ORNAMENT_KINDS = ['flourish', 'blossom', 'leaf', 'star', 'fleur', 'diamonds'] as const;
export type LogoOrnamentKind = (typeof LOGO_ORNAMENT_KINDS)[number];

export const LOGO_ORNAMENT_LABEL: Record<LogoOrnamentKind, string> = {
  flourish: 'Flourish',
  blossom: 'Blossom',
  leaf: 'Leaf',
  star: 'Star',
  fleur: 'Fleur-de-lis',
  diamonds: 'Diamonds',
};

type Pt = [number, number];
/** An ornament's pieces (one path each) in its own box. */
type Drawn = { ds: string[]; w: number; h: number };
const pt = (p: Pt) => `${R(p[0])} ${R(p[1])}`;
const polar = (cx: number, cy: number, r: number, deg: number): Pt => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];

/** One cubic Bézier, sampled. */
function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

/**
 * A pen stroke that swells and thins — the calligrapher's swash — as ONE filled outline (no stroke attribute, so it
 * recolours, prints and traces on like any other ink). `width(t)` is the full width at 0 … 1 along the line.
 */
function swash(line: Pt[], width: (t: number) => number): string {
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < line.length; i++) {
    const a = line[Math.max(0, i - 1)] as Pt;
    const b = line[Math.min(line.length - 1, i + 1)] as Pt;
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    const half = width(i / (line.length - 1)) / 2;
    const p = line[i] as Pt;
    left.push([p[0] - (dy / len) * half, p[1] + (dx / len) * half]);
    right.push([p[0] + (dy / len) * half, p[1] - (dx / len) * half]);
  }
  const ring = [...left, ...right.reverse()];
  return `M${ring.map(pt).join('L')}Z`;
}

/** A spiral that winds in to its centre — the curl at a swash's end. */
function curl(cx: number, cy: number, r0: number, fromDeg: number, turns: number, dir: 1 | -1, n: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    out.push(polar(cx, cy, r0 * (1 - 0.72 * t), fromDeg + dir * 360 * turns * t));
  }
  return out;
}

const mirror = (w: number) => (p: Pt): Pt => [w - p[0], p[1]];
const thinAtBothEnds = (max: number, min = 1.5) => (t: number) => min + (max - min) * Math.sin(Math.PI * Math.min(1, Math.max(0, t)));

/** The flourish (❦ in the prototype): a scroll either side of a small diamond, each arm swelling then curling in. */
function flourish(): Drawn {
  const w = 400;
  const h = 120;
  const arm = (flip: (p: Pt) => Pt) => {
    const sweep = cubic([186, 60], [140, 30], [90, 98], [52, 70], 36);
    const tail = curl(52 + 22, 70 - 4, 26, 175, 0.85, 1, 30);
    const line = [...sweep, ...tail.slice(1)].map(flip);
    return swash(line, (t) => 3 + 20 * Math.sin(Math.PI * Math.min(1, t * 1.25)) * (1 - 0.6 * t));
  };
  const leafTip = (flip: (p: Pt) => Pt) => swash(cubic([160, 52], [150, 22], [124, 14], [104, 22], 20).map(flip), thinAtBothEnds(13));
  const id: (p: Pt) => Pt = (p) => p;
  const m = mirror(w);
  const diamond = `M${pt([200, 42])}L${pt([216, 60])}L${pt([200, 78])}L${pt([184, 60])}Z`;
  return { ds: [arm(id), arm(m), leafTip(id), leafTip(m), diamond], w, h };
}

/** The blossom (✿): five round petals about an open centre. */
function blossom(): Drawn {
  const c = 100;
  let d = '';
  for (let k = 0; k < 5; k++) {
    const a = -90 + 72 * k;
    const p0 = polar(c, c, 24, a - 26);
    d +=
      `M${pt(p0)}C${pt(polar(c, c, 70, a - 44))} ${pt(polar(c, c, 98, a - 16))} ${pt(polar(c, c, 92, a))}` +
      `C${pt(polar(c, c, 98, a + 16))} ${pt(polar(c, c, 70, a + 44))} ${pt(polar(c, c, 24, a + 26))}` +
      `A24 24 0 0 0 ${pt(p0)}Z`;
  }
  // The open centre: a ring, so the petals read as a flower and not a star.
  const ring = (r: number, sweep: 0 | 1) => `M${c - r} ${c}A${r} ${r} 0 1 ${sweep} ${c + r} ${c}A${r} ${r} 0 1 ${sweep} ${c - r} ${c}Z`;
  return { ds: [d, ring(17, 1) + ring(9, 0)], w: 200, h: 200 };
}

/** The leaf (❧): a pointed ivy leaf on a curling stem, a vein down its middle. */
function leaf(): Drawn {
  const blade =
    'M100 58C84 34 48 26 30 52C12 80 34 120 62 146C76 160 90 172 100 196' +
    'C110 172 124 160 138 146C166 120 188 80 170 52C152 26 116 34 100 58Z';
  // The vein, cut out of the blade (wound the other way, so it reads as a light line).
  const vein = 'M100 70C103 104 102 140 100 178C98 140 97 104 100 70Z';
  const stem = swash([...cubic([100, 60], [100, 36], [112, 16], [134, 12], 16), ...curl(140, 24, 12, -90, 0.8, 1, 16).slice(1)], (t) => 7 - 4.5 * t);
  return { ds: [blade + vein, stem], w: 200, h: 200 };
}

/** The star (✦): four points, the sides drawn in. */
function star(): Drawn {
  const d = 'M100 0C108 64 136 92 200 100C136 108 108 136 100 200C92 136 64 108 0 100C64 92 92 64 100 0Z';
  return { ds: [d], w: 200, h: 200 };
}

/** The fleur-de-lis (⚜): the tall centre petal, two petals curling out, the band and the foot. */
function fleur(): Drawn {
  const w = 200;
  const m = mirror(w);
  const centre = 'M100 6C128 42 130 96 100 134C70 96 72 42 100 6Z';
  const side = (flip: (p: Pt) => Pt) => {
    const P = (x: number, y: number) => pt(flip([x, y]));
    return `M${P(110, 132)}C${P(116, 78)} ${P(170, 52)} ${P(188, 88)}C${P(198, 110)} ${P(178, 132)} ${P(160, 120)}C${P(174, 116)} ${P(176, 98)} ${P(162, 94)}C${P(140, 88)} ${P(124, 108)} ${P(120, 134)}Z`;
  };
  const band = 'M58 134H142V150H58Z';
  const foot = 'M100 150C110 160 124 170 132 192C116 184 106 176 100 166C94 176 84 184 68 192C76 170 90 160 100 150Z';
  return { ds: [centre, side((p) => p), side(m), band, foot], w, h: 196 };
}

/** The diamonds (❖): four small diamonds about the centre, a hair apart. */
function diamonds(): Drawn {
  const c = 100;
  const r = 44;
  const gap = 6;
  let d = '';
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
    const cx = c + dx * (r + gap / 2);
    const cy = c + dy * (r + gap / 2);
    d += `M${pt([cx, cy - r])}L${pt([cx + r, cy])}L${pt([cx, cy + r])}L${pt([cx - r, cy])}Z`;
  }
  return { ds: [d], w: 200, h: 200 };
}

const DRAW: Record<LogoOrnamentKind, () => Drawn> = { flourish, blossom, leaf, star, fleur, diamonds };

/** The ornament's shapes in its own `w × h` box — one plain path per piece (each fills on its own, so pieces that
 *  overlap never cut each other out), inside one group that names it. */
export function ornamentBody(kind: LogoOrnamentKind): { body: string; w: number; h: number } {
  const { ds, w, h } = DRAW[kind]();
  return { body: `<g data-ornament="${kind}">${ds.map((d) => `<path d="${d}"/>`).join('')}</g>`, w, h };
}

/** Which ornament a layer's shapes are — read off the body (it survives the composed file), or null. */
export function ornamentOf(body: string | undefined | null): LogoOrnamentKind | null {
  const k = /data-ornament="([a-z-]{1,16})"/.exec(body ?? '')?.[1];
  return k && (LOGO_ORNAMENT_KINDS as readonly string[]).includes(k) ? (k as LogoOrnamentKind) : null;
}
