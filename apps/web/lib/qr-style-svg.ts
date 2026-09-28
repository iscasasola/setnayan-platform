import QRCode from 'qrcode';
import {
  clearanceBadgeSvg,
  clearanceCircleRadius,
  monogramOverlaySvg,
  type MonogramTextRenderer,
} from './monogram';
import { SETNAYAN_GOLD, type QrLook, type QrPattern } from './qr-look';

/**
 * lib/qr-style-svg.ts — draw a QR in a `QrLook`, as one SVG string.
 *
 * The `qrcode` package's own SVG renderer draws every dark module as a unit
 * square and knows nothing about badges, dots or circles, so this file walks
 * the module matrix (`QRCode.create(...).modules`) and draws it itself. One
 * string, one geometry, for the screen (`renderText` = real `<text>`) and for
 * the saved file (`renderText` = opentype outlines, see lib/qr-style-raster.ts).
 *
 * ── WHAT NEVER CHANGES, WHATEVER THE LOOK ──────────────────────────────────
 *   · error correction is H (`QRCode.create` below; ~30% redundancy);
 *   · the three FINDER patterns are drawn as solid squares in the QR's ink,
 *     ignoring `pattern` — a scanner locates the code by their 1:1:3:1:1 ratio,
 *     and a finder made of dots reads as noise from across a table;
 *   · the quiet zone is `QUIET` modules on every side of a square code; a
 *     circle keeps a `CIRCLE_GAP`-module light ring round the code and fills
 *     the rest of its disc with payload-seeded filler (SHAPE = CIRCLE below);
 *   · the centre badge is the SAME clearance every lettered monogram has used
 *     (lib/monogram.ts clearanceBadgeSvg), so its footprint under level H is the
 *     one this product has shipped since 2026-05.
 * lib/every-qr-look-decodes.test.ts decodes a real render of every shape ×
 * pattern × centre and is the thing that makes those sentences true.
 */

/** Quiet zone, in modules, on every side of the code. */
export const QUIET = 4;

/** The official Setnayan mark — geometry verbatim from public/brand/setnayan-mark.svg
 *  (owner-supplied 2026-05-31), the same path <SetnayanMark> inlines for the nav. */
export const SETNAYAN_MARK_VIEWBOX = '0 0 5333.3335 5333.3335';
export const SETNAYAN_MARK_PATH =
  'M 1859.526,3749.781 C 1458.028,3717.757 1065.454,3548.554 758.3406,3241.44 451.2286,2934.328 282.2397,2541.742 250.2195,2140.255 l 1326.8215,1.536 V 661.7647 C 1368.543,727.4195 1172.067,841.5416 1006.804,1006.804 768.3191,1245.29 633.8543,1548.261 602.7217,1859.526 H 250 C 282.024,1458.028 451.2265,1065.455 758.3406,758.3406 1065.453,451.2287 1458.039,282.2396 1859.526,250.2195 V 2422.739 H 661.7647 c 65.6549,208.498 179.7773,404.975 345.0393,570.237 238.486,238.486 541.457,372.95 852.722,404.083 z m 280.948,0 1.537,-1609.307 h 280.948 v 1197.761 c 208.498,-65.655 404.974,-179.776 570.237,-345.039 238.485,-238.486 372.95,-541.457 404.082,-852.722 H 3750 c -32.024,401.498 -201.226,794.071 -508.341,1101.185 -307.112,307.112 -699.697,476.101 -1101.185,508.122 z m 0,-1890.255 c 32.025,-401.498 201.227,-794.073 508.341,-1101.1854 0.658,-0.6584 1.316,-1.3173 1.975,-1.9754 -80.395,-42.041 -163.892,-76.0428 -249.331,-101.7389 -85.439,-25.696 -172.821,-43.0864 -260.985,-51.9046 V 250.2195 c 401.497,32.0253 794.073,201.0094 1101.185,508.1211 307.114,307.1134 476.317,699.6874 508.341,1101.1854 h -352.722 c -31.132,-311.265 -165.597,-614.236 -404.082,-852.722 -15.719,-15.7189 -32.464,-29.741 -48.727,-44.5564 -15.975,14.4789 -31.774,29.1397 -47.191,44.5564 -238.485,238.486 -372.95,541.457 -404.082,852.722 z';
/** The mark's export carries a flip matrix and a 4000-unit clip; both are part of the artwork. */
const SETNAYAN_MARK_TRANSFORM = 'matrix(1.3333333,0,0,-1.3333333,0,5333.3333)';

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/\.?0+$/, ''));

function inFinder(r: number, c: number, n: number): boolean {
  return (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
}

/**
 * One module's shape, defined ONCE per document and `<use>`d per cell — a
 * rounded or dotted code has ~900 modules, and a full arc path per cell made a
 * single QR ~140 KB, which a 200-guest print sheet multiplies. The id carries
 * the pattern name so two identical definitions on one page (a sheet of guest
 * codes) collide harmlessly: the browser resolves the first, and it is the same
 * shape. Cells stay 1×1 so rounded modules touch and read as one blob.
 */
function moduleDef(pattern: QrPattern): string {
  // r = .5: the dots TOUCH their neighbours. Measured 2026-09-28 with the repo's
  // detector: at r = .44 a shorter payload (a smaller code, bigger cells) failed
  // to decode at 360, 480 AND 1024 px in every centre, while the same code at
  // r = .5 decodes everywhere — the gap between dots read as light to the
  // binariser. A dotted look that scans is the only dotted look that ships.
  if (pattern === 'dots') return `<circle id="qm-dots" cx=".5" cy=".5" r=".5"/>`;
  if (pattern === 'rounded') return `<rect id="qm-rounded" width="1" height="1" rx=".3"/>`;
  return '';
}

/** One module at cell (x, y): a `<use>` of the shared def, or a path segment for classic.
 *  Plain `href` only — every browser and the librsvg sharp bundles resolve it,
 *  and the `xlink:` twin doubled the size of every rounded or dotted code. */
function moduleSegment(pattern: QrPattern, x: number, y: number): string {
  if (pattern === 'classic') return `M${num(x)} ${num(y)}h1v1h-1z`;
  return `<use href="#qm-${pattern}" x="${num(x)}" y="${num(y)}"/>`;
}

/** A finder pattern (7×7) at cell (x, y): the dark ring and the dark 3×3 heart, always square. */
function finderSegment(x: number, y: number): string {
  return `M${num(x)} ${num(y)}h7v7h-7zM${num(x + 1)} ${num(y + 1)}v5h5v-5zM${num(x + 2)} ${num(y + 2)}h3v3h-3z`;
}

/** The Setnayan mark, fitted into a `box`-wide square centred on (cx, cy). */
export function setnayanMarkSvg(cx: number, cy: number, box: number, fill = SETNAYAN_GOLD): string {
  return (
    `<svg x="${num(cx - box / 2)}" y="${num(cy - box / 2)}" width="${num(box)}" height="${num(box)}" ` +
    `viewBox="${SETNAYAN_MARK_VIEWBOX}" preserveAspectRatio="xMidYMid meet" data-qr-centre="setnayan">` +
    `<path d="${SETNAYAN_MARK_PATH}" fill="${escapeAttr(fill)}" fill-rule="nonzero" transform="${SETNAYAN_MARK_TRANSFORM}"/>` +
    `</svg>`
  );
}

/**
 * The couple's drawn logo (a sanitised `<svg>` document, from
 * resolveEventMonogramSvg) re-rooted as a nested `<svg>` fitted into a
 * `box`-wide square centred on (cx, cy). The root's own `width`/`height`
 * become a viewBox when it has none; every other root attribute survives
 * (a `fill`, a `data-ink` stamp, a `style`), because they may paint children.
 */
export function logoCentreSvg(svgDocument: string, cx: number, cy: number, box: number, ink: string): string | null {
  const open = /<svg\b([^>]*)>/i.exec(svgDocument);
  const close = svgDocument.lastIndexOf('</svg>');
  if (!open || close < 0 || close <= open.index) return null;
  const rootAttrs = open[1] ?? '';
  const inner = svgDocument.slice(open.index + open[0].length, close);
  const attr = (name: string) => new RegExp(`\\s${name}="([^"]*)"`, 'i').exec(rootAttrs)?.[1] ?? null;
  let viewBox = attr('viewBox');
  if (!viewBox) {
    const w = parseFloat(attr('width') ?? '');
    const h = parseFloat(attr('height') ?? '');
    viewBox = Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? `0 0 ${w} ${h}` : '0 0 100 100';
  }
  const kept = rootAttrs
    .replace(/\s(?:x|y|width|height|viewBox|preserveAspectRatio|xmlns(?::\w+)?)="[^"]*"/gi, '')
    .trim();
  return (
    `<svg x="${num(cx - box / 2)}" y="${num(cy - box / 2)}" width="${num(box)}" height="${num(box)}" ` +
    `viewBox="${escapeAttr(viewBox)}" preserveAspectRatio="xMidYMid meet" color="${escapeAttr(ink)}" ` +
    `data-qr-centre="logo"${kept ? ` ${kept}` : ''}>${inner}</svg>`
  );
}

/**
 * The centre overlay in the QR square's own coordinates (side = n + 2·QUIET,
 * centre at side/2). The lettered monogram keeps its whole existing overlay;
 * the mark and the logo sit in the same clearance via clearanceBadgeSvg.
 */
function centreOverlay(look: QrLook, side: number, renderText?: MonogramTextRenderer): string {
  const c = look.centre;
  if (c.kind === 'monogram') {
    return monogramOverlaySvg({ viewBoxSize: side, monogram: c.monogram, renderText });
  }
  const cx = side / 2;
  const box = clearanceCircleRadius(side) * 1.5;
  let inner: string;
  if (c.kind === 'setnayan') {
    inner = setnayanMarkSvg(cx, cx, box);
  } else {
    inner = logoCentreSvg(c.svg, cx, cx, box, look.dark) ?? setnayanMarkSvg(cx, cx, box);
  }
  return clearanceBadgeSvg({ viewBoxSize: side, fill: escapeAttr(look.light), stroke: escapeAttr(look.dark), inner });
}

export type StyledQrSvgOptions = {
  /** Rendered width/height attribute, in px. Omit for a size-less (CSS-sized) SVG. */
  width?: number;
  /** How a run of type in a lettered centre becomes markup (see lib/monogram.ts THE GLYPH SEAM). */
  renderText?: MonogramTextRenderer;
};

/**
 * ── SHAPE = CIRCLE: THE CODE FILLS THE CIRCLE ─────────────────────────────
 * Owner 2026-09-28, verbatim, on the first Circle (a square code in a round
 * cream badge): *"the QR should be Circle following the shape and not just the
 * frame"*. So a circle is now a DISC OF MODULES: the real code in the centre,
 * a clean light ring `CIRCLE_GAP` modules wide around it, and FILLER modules —
 * same pattern, same ink, on the code's own grid — out to the disc's edge,
 * finished by a thin ring in the ink.
 *
 * The filler is decoration a scanner must ignore, so three things hold:
 *   · it never enters the code or its gap ring (a scanner finds the finders by
 *     their 1:1:3:1:1 run, and a dark filler cell against a finder's outer
 *     edge would lengthen its first run);
 *   · it is DETERMINISTIC per payload (`fillerSeed`, FNV-1a of the text into
 *     mulberry32), so the code a couple sees on screen is the code the printer
 *     prints and the guest saves — same payload, same picture, every render;
 *   · its density is `CIRCLE_FILLER_DENSITY`, the ~half-dark texture of real
 *     QR data, so the disc reads as ONE code, not a code on a doily.
 * lib/every-qr-look-decodes.test.ts decodes every circle at print size and as
 * a forwarded 320-px JPEG, and counts the filler in the disc — that test, not
 * this comment, is what makes these sentences true.
 */

/**
 * Light modules between the real code and the filler, on every side, and how
 * far the filler reaches past that ring's corners (so the corner finders sit
 * inside the texture, not on its rim). MEASURED, not chosen — 2026-09-28, a
 * sweep of 80 payload lengths × 3 patterns × 2 centres at 240/320-JPEG/360/600
 * /900 px with the repo's jsQR: GAP 1 · REACH 1 failed dozens of rasters, GAP 1
 * · REACH 2 and GAP 2 · REACH 2 failed long payloads at 240 px, GAP 3 lost
 * some forwarded copies, and GAP 2 · REACH 1 matched the SQUARE code's own
 * score (its only misses are the Dots pattern's, which the square shares).
 * Apple's Vision detector read 360 of 360 at GAP 2 · REACH 1. Re-run the decode
 * suite before moving either number.
 */
export const CIRCLE_GAP = 2;
export const CIRCLE_REACH = 1;
/** Share of filler cells drawn dark (real QR data runs at about half). */
export const CIRCLE_FILLER_DENSITY = 0.5;

/** FNV-1a (32-bit) of the payload — the filler's seed. Same text, same filler. */
export function fillerSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 — a small, fast, well-mixed PRNG; deterministic from its seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The circle's geometry for a code of `n` modules: the filler reaches
 * `fillR` from the centre (the gap ring's corner plus `CIRCLE_REACH`), the
 * ink ring sits just outside it, and the canvas is the square that holds the
 * cream disc. Exported so the test measures the same numbers the drawing uses.
 */
export function circleGeometry(n: number): { fillR: number; ringR: number; discR: number; canvas: number; off: number } {
  const fillR = (n / 2 + CIRCLE_GAP) * Math.SQRT2 + CIRCLE_REACH;
  const ringR = fillR + 1;
  const discR = ringR + 0.6;
  const canvas = Math.ceil(discR * 2 + 1);
  return { fillR, ringR, discR, canvas, off: canvas / 2 - n / 2 };
}

/**
 * The filler cells for a code of `n` modules, in the code's own grid (row,
 * col; negative and ≥ n are outside the code). A cell qualifies when it lies
 * outside the code + gap square and wholly inside the filler disc, and is
 * drawn when the payload-seeded PRNG says so.
 */
export function circleFillerCells(text: string, n: number): Array<[row: number, col: number]> {
  const { fillR } = circleGeometry(n);
  const rand = mulberry32(fillerSeed(text));
  const lo = -CIRCLE_GAP;
  const hi = n + CIRCLE_GAP; // exclusive
  const reach = Math.ceil(fillR - n / 2) + 1;
  const out: Array<[number, number]> = [];
  for (let r = -reach; r < n + reach; r += 1) {
    for (let c = -reach; c < n + reach; c += 1) {
      if (r >= lo && r < hi && c >= lo && c < hi) continue;
      // Farthest corner of the cell from the code's centre (n/2, n/2).
      const dx = Math.max(Math.abs(c - n / 2), Math.abs(c + 1 - n / 2));
      const dy = Math.max(Math.abs(r - n / 2), Math.abs(r + 1 - n / 2));
      if (dx * dx + dy * dy > fillR * fillR) continue;
      // Draw the PRNG for every qualifying cell, drawn or not, so the picture
      // depends only on (text, n) — never on how many cells happened to be dark.
      if (rand() < CIRCLE_FILLER_DENSITY) out.push([r, c]);
    }
  }
  return out;
}

/**
 * Draw `text` as a QR wearing `look`. Level H always. Returns a complete
 * `<svg>` document with a square viewBox. For `shape: 'circle'` the ground is
 * a cream disc whose modules fill it edge to edge (see SHAPE = CIRCLE above)
 * and the corners outside the disc are transparent; "round dots in a square
 * code" is `pattern: 'dots'`.
 */
export function styledQrSvg(text: string, look: QrLook, opts: StyledQrSvgOptions = {}): string {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'H' });
  const n = qr.modules.size;
  const side = n + 2 * QUIET;
  const circle = look.shape === 'circle' ? circleGeometry(n) : null;

  // Outer canvas and where the code's top-left module lands in it.
  const canvas = circle ? circle.canvas : side;
  const off = circle ? circle.off : QUIET;

  const modules: string[] = [];
  const finders: string[] = [];
  for (let r = 0; r < n; r += 1) {
    for (let c = 0; c < n; c += 1) {
      if (inFinder(r, c, n)) continue;
      if (qr.modules.get(r, c)) modules.push(moduleSegment(look.pattern, c + off, r + off));
    }
  }
  if (circle) {
    for (const [r, c] of circleFillerCells(text, n)) modules.push(moduleSegment(look.pattern, c + off, r + off));
  }
  finders.push(finderSegment(off, off), finderSegment(off + n - 7, off), finderSegment(off, off + n - 7));

  const dark = escapeAttr(look.dark);
  const light = escapeAttr(look.light);
  const mid = num(canvas / 2);
  const ground = circle
    ? `<circle cx="${mid}" cy="${mid}" r="${num(circle.discR)}" fill="${light}"/>` +
      `<circle cx="${mid}" cy="${mid}" r="${num(circle.ringR)}" fill="none" stroke="${dark}" stroke-width="0.6" data-qr-ring=""/>`
    : `<rect width="${num(canvas)}" height="${num(canvas)}" fill="${light}"/>`;

  // The overlay is drawn in the QR square's coordinates; shift it so its
  // centre lands on the canvas centre (a no-op for the square shape).
  const shift = off - QUIET;
  const overlay = centreOverlay(look, side, opts.renderText);
  const overlayG = shift ? `<g transform="translate(${num(shift)} ${num(shift)})">${overlay}</g>` : overlay;

  const size = opts.width ? ` width="${opts.width}" height="${opts.width}"` : '';
  const crisp = look.pattern === 'classic' ? ' shape-rendering="crispEdges"' : '';
  const def = moduleDef(look.pattern);
  const body =
    look.pattern === 'classic'
      ? modules.length
        ? `<path d="${modules.join('')}" fill="${dark}"/>`
        : ''
      : `<defs>${def}</defs><g fill="${dark}">${modules.join('')}</g>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `viewBox="0 0 ${num(canvas)} ${num(canvas)}"${size}${crisp} ` +
    `role="img" data-qr-shape="${look.shape}" data-qr-pattern="${look.pattern}" data-qr-centre="${look.centre.kind}">` +
    ground +
    `<path d="${finders.join('')}" fill="${dark}" fill-rule="evenodd"/>` +
    body +
    overlayG +
    `</svg>`
  );
}
