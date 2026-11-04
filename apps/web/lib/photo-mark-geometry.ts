/**
 * lib/photo-mark-geometry.ts — THE SEAL AND PLATE, AS NUMBERS. Pure: no DOM, no
 * `sharp`, no font file. Both painters import this and nothing else decides
 * where a single pixel of the mark goes:
 *
 *   · `lib/photo-mark-canvas.ts`  — the browser (FileUpload, the Frame step's
 *     live preview, the PNG overlay burned into a showcase clip);
 *   · `lib/watermark-server.ts`   — `supplierMarkOverlaySvg`, the server (the
 *     re-mark job, supplier inspiration uploads).
 *
 * 🔒 THE CONTRACT is the owner-approved prototype
 * `setnayan-handoff-src/prototypes-4nov/supplier_photo_mark_2026-11-04_fable.html`
 * (direction A, "Seal and plate"), section "Rules the canvas follows". Every
 * constant below is a line of that section; `drawPlate` / `drawMark` in its
 * script are the reference and this is their layout half, ported verbatim.
 *
 * WHY A MEASURE CALLBACK: the two painters measure text differently (canvas
 * `measureText` over the loaded FontFace; opentype advance widths over the same
 * TTF on the server). The RULES — the name shrinking to a 0.7× floor before any ellipsis, the address shrinking to
 * an 80 % floor, the plate growing to 0.6·S — are here once; only the ruler is
 * injected. Both rulers read the SAME bundled files (`public/logo-fonts/jost.ttf`,
 * `cormorant.ttf`), so the two paths agree to within kerning.
 *
 * 🔑 THE FIT IS CHECKED, NOT HOPED. The prototype's tier thresholds (180 / 120
 * px) are kept AND every tier is checked against the safe square; a plate that
 * would not fit falls to the next tier rather than shearing off the edge
 * (MB20's lesson: canvas clips and reports success).
 */
import {
  MARK_ADDRESS,
  MARK_CAPS,
  MARK_CAPS_VERIFIED,
  markVerifiedAddress,
} from './watermark-text';

/* ── colours and the Setnayan mark itself, verbatim from the approved page ── */

/** The Setnayan "SY" mark, in its own 5333.3335-unit box (y flipped, ×1.3333). */
export const SY_PATH =
  'M 1859.526,3749.781 C 1458.028,3717.757 1065.454,3548.554 758.3406,3241.44 451.2286,2934.328 282.2397,2541.742 250.2195,2140.255 l 1326.8215,1.536 V 661.7647 C 1368.543,727.4195 1172.067,841.5416 1006.804,1006.804 768.3191,1245.29 633.8543,1548.261 602.7217,1859.526 H 250 C 282.024,1458.028 451.2265,1065.455 758.3406,758.3406 1065.453,451.2287 1458.039,282.2396 1859.526,250.2195 V 2422.739 H 661.7647 c 65.6549,208.498 179.7773,404.975 345.0393,570.237 238.486,238.486 541.457,372.95 852.722,404.083 z m 280.948,0 1.537,-1609.307 h 280.948 v 1197.761 c 208.498,-65.655 404.974,-179.776 570.237,-345.039 238.485,-238.486 372.95,-541.457 404.082,-852.722 H 3750 c -32.024,401.498 -201.226,794.071 -508.341,1101.185 -307.112,307.112 -699.697,476.101 -1101.185,508.122 z m 0,-1890.255 c 32.025,-401.498 201.227,-794.073 508.341,-1101.1854 0.658,-0.6584 1.316,-1.3173 1.975,-1.9754 -80.395,-42.041 -163.892,-76.0428 -249.331,-101.7389 -85.439,-25.696 -172.821,-43.0864 -260.985,-51.9046 V 250.2195 c 401.497,32.0253 794.073,201.0094 1101.185,508.1211 307.114,307.1134 476.317,699.6874 508.341,1101.1854 h -352.722 c -31.132,-311.265 -165.597,-614.236 -404.082,-852.722 -15.719,-15.7189 -32.464,-29.741 -48.727,-44.5564 -15.975,14.4789 -31.774,29.1397 -47.191,44.5564 -238.485,238.486 -372.95,541.457 -404.082,852.722 z';
export const SY_BOX_UNITS = 5333.3335;

export const MARK_GOLD = '#E9CF86';
export const MARK_IVORY = '#FFFDF7';
export const MARK_ADDR_INK = 'rgba(255,253,247,.86)';
export const MARK_PLATE = 'rgba(20,18,16,0.46)';
export const MARK_HAIR = 'rgba(233,207,134,0.5)';
export const MARK_RIM = ['#7A5C22', '#FBEFC4', '#B88D3B', '#EBD08A', '#7A5C22'] as const;
export const MARK_RIM_POS = [0, 0.28, 0.5, 0.74, 1] as const;
export const MARK_FACE = ['#335282', '#101C36'] as const;
export const MARK_COIN_FACE = ['#FFFEFA', '#ECE1CB'] as const;

/** The two bundled faces both painters read (browser: FontFace; server: opentype). */
export const MARK_FONT_FILES = {
  jost: 'public/logo-fonts/jost.ttf',
  cormorant: 'public/logo-fonts/cormorant.ttf',
} as const;
export const MARK_FONT_URLS = { jost: '/logo-fonts/jost.ttf', cormorant: '/logo-fonts/cormorant.ttf' } as const;

/* ── types ───────────────────────────────────────────────────────────────── */

/**
 * WHAT the mark says. Built on the SERVER from the shop's own row
 * (`lib/supplier-mark-spec.server.ts`) — never from client props.
 *   setnayan  — Setnayan only (admin library, an unverified shop).
 *   supplier  — Setnayan Verified + the shop name + setnayan.com/v/<slug>,
 *               when `verified`; otherwise identical to `setnayan`.
 */
export type MarkSpec =
  | { kind: 'setnayan' }
  | { kind: 'supplier'; verified: boolean; shopName: string | null; slug: string | null; hasLogo: boolean };

export type MarkFont = 'caps' | 'name' | 'addr';
/** Width in px of `text` set in `font` at `px`, untracked. */
export type MarkMeasure = (text: string, font: MarkFont, px: number) => number;

// Box, FrameShape and FRAME_ASPECT live in a leaf module so a page that only DISPLAYS a framed photo
// (FramedImg → lib/photo-frame.ts) never pulls this whole module — the SY path, the palette, the font URLs —
// into its first load. They are re-exported here, so this stays the one place a painter imports them from.
import { FRAME_ASPECT, type Box, type FrameShape } from './photo-frame-shape';
export { FRAME_ASPECT, type Box, type FrameShape } from './photo-frame-shape';

export type MarkLine = {
  text: string;
  font: MarkFont;
  px: number;
  /** left edge of the first glyph */
  x: number;
  /** top of the line box (the painters use textBaseline 'top') */
  y: number;
  /** extra px between characters (caps only) */
  tracking: number;
  color: string;
  /** measured width including tracking */
  width: number;
};

export type MarkTier = 'full' | 'compact' | 'text';

export type MarkLayout = {
  tier: MarkTier;
  /** the centred square every object-cover crop keeps */
  safe: { left: number; top: number; size: number };
  plate: Box;
  radius: number;
  hairline: number;
  seal: { cx: number; cy: number; D: number } | null;
  coin: { cx: number; cy: number; d: number } | null;
  lines: MarkLine[];
};

/** Where the mark sits inside its safe square: bottom-right, or bottom-centre for a circle. */
export type MarkAnchor = 'br' | 'bc';

/* ── the rules ───────────────────────────────────────────────────────────── */

const FULL_MIN = 180;
const COMPACT_MIN = 120;

export function safeSquare(W: number, H: number): { left: number; top: number; size: number } {
  const S = Math.min(W, H);
  return { left: (W - S) / 2, top: (H - S) / 2, size: S };
}

function linesFor(spec: MarkSpec): Array<{ t: string; k: MarkFont }> {
  if (spec.kind === 'supplier' && spec.verified && spec.slug) {
    return [
      { t: MARK_CAPS_VERIFIED, k: 'caps' },
      { t: spec.shopName?.trim() || spec.slug, k: 'name' },
      { t: markVerifiedAddress(spec.slug), k: 'addr' },
    ];
  }
  return [
    { t: MARK_CAPS, k: 'caps' },
    { t: MARK_ADDRESS, k: 'addr' },
  ];
}

function trackedWidth(measure: MarkMeasure, text: string, px: number, em: number): number {
  let w = 0;
  for (const ch of text) w += measure(ch, 'caps', px) + em;
  return Math.max(0, w - em);
}

/** The shop name's readable floor: it shrinks to 0.7× its size before it takes an ellipsis. */
export const NAME_FLOOR = 0.7;

function ellipsize(measure: MarkMeasure, text: string, font: MarkFont, px: number, max: number, em = 0): string {
  const width = (t: string) => (em ? trackedWidth(measure, t, px, em) : measure(t, font, px));
  if (width(text) <= max) return text;
  let t = text;
  while (t.length > 1 && width(`${t}…`) > max) t = t.slice(0, -1);
  return `${t.replace(/[\s.&-]+$/, '')}…`;
}

/**
 * The plate tier — `drawPlate` of the approved page, as numbers. `withCaps` /
 * `withCoin` are dropped by the compact tier ("drop the coin and the caps line,
 * keep seal + address").
 */
function plateLayout(
  W: number,
  H: number,
  spec: MarkSpec,
  measure: MarkMeasure,
  anchor: MarkAnchor,
  tier: 'full' | 'compact',
): MarkLayout {
  const safe = safeSquare(W, H);
  const S = safe.size;
  const m = Math.max(12, Math.round(0.04 * S));
  const D = Math.min(128, Math.max(28, Math.round(0.11 * S)));
  const fCap = Math.max(10, Math.round(0.022 * S));
  const fName = Math.max(14, Math.round(0.036 * S));
  const fAddr0 = Math.max(12, Math.round(0.03 * S));
  let fAddr = fAddr0;
  const padX = Math.round(0.22 * D);
  const padY = Math.round(0.12 * D);
  const gap = Math.round(0.18 * D);
  const lineGap = Math.round(0.35 * fCap);

  const hasCoin = tier === 'full' && spec.kind === 'supplier' && spec.verified && spec.hasLogo && !!spec.slug;
  const coinD = Math.round(0.78 * D);
  const sealsW = D + (hasCoin ? 0.56 * D + coinD / 2 - D / 2 : 0);

  let src = linesFor(spec);
  if (tier === 'compact') src = src.filter((l) => l.k === 'addr');

  let maxPlate = 0.5 * S;
  let col = maxPlate - 2 * padX - sealsW - gap;
  const addr = src.find((l) => l.k === 'addr')!;
  let aw = measure(addr.t, 'addr', fAddr);
  const floor = Math.round(0.8 * fAddr0);
  while (aw > col && fAddr > floor) {
    fAddr -= 1;
    aw = measure(addr.t, 'addr', fAddr);
  }
  if (aw > col) {
    maxPlate = Math.min(0.6 * S, aw + 2 * padX + sealsW + gap);
    col = maxPlate - 2 * padX - sealsW - gap;
  }
  // Past the approved page's last rule (the plate at 0.6·S) the address would
  // run off the plate. It is still never cut: it keeps shrinking until it fits.
  // (Unreachable for any slug under ~30 characters at S ≥ 180.)
  while (aw > col && fAddr > 6) {
    fAddr -= 1;
    aw = measure(addr.t, 'addr', fAddr);
  }

  // 🔒 THE SHOP NAME SHRINKS BEFORE IT IS EVER CUT (controller, 2026-11-04:
  // "Bloom & Vine Studio" must show whole on a normal photo). Like the address,
  // the plate may first grow to 0.6·S for it; then the name steps down to a
  // readable floor of 0.7× its size; only past that floor does it take an "…".
  const nameSrc = src.find((l) => l.k === 'name');
  let fNameUsed = fName;
  if (nameSrc) {
    const nameFloor = Math.max(10, Math.round(NAME_FLOOR * fName));
    let nw = measure(nameSrc.t, 'name', fNameUsed);
    if (nw > col) {
      maxPlate = Math.max(maxPlate, Math.min(0.6 * S, nw + 2 * padX + sealsW + gap));
      col = maxPlate - 2 * padX - sealsW - gap;
    }
    while (nw > col && fNameUsed > nameFloor) {
      fNameUsed -= 1;
      nw = measure(nameSrc.t, 'name', fNameUsed);
    }
  }

  const sized: Array<{ text: string; font: MarkFont; px: number; h: number; w: number; tracking: number }> = [];
  for (const l of src) {
    if (l.k === 'caps') {
      const em = 0.16 * fCap;
      const text = ellipsize(measure, l.t, 'caps', fCap, col, em);
      sized.push({ text, font: 'caps', px: fCap, h: fCap, w: trackedWidth(measure, text, fCap, em), tracking: em });
    } else if (l.k === 'name') {
      const text = ellipsize(measure, l.t, 'name', fNameUsed, col);
      sized.push({ text, font: 'name', px: fNameUsed, h: fNameUsed, w: measure(text, 'name', fNameUsed), tracking: 0 });
    } else {
      sized.push({ text: l.t, font: 'addr', px: fAddr, h: fAddr, w: measure(l.t, 'addr', fAddr), tracking: 0 });
    }
  }
  let textW = 0;
  let textH = 0;
  for (const l of sized) {
    textW = Math.max(textW, Math.min(l.w, col));
    textH += l.h;
  }
  textH += lineGap * (sized.length - 1);

  const plateH = D + 2 * padY;
  const plateW = Math.round(padX + sealsW + gap + textW + padX);
  const right = safe.left + S - m;
  const bottom = safe.top + S - m;
  const plate: Box = { left: Math.round(right - plateW), top: Math.round(bottom - plateH), width: plateW, height: plateH };
  if (anchor === 'bc') {
    const m2 = Math.round(0.07 * S);
    plate.left = Math.round(safe.left + (S - plateW) / 2);
    plate.top = Math.round(safe.top + S - m2 - plateH);
  }
  const cy = plate.top + plateH / 2;
  const sx = plate.left + padX + D / 2;
  const x = plate.left + padX + sealsW + gap;
  let y = cy - textH / 2;
  const lines: MarkLine[] = sized.map((l) => {
    const line: MarkLine = {
      text: l.text,
      font: l.font,
      px: l.px,
      x,
      y: l.font === 'name' ? y - l.px * 0.08 : y,
      tracking: l.tracking,
      color: l.font === 'caps' ? MARK_GOLD : l.font === 'name' ? MARK_IVORY : MARK_ADDR_INK,
      width: l.w,
    };
    y += l.h + lineGap;
    return line;
  });

  return {
    tier,
    safe,
    plate,
    radius: plateH / 2,
    hairline: Math.max(1, 0.0015 * S),
    seal: { cx: sx, cy, D },
    coin: hasCoin ? { cx: sx + 0.56 * D, cy, d: coinD } : null,
    lines,
  };
}

/**
 * The tiny tier: "under 120 px, keep the shipped text-only plate with the
 * address". The address shrinks until it fits; it is never cut.
 */
function textLayout(W: number, H: number, spec: MarkSpec, measure: MarkMeasure, anchor: MarkAnchor): MarkLayout {
  const safe = safeSquare(W, H);
  const S = safe.size;
  const m = Math.max(2, Math.round(0.04 * S));
  // The shop's own address when it fits at a readable size; else the bare
  // setnayan.com (a 70-character slug cannot be drawn on a 60 px thumbnail).
  const own = linesFor(spec).find((l) => l.k === 'addr')!.t;
  const fitsAt = (t: string, size: number) => measure(t, 'addr', size) <= S - 2 * m - 2 * Math.max(2, Math.round(0.5 * size));
  const addr = fitsAt(own, 6) ? own : MARK_ADDRESS;
  let px = Math.max(6, Math.round(0.1 * S));
  const room = () => S - 2 * m - 2 * Math.max(2, Math.round(0.5 * px));
  while (px > 4 && measure(addr, 'addr', px) > room()) px -= 1;
  const padX = Math.max(2, Math.round(0.5 * px));
  const padY = Math.max(2, Math.round(0.35 * px));
  const w = Math.min(S - 2 * m, measure(addr, 'addr', px));
  const plateW = Math.round(w + 2 * padX);
  const plateH = Math.round(px + 2 * padY);
  const left = anchor === 'bc' ? Math.round(safe.left + (S - plateW) / 2) : Math.round(safe.left + S - m - plateW);
  const plate: Box = { left, top: Math.round(safe.top + S - m - plateH), width: plateW, height: plateH };
  return {
    tier: 'text',
    safe,
    plate,
    radius: plateH / 2,
    hairline: 0,
    seal: null,
    coin: null,
    lines: [
      { text: addr, font: 'addr', px, x: plate.left + padX, y: plate.top + padY, tracking: 0, color: MARK_ADDR_INK, width: w },
    ],
  };
}

/** True when every part of the layout sits inside `box` (inclusive, ½px slack for rounding). */
export function layoutInside(l: MarkLayout, box: Box): boolean {
  const e = 0.5;
  const inBox = (b: Box) =>
    b.left >= box.left - e &&
    b.top >= box.top - e &&
    b.left + b.width <= box.left + box.width + e &&
    b.top + b.height <= box.top + box.height + e;
  if (!inBox(l.plate)) return false;
  for (const line of l.lines) {
    if (!inBox({ left: line.x, top: line.y, width: Math.min(line.width, l.plate.width), height: line.px })) return false;
  }
  return true;
}

/**
 * Lay the mark out for an image (or a frame's mark square) of W×H. Picks the
 * richest tier that FITS the safe square: full ≥180 px, compact ≥120 px, text
 * below — and falls a tier when the plate would not fit, so the result is always
 * inside the safe square.
 */
export function layoutMark(
  W: number,
  H: number,
  spec: MarkSpec,
  measure: MarkMeasure,
  anchor: MarkAnchor = 'br',
): MarkLayout {
  const safe = safeSquare(W, H);
  const box: Box = { left: safe.left, top: safe.top, width: safe.size, height: safe.size };
  if (safe.size >= FULL_MIN) {
    const full = plateLayout(W, H, spec, measure, anchor, 'full');
    if (layoutInside(full, box)) return full;
  }
  if (safe.size >= COMPACT_MIN) {
    const compact = plateLayout(W, H, spec, measure, anchor, 'compact');
    if (layoutInside(compact, box)) return compact;
  }
  return textLayout(W, H, spec, measure, anchor);
}

/** Shift a layout by (dx, dy) — for a mark laid out in a frame's square, then placed on the whole image. */
export function offsetLayout(l: MarkLayout, dx: number, dy: number): MarkLayout {
  const mv = (b: Box): Box => ({ ...b, left: b.left + dx, top: b.top + dy });
  return {
    ...l,
    safe: { ...l.safe, left: l.safe.left + dx, top: l.safe.top + dy },
    plate: mv(l.plate),
    seal: l.seal && { ...l.seal, cx: l.seal.cx + dx, cy: l.seal.cy + dy },
    coin: l.coin && { ...l.coin, cx: l.coin.cx + dx, cy: l.coin.cy + dy },
    lines: l.lines.map((x) => ({ ...x, x: x.x + dx, y: x.y + dy })),
  };
}

/* ── frames ──────────────────────────────────────────────────────────────── */


/**
 * The square inside a frame the mark is stamped in (`markSquare` of the
 * template): the square itself; the right-most square of a wide band; the
 * bottom square of a tall one. All in the same units as `frame`.
 */
export function markSquareForFrame(frame: Box): Box {
  const s = Math.min(frame.width, frame.height);
  return { left: frame.left + frame.width - s, top: frame.top + frame.height - s, width: s, height: s };
}

/**
 * Lay the mark out INSIDE a frame on the whole image: the frame's mark square,
 * anchored bottom-right (bottom-centre for a circle). The result is in image
 * pixels and is inside `frame` by construction (`layoutInside` asserts it).
 */
export function layoutMarkInFrame(frame: Box, shape: FrameShape, spec: MarkSpec, measure: MarkMeasure): MarkLayout {
  const sq = markSquareForFrame(frame);
  const l = layoutMark(sq.width, sq.height, spec, measure, shape === 'circle' ? 'bc' : 'br');
  return offsetLayout(l, sq.left, sq.top);
}

/* ── which displays may show a framed photo ─────────────────────────────── */

/**
 * The aspects (w/h) a display may draw a photo of each frame at while keeping
 * its mark whole. The rule, from the template's "any size" derivation: a place
 * keeps the frame crop's height and widens (or keeps its width and grows down),
 * cutting from the TOP when the original runs out — so the frame's bottom-right
 * square, where the mark lives, is always in view. The limit is the ORIGINAL's
 * room around the frame, which a display cannot know in general, so the guard
 * pins a conservative band per frame instead:
 *   square/circle  5:7 … 1.91:1  (the narrowest card to a link preview)
 *   wide           1.91:1 … 4.4:1 (the shop hero's widest desktop band)
 *   phone          9:16 … 16:9   (the hub's phone view and its desktop view)
 * A display outside its band must use a different frame (a wide display uses
 * the WIDE-framed shop cover, never a square cover stretched to 3:1) or draw the
 * photo whole, letterboxed.
 */
export const FRAME_DISPLAY_ASPECT: Readonly<Record<FrameShape, readonly [number, number]>> = {
  square: [5 / 7, 1.91],
  circle: [5 / 7, 1.91],
  wide: [1.91, 4.4],
  phone: [9 / 16, 16 / 9],
};

export function displayAspectAllowed(shape: FrameShape, aspect: number): boolean {
  const [lo, hi] = FRAME_DISPLAY_ASPECT[shape];
  return aspect >= lo - 1e-6 && aspect <= hi + 1e-6;
}

/* ── the seal's scallop ring, shared so both painters draw the same outline ── */

/** Points of the 24-lobe scalloped rim: each lobe is an arc of radius `lobe` centred on the ring. */
export function sealLobes(cx: number, cy: number, D: number): Array<{ x: number; y: number; r: number; a0: number; a1: number }> {
  const n = 24;
  const ring = 0.46 * D;
  const lobe = 0.064 * D;
  const out: Array<{ x: number; y: number; r: number; a0: number; a1: number }> = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    out.push({ x: cx + Math.cos(a) * ring, y: cy + Math.sin(a) * ring, r: lobe, a0: a - Math.PI / 2, a1: a + Math.PI / 2 });
  }
  return out;
}
