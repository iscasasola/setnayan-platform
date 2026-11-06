import QRCode from 'qrcode';
import { outlineWords } from '@/lib/logo-fonts';
import { diePathFor, type PrintDoc, type PrintOp } from '@/lib/print-layout';
import { BLEED_MM, PT_PER_MM } from '@/lib/print-pieces';
import { renderPrintSvg } from '@/lib/print-render-svg';
import { renderPrintPdf } from '@/lib/print-render-pdf';
import { QUIET } from '@/lib/qr-style-svg';
import { badgePillOps, jostFace, setnayanMarkOps } from '@/lib/shop-badge-print';
import type { ShopBadge } from '@/lib/shop-badges';
import {
  DOOR_STICKER_CM,
  DOOR_STICKER_SCAN_LINE,
  DOOR_STICKER_SIZE_LABEL,
  DOOR_STICKER_WORDS,
  type DoorStickerCode,
  type DoorStickerSize,
} from '@/lib/door-sticker';

/**
 * 🚪 THE DOOR STICKER ON PAPER — "We are part of SETNAYAN", one square a sign or sticker printer can cut (owner
 * 2026-11-05: *"add them to the marketing tools"*; the pure half is `lib/door-sticker.ts`).
 *
 *   the Setnayan mark · WE ARE PART OF · SETNAYAN · the shop's code on a white plate · what a scan opens · the shop's
 *   name · the badges it wears today
 *
 * 🔑 ONE `PrintDoc`, THE PRINT PIPELINE'S TWO BACKENDS. The sticker is laid out once in print ops and drawn by the SAME
 * `renderPrintSvg` and `renderPrintPdf` that draw every couple print — so the SVG and the PDF cannot disagree, and the
 * PDF carries the house's bleed, crop marks and die line. Nothing here is a second print system.
 *
 * 🔑 EVERY MARK IS A SHAPE. The words are outlined Jost (the hub's `public/logo-fonts/jost.ttf`, the face the badges
 * file outlines with — `jostFace`); the code is its own modules as one path (level H, a quiet zone of `QUIET`); the
 * mark is the shipped artwork, flattened. A printer's machine needs no font and no image.
 *
 * Laid out in hundredths of the side (`u`), so the window size is the door size drawn twice as large — same ink, same
 * proportions, still vector.
 */

const CREAM = '#F7F2E8';
const INK = '#2B2620';
const SOFT = '#5C544A';
const GOLD = '#cb9e4b';
const CODE_INK = '#1A1A1A';

const n = (v: number) => Math.round(v * 100) / 100;

export type DoorStickerInput = {
  shopName: string;
  /** What the code opens — the SAME address the QR card shows (`myPageUrl` / `checkADateUrl`). */
  url: string;
  code: DoorStickerCode;
  size: DoorStickerSize;
  /** `badgesForPrint(...)` from facts read NOW. Empty = the sticker prints without a badge row. */
  badges: readonly ShopBadge[];
};

/** The side of the sticker in points. */
export function doorStickerSidePt(size: DoorStickerSize): number {
  return DOOR_STICKER_CM[size] * 10 * PT_PER_MM;
}

/** Words, outlined, centred on `cx` with their baseline at `y`. Shrunk to `maxWidth` when they are wider. */
function centredWords(words: string, cx: number, y: number, size: number, opts: { spacing?: number; maxWidth?: number; fill: string }): PrintOp {
  const f = jostFace();
  const spacing = opts.spacing ?? 0;
  let s = size;
  let probe = outlineWords(f, words, 0, 0, s, spacing).getBoundingBox();
  if (opts.maxWidth && probe.x2 - probe.x1 > opts.maxWidth) {
    s = size * (opts.maxWidth / (probe.x2 - probe.x1));
    probe = outlineWords(f, words, 0, 0, s, spacing).getBoundingBox();
  }
  const width = probe.x2 - probe.x1;
  const p = outlineWords(f, words, cx - width / 2 - probe.x1, y, s, spacing);
  return { t: 'path', d: p.toPathData(2), fill: opts.fill, text: { s: words, size: s, asked: size, maxWidth: opts.maxWidth, width } };
}

/** A rounded square's outline. */
function roundedSquare(x: number, y: number, side: number, r: number): string {
  const e = x + side;
  const b = y + side;
  return `M${n(x + r)} ${n(y)}H${n(e - r)}Q${n(e)} ${n(y)} ${n(e)} ${n(y + r)}V${n(b - r)}Q${n(e)} ${n(b)} ${n(e - r)} ${n(b)}H${n(x + r)}Q${n(x)} ${n(b)} ${n(x)} ${n(b - r)}V${n(y + r)}Q${n(x)} ${n(y)} ${n(x + r)} ${n(y)}Z`;
}

/**
 * The code's dark modules as ONE path — one rectangle per run of dark modules in a row — inside a `side`-wide square
 * at (x, y) that includes the quiet zone. Level H: ~30 % of it can be scuffed off a door and it still reads.
 */
export function qrModulesPath(url: string, x: number, y: number, side: number): string {
  const qr = QRCode.create(url, { errorCorrectionLevel: 'H' });
  const count = qr.modules.size;
  const cell = side / (count + QUIET * 2);
  const at = (i: number) => n(i * cell);
  const out: string[] = [];
  for (let r = 0; r < count; r++) {
    let c = 0;
    while (c < count) {
      if (!qr.modules.get(r, c)) {
        c++;
        continue;
      }
      const start = c;
      while (c < count && qr.modules.get(r, c)) c++;
      const x0 = x + (start + QUIET) * cell;
      const y0 = y + (r + QUIET) * cell;
      out.push(`M${n(x0)} ${n(y0)}h${at(c - start)}v${n(cell)}h${n(-(c - start) * cell)}Z`);
    }
  }
  return out.join('');
}

/** The badges as one row (two when one row would print them too small), centred on `cx`, top at `top`. */
function badgeRows(badges: readonly ShopBadge[], cx: number, top: number, u: number, maxWidth: number): PrintOp[] {
  if (badges.length === 0) return [];
  const gap = 1.4 * u;
  const widthAt = (row: readonly ShopBadge[], F: number) =>
    row.reduce((sum, b) => sum + badgePillOps(b, F, 0, 0).width, 0) + gap * (row.length - 1);
  const ONE_ROW_F = 2.2 * u;
  const MIN_F = 1.55 * u;
  const one = widthAt(badges, ONE_ROW_F);
  let rows: Array<readonly ShopBadge[]>;
  let F: number;
  if (one <= maxWidth) {
    rows = [badges];
    F = ONE_ROW_F;
  } else if (one * (MIN_F / ONE_ROW_F) <= maxWidth) {
    rows = [badges];
    F = ONE_ROW_F * (maxWidth / one);
  } else {
    const half = Math.ceil(badges.length / 2);
    rows = [badges.slice(0, half), badges.slice(half)];
    F = Math.min(MIN_F, ...rows.map((r) => MIN_F * (maxWidth / widthAt(r, MIN_F))));
  }
  const ops: PrintOp[] = [];
  let y = top;
  for (const row of rows) {
    let x = cx - widthAt(row, F) / 2;
    let h = 0;
    for (const b of row) {
      const drawn = badgePillOps(b, F, x, y);
      ops.push(...drawn.ops);
      x += drawn.width + gap;
      h = Math.max(h, drawn.height);
    }
    y += h + 0.9 * u;
  }
  return ops;
}

/** The sticker as ONE `PrintDoc` — what both files are drawn from. */
export function layoutDoorSticker(input: DoorStickerInput): PrintDoc {
  const S = doorStickerSidePt(input.size);
  const u = S / 100;
  const bleed = BLEED_MM * PT_PER_MM;
  const cx = S / 2;
  const hasBadges = input.badges.length > 0;
  const ops: PrintOp[] = [
    // The ground runs into the bleed, so a cut a hair off the line leaves no white edge.
    { t: 'rect', x: -bleed, y: -bleed, w: S + bleed * 2, h: S + bleed * 2, fill: CREAM },
    // A thin gold frame inside the cut — the badge's foil edge, drawn once around the whole sticker.
    { t: 'path', d: roundedSquare(3.5 * u, 3.5 * u, 93 * u, 3.4 * u), stroke: GOLD, sw: 0.35 * u },
    ...setnayanMarkOps(cx, 9 * u, 8 * u, GOLD),
    centredWords(DOOR_STICKER_WORDS.lead, cx, 17.6 * u, 3.2 * u, { spacing: 32, fill: SOFT }),
    centredWords(DOOR_STICKER_WORDS.brand, cx, 25 * u, 7 * u, { spacing: 18, fill: INK }),
  ];
  // The code: dark on a white plate, as every Setnayan code is (a scanner needs it).
  const plate = 42 * u;
  const px = cx - plate / 2;
  const py = 28.5 * u;
  ops.push({ t: 'path', d: roundedSquare(px, py, plate, 2.2 * u), fill: '#FFFFFF' });
  ops.push({ t: 'path', d: qrModulesPath(input.url, px, py, plate), fill: CODE_INK });
  ops.push(centredWords(DOOR_STICKER_SCAN_LINE[input.code], cx, 75 * u, 2.9 * u, { fill: SOFT }));
  ops.push(centredWords(input.shopName.trim() || 'Our shop', cx, hasBadges ? 82 * u : 86 * u, hasBadges ? 5.2 * u : 6 * u, { maxWidth: 80 * u, fill: INK }));
  ops.push(...badgeRows(input.badges, cx, 85.6 * u, u, 84 * u));
  return { piece: 'door-sticker', w: S, h: S, bleed, die: 'rounded', diePath: diePathFor('rounded', S, S), ops };
}

/**
 * The sticker as an SVG file — `renderPrintSvg`'s drawing, sized in MILLIMETRES so a printer opens it at its real
 * size (the renderer's own width/height are screen units).
 */
export function doorStickerSvg(input: DoorStickerInput): string {
  const doc = layoutDoorSticker(input);
  const mm = DOOR_STICKER_CM[input.size] * 10;
  const drawn = renderPrintSvg(doc, {}, { idPrefix: `door-${input.size}` });
  const sized = drawn.replace(/^<svg ([^>]*?)width="[^"]*" height="[^"]*">/, `<svg $1width="${mm}mm" height="${mm}mm">`);
  return `<?xml version="1.0" encoding="UTF-8"?>${sized.replace(/^(<svg[^>]*>)/, `$1<title>${escapeXml(`${input.shopName} — We are part of SETNAYAN`)}</title>`)}`;
}

/** The sticker as a print-ready PDF — the house's `renderPrintPdf` in print mode: 3 mm bleed, crop marks, die line. */
export async function doorStickerPdf(input: DoorStickerInput): Promise<Uint8Array> {
  return renderPrintPdf([layoutDoorSticker(input)], {}, {
    mode: 'print',
    title: `${input.shopName} — We are part of SETNAYAN`,
    subject: `Door sticker · ${DOOR_STICKER_CM[input.size]} × ${DOOR_STICKER_CM[input.size]} cm`,
  });
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
