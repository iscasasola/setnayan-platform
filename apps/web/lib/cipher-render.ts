/**
 * apps/web/lib/cipher-render.ts
 *
 * Cipher Monogram — the PURE renderer (no IO, no DOM). Turns a CipherConfig +
 * prebuilt font geometry into a self-contained SVG string of pure paths.
 *
 * Used by BOTH the editor's live preview (client) and the save action
 * (server) so what the couple sees is exactly what gets stored on
 * events.monogram_custom_svg and rendered on the wedding-site hero / print.
 *
 * Modes:
 *   overlap  — both letters as-is, `front` drawn last (any font).
 *   restroke — single-line fonts only: the two letters' MAIN writing strokes
 *              are joined by a G1 connector and rendered as ONE variable-width
 *              pointed-pen ribbon (lib/calligraphy.ts) — they flow together.
 *   weave    — filled fonts only: the front letter knocks an adjustable gap
 *              out of the back letter where they cross (mask of the front
 *              glyph stroked by `gap`), then draws on top — over/under.
 */

import {
  connectNearest,
  penOutline,
  place,
  type Placed,
  type Pt,
} from '@/lib/calligraphy';
import {
  CIPHER_CANVAS,
  cipherFont,
  type CipherConfig,
  type CipherPlacement,
} from '@/lib/cipher-shared';

/* Prebuilt geometry shapes (scripts/build-cipher-fonts.mts). */
export type StrokeFontData = {
  kind: 'stroke';
  key: string;
  glyphs: Record<string, { subs: number[][][]; main: number }>;
};
export type FilledFontData = {
  kind: 'filled';
  key: string;
  glyphs: Record<string, { d: string; w: number; h: number }>;
};
export type CipherFontData = StrokeFontData | FilledFontData;

const INK_FLAT: Record<string, string> = {
  mulberry: '#5C2542',
  obsidian: '#1E2229',
};

const GOLD_STOPS =
  '<stop offset="0" stop-color="#F3DC86"/><stop offset="0.45" stop-color="#C9A24F"/>' +
  '<stop offset="0.62" stop-color="#9A7733"/><stop offset="1" stop-color="#D8B45F"/>';

type Box = { x1: number; y1: number; x2: number; y2: number };

function growBox(b: Box, x: number, y: number): void {
  b.x1 = Math.min(b.x1, x);
  b.y1 = Math.min(b.y1, y);
  b.x2 = Math.max(b.x2, x);
  b.y2 = Math.max(b.y2, y);
}

function toPlaced(p: CipherPlacement): Placed & { fx: number; fy: number } {
  return { x: p.x, y: p.y, scale: p.scale, rot: p.rot, fx: p.fx, fy: p.fy };
}

/** Apply a placement incl. mirror to raw [x,y] glyph points. */
function placePts(raw: number[][], p: CipherPlacement): Pt[] {
  const mirrored: Pt[] = raw.map(([x = 0, y = 0]) => ({ x: x * p.fx, y: y * p.fy }));
  return place(mirrored, { x: p.x, y: p.y, scale: p.scale, rot: p.rot });
}

/** SVG transform string for filled glyph paths (centered at origin). */
function placementTransform(p: CipherPlacement): string {
  return `translate(${p.x} ${p.y}) rotate(${p.rot}) scale(${p.scale * p.fx} ${p.scale * p.fy})`;
}

export type CipherRender = { svg: string; viewBox: string };

/**
 * Render a (sanitized) config with its font geometry. `idPrefix` namespaces
 * gradient/mask ids for inline-SVG contexts where multiple renders share a
 * document. Returns null when a glyph is missing from the data (defensive —
 * sanitizeCipherConfig restricts initials to A–Z which the prebuild covers).
 */
export function renderCipher(
  config: CipherConfig,
  fontData: CipherFontData,
  idPrefix = 'cg',
  opts: {
    /** Fixed viewBox (e.g. the editor's design frame `0 0 400 400`) so the
     *  canvas doesn't jump while dragging. Omitted → tight content bbox
     *  (the save path). Gradient/mask still pin to the content bbox. */
    frame?: string;
  } = {},
): CipherRender | null {
  const font = cipherFont(config.fontKey);
  if (!font || fontData.key !== font.key || fontData.kind !== font.kind) return null;

  const [chA, chB] = config.initials;
  const fill =
    config.ink === 'gold' ? `url(#${idPrefix}-gold)` : INK_FLAT[config.ink] ?? INK_FLAT.mulberry;

  const box: Box = { x1: Infinity, y1: Infinity, x2: Infinity * -1, y2: -Infinity };
  let body = '';
  let maskDef = '';

  if (fontData.kind === 'stroke') {
    const gA = fontData.glyphs[chA];
    const gB = fontData.glyphs[chB];
    if (!gA || !gB) return null;
    const [p1, p2] = config.letters;
    // Pen nib scales with the letters so resizing keeps proportions.
    const nib = Math.max(6, 90 * ((p1.scale + p2.scale) / 2));

    const subsA = gA.subs.map((s) => placePts(s, p1));
    const subsB = gB.subs.map((s) => placePts(s, p2));
    for (const s of [...subsA, ...subsB]) for (const q of s) growBox(box, q.x, q.y);

    const ribbons: string[] = [];
    if (config.mode === 'restroke') {
      // Join the two MAIN writing strokes into one continuous centerline;
      // secondary substrokes (crossbars) render as their own ribbons.
      const mainA = subsA[gA.main] ?? subsA[0]!;
      const mainB = subsB[gB.main] ?? subsB[0]!;
      const joined = connectNearest(mainA, mainB, config.tension);
      for (const q of joined) growBox(box, q.x, q.y);
      subsA.forEach((s, i) => { if (i !== gA.main) ribbons.push(penOutline(s, { size: nib })); });
      subsB.forEach((s, i) => { if (i !== gB.main) ribbons.push(penOutline(s, { size: nib })); });
      ribbons.push(penOutline(joined, { size: nib }));
    } else {
      // overlap — draw back letter first, front letter last.
      const ordered = config.front === 1 ? [subsB, subsA] : [subsA, subsB];
      for (const subs of ordered) for (const s of subs) ribbons.push(penOutline(s, { size: nib }));
    }
    // Ribbon outlines extend ~nib beyond centerlines.
    box.x1 -= nib; box.y1 -= nib; box.x2 += nib; box.y2 += nib;
    body = ribbons.filter(Boolean).map((d) => `<path d="${d}" fill="${fill}"/>`).join('');
  } else {
    const gA = fontData.glyphs[chA];
    const gB = fontData.glyphs[chB];
    if (!gA || !gB) return null;
    const [p1, p2] = config.letters;

    // Bbox from each glyph's centered rect corners under its transform.
    for (const [g, p] of [
      [gA, p1],
      [gB, p2],
    ] as const) {
      const hw = g.w / 2, hh = g.h / 2;
      const corners = placePts(
        [
          [-hw, -hh],
          [hw, -hh],
          [hw, hh],
          [-hw, hh],
        ],
        p,
      );
      for (const q of corners) growBox(box, q.x, q.y);
    }
    const pad = Math.max(8, config.mode === 'weave' ? config.gap : 0);
    box.x1 -= pad; box.y1 -= pad; box.x2 += pad; box.y2 += pad;

    const frontIs1 = config.front === 1;
    const front = frontIs1 ? { g: gA, p: p1 } : { g: gB, p: p2 };
    const back = frontIs1 ? { g: gB, p: p2 } : { g: gA, p: p1 };
    const backEl = `<g transform="${placementTransform(back.p)}"><path d="${back.g.d}" fill="${fill}"/></g>`;
    const frontEl = `<g transform="${placementTransform(front.p)}"><path d="${front.g.d}" fill="${fill}"/></g>`;

    if (config.mode === 'weave' && config.gap > 0) {
      // The front glyph, stroked by `gap`, knocks a clearance band out of the
      // back glyph where they cross — the over/under weave. Stroke width in
      // glyph units so it scales with the letter: gap / scale.
      const strokeW = config.gap / Math.max(0.04, front.p.scale);
      maskDef =
        `<mask id="${idPrefix}-weave" maskUnits="userSpaceOnUse" ` +
        `x="${box.x1.toFixed(1)}" y="${box.y1.toFixed(1)}" ` +
        `width="${(box.x2 - box.x1).toFixed(1)}" height="${(box.y2 - box.y1).toFixed(1)}">` +
        `<rect x="${box.x1.toFixed(1)}" y="${box.y1.toFixed(1)}" ` +
        `width="${(box.x2 - box.x1).toFixed(1)}" height="${(box.y2 - box.y1).toFixed(1)}" fill="white"/>` +
        `<g transform="${placementTransform(front.p)}">` +
        `<path d="${front.g.d}" fill="black" stroke="black" stroke-width="${strokeW.toFixed(1)}" stroke-linejoin="round"/>` +
        `</g></mask>`;
      body =
        `<g mask="url(#${idPrefix}-weave)">${backEl}</g>` + frontEl;
    } else {
      body = backEl + frontEl;
    }
  }

  if (!isFinite(box.x1) || box.x2 - box.x1 < 2) return null;
  const w = box.x2 - box.x1;
  const h = box.y2 - box.y1;
  const viewBox =
    opts.frame ?? `${box.x1.toFixed(1)} ${box.y1.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
  // Vertical gold gradient pinned to the mark's own bbox (userSpaceOnUse so
  // the foil bands stay consistent across both letters + the ribbon).
  const defs =
    `<defs><linearGradient id="${idPrefix}-gold" gradientUnits="userSpaceOnUse" ` +
    `x1="${box.x1.toFixed(1)}" y1="${box.y1.toFixed(1)}" x2="${box.x1.toFixed(1)}" y2="${box.y2.toFixed(1)}">` +
    `${GOLD_STOPS}</linearGradient>${maskDef}</defs>`;

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${defs}${body}</svg>`,
    viewBox,
  };
}

/** Default canvas extent — exported for the editor's hit-testing space. */
export const CIPHER_DESIGN_SPACE = CIPHER_CANVAS;
