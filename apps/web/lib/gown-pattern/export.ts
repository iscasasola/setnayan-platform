/**
 * 👗 gown-pattern/export — the blocks at TRUE SIZE, tiled onto home paper (plan step B12; owner D28, 28 Nov: A4 and US
 * Letter, PH long bond only if someone asks; D29: allowances on by default; D30: centimetres).
 *
 * `gownExportPlan` is pure: it lays the pieces out on one big sheet (in mm) — each with its cut line (solid) and its
 * sewing line (dashed when allowances are on), grain arrow, darts, guide lines and words — then cuts that sheet into
 * pages of the chosen paper, with 10 mm margins. Page 1 is the map: a 5 cm test square to measure before anything is
 * cut, the grid of pages, and the notes (allowances, "ESTIMATE: measure before cutting" when any number is an
 * estimate). Every other page is one tile, named by row letter and column number, with corner marks to tape to its
 * neighbours; a page with nothing of the pattern on it is not printed. Everything is in PDF points (1 mm = 72 / 25.4 pt), so 50 mm is 141.73 pt in the file, exactly.
 *
 * `gownExportPdf` draws that plan with `pdf-lib`, imported only when the designer taps Export. Designer only: no
 * price, no amount, nothing about money, on any page.
 * 🔒 lib/gown-pattern/export.test.ts
 */
import type { GownBlockPiece, GownPoint } from './skirt';
import { gownCutLine, type GownSeamAllowance } from './allowance';

export const GOWN_PAPERS = {
  a4: { label: 'A4', wMm: 210, hMm: 297 },
  letter: { label: 'US Letter', wMm: 215.9, hMm: 279.4 },
} as const;
export type GownPaper = keyof typeof GOWN_PAPERS;
export const GOWN_EXPORT_MARGIN_MM = 10;
export const GOWN_TEST_SQUARE_MM = 50;
export const PT_PER_MM = 72 / 25.4;

/** One thing to draw, in the PAGE's own points, y measured DOWN from the page's top edge. */
export type GownExportOp =
  | { k: 'line'; pts: GownPoint[]; closed: boolean; width: number; dash?: [number, number] }
  | { k: 'text'; x: number; y: number; size: number; bold?: boolean; text: string }
  | { k: 'rect'; x: number; y: number; w: number; h: number; width: number };
export type GownExportPage = { wPt: number; hPt: number; name: string; ops: GownExportOp[] };
export type GownExportPlan = { paper: GownPaper; rows: number; cols: number; sheetMm: { w: number; h: number }; pages: GownExportPage[]; blank: string[] };

type SheetOp = { k: 'line'; pts: GownPoint[]; closed: boolean; width: number; dash?: [number, number] } | { k: 'text'; x: number; y: number; size: number; bold?: boolean; text: string };

/** The whole pattern as one sheet, mm, y down. */
function sheetOf(pieces: readonly GownBlockPiece[], sa: GownSeamAllowance): { w: number; h: number; ops: SheetOp[] } {
  const pad = 15, gap = 30, ops: SheetOp[] = [];
  let x0 = pad, maxH = 0;
  for (const p of pieces) {
    const cut = gownCutLine(p, sa);
    const all = [...p.outline, ...(cut ?? [])];
    const minX = Math.min(...all.map((q) => q[0])), maxX = Math.max(...all.map((q) => q[0]));
    const minY = Math.min(...all.map((q) => q[1])), maxY = Math.max(...all.map((q) => q[1]));
    const ox = x0 - minX, oy = pad - minY, at = (q: GownPoint): GownPoint => [q[0] + ox, q[1] + oy];
    if (cut) ops.push({ k: 'line', pts: cut.map(at), closed: true, width: 0.5 });
    ops.push({ k: 'line', pts: p.outline.map(at), closed: true, width: cut ? 0.3 : 0.5, ...(cut ? { dash: [3, 2] as [number, number] } : {}) });
    for (const d of p.darts) {
      const pts: GownPoint[] = 'a' in d ? [d.a, d.apex, d.b] : [[d.x - d.w / 2, 0], [d.x, d.len], [d.x + d.w / 2, 0]];
      ops.push({ k: 'line', pts: pts.map(at), closed: false, width: 0.3 });
    }
    for (const [mx, my, t] of p.marks) {
      ops.push({ k: 'line', pts: [at([0, my]), at([mx, my])], closed: false, width: 0.2, dash: [4, 3] });
      ops.push({ k: 'text', x: ox + 4, y: oy + my - 2, size: 4, text: `${t} line` });
    }
    for (const [px, py, t] of p.points) {
      ops.push({ k: 'line', pts: [at([px - 4, py]), at([px + 4, py])], closed: false, width: 0.3 });
      ops.push({ k: 'line', pts: [at([px, py - 4]), at([px, py + 4])], closed: false, width: 0.3 });
      ops.push({ k: 'text', x: ox + px + 5, y: oy + py - 3, size: 4, text: t });
    }
    // the grain: a line with an arrow head at each end
    const [g1, g2] = p.grain, gx = g2[0] - g1[0], gy = g2[1] - g1[1], gl = Math.hypot(gx, gy) || 1, ux = gx / gl, uy = gy / gl;
    ops.push({ k: 'line', pts: [at(g1), at(g2)], closed: false, width: 0.3 });
    for (const [e, s] of [[g2, 1], [g1, -1]] as const) {
      ops.push({ k: 'line', pts: [at([e[0] - s * ux * 5 - uy * 2.5, e[1] - s * uy * 5 + ux * 2.5]), at(e), at([e[0] - s * ux * 5 + uy * 2.5, e[1] - s * uy * 5 - ux * 2.5])], closed: false, width: 0.3 });
    }
    const ty = Math.min(maxY - minY - 25, 45);
    ops.push({ k: 'text', x: x0 + 8, y: pad + ty, size: 7, bold: true, text: p.name });
    ops.push({ k: 'text', x: x0 + 8, y: pad + ty + 8, size: 5, text: p.cut });
    maxH = Math.max(maxH, maxY - minY);
    x0 += maxX - minX + gap;
  }
  return { w: x0 - gap + pad, h: maxH + 2 * pad, ops };
}

const rowName = (i: number) => String.fromCharCode(65 + (i % 26)) + (i >= 26 ? String(Math.floor(i / 26)) : '');

export function gownExportPlan(
  pieces: readonly GownBlockPiece[],
  opts: { paper: GownPaper; allowance: GownSeamAllowance; title: string; estimate: boolean },
): GownExportPlan {
  const paper = GOWN_PAPERS[opts.paper], m = GOWN_EXPORT_MARGIN_MM, P = PT_PER_MM;
  const sheet = sheetOf(pieces, opts.allowance);
  const tw = paper.wMm - 2 * m, th = paper.hMm - 2 * m;
  const cols = Math.max(1, Math.ceil(sheet.w / tw)), rows = Math.max(1, Math.ceil(sheet.h / th));
  const page = (name: string, ops: GownExportOp[]): GownExportPage => ({ wPt: paper.wMm * P, hPt: paper.hMm * P, name, ops });
  const sa = opts.allowance;
  const note = sa.on
    ? `Seam allowances included: seams ${sa.seamCm} cm, hem ${sa.hemCm} cm, zip ${sa.zipCm} cm. Solid line: cut. Dashed line: sew.`
    : 'Net pattern: no seam allowances. Add your own before cutting.';
  // page 1: the map
  const map: GownExportOp[] = [
    { k: 'text', x: m * P, y: (m + 6) * P, size: 14, bold: true, text: opts.title },
    { k: 'text', x: m * P, y: (m + 14) * P, size: 9, text: `Print at 100% (actual size) on ${paper.label}. Measure the square first: it must be 5 cm.` },
    { k: 'text', x: m * P, y: (m + 20) * P, size: 9, text: note },
    { k: 'text', x: m * P, y: (m + 26) * P, size: 9, text: 'Tape them edge to edge by their names.' },
    { k: 'rect', x: m * P, y: (m + 32) * P, w: GOWN_TEST_SQUARE_MM * P, h: GOWN_TEST_SQUARE_MM * P, width: 0.75 },
    { k: 'text', x: (m + GOWN_TEST_SQUARE_MM / 2 - 5) * P, y: (m + 32 + GOWN_TEST_SQUARE_MM / 2 + 1.5) * P, size: 10, bold: true, text: '5 cm' },
  ];
  if (opts.estimate) map.push({ k: 'text', x: m * P, y: (m + 32 + GOWN_TEST_SQUARE_MM + 8) * P, size: 11, bold: true, text: 'ESTIMATE: measure before cutting' });
  // the page grid, drawn small
  const gx = m, gy = m + 32 + GOWN_TEST_SQUARE_MM + 16, gw = paper.wMm - 2 * m, gh = paper.hMm - gy - m;
  const s = Math.min(gw / (cols * tw), gh / (rows * th));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    map.push({ k: 'rect', x: (gx + c * tw * s) * P, y: (gy + r * th * s) * P, w: tw * s * P, h: th * s * P, width: 0.4 });
    map.push({ k: 'text', x: (gx + c * tw * s + 1.5) * P, y: (gy + r * th * s + 4.5) * P, size: 7, text: `${rowName(r)}${c + 1}` });
  }
  for (const op of sheet.ops) if (op.k === 'line') map.push({ ...op, pts: op.pts.map(([x, y]) => [(gx + x * s) * P, (gy + y * s) * P] as GownPoint), width: 0.25, dash: undefined });
  const pages = [page('Map', map)], blank = new Set<string>();
  // the tiles
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const ox = c * tw, oy = r * th, ops: GownExportOp[] = [];
    const to = ([x, y]: GownPoint): GownPoint => [(m + x - ox) * P, (m + y - oy) * P];
    for (const op of sheet.ops) {
      if (op.k === 'line') ops.push({ ...op, pts: op.pts.map(to) });
      else if (op.x >= ox - 40 && op.x <= ox + tw && op.y >= oy && op.y <= oy + th + 5) { const [x, y] = to([op.x, op.y]); ops.push({ ...op, x, y, size: op.size * P }); }
    }
    // a page with nothing of the pattern on it is not printed (the map marks it blank)
    const inside = { x0: m * P, y0: m * P, x1: (m + tw) * P, y1: (m + th) * P };
    const drawn = ops.some((o) => o.k === 'line' && o.pts.some((a, j) => { const b = o.pts[(j + 1) % o.pts.length]!; return (j < o.pts.length - 1 || o.closed) && clipSegment(a[0], a[1], b[0], b[1], inside) !== null; }));
    if (!drawn) { blank.add(`${rowName(r)}${c + 1}`); continue; }
    // corner marks and the tile's name (outside the drawing area, in the margin)
    for (const [cx, cy] of [[m, m], [m + tw, m], [m, m + th], [m + tw, m + th]] as const) {
      ops.push({ k: 'line', pts: [[(cx - 4) * P, cy * P], [(cx + 4) * P, cy * P]], closed: false, width: 0.3 });
      ops.push({ k: 'line', pts: [[cx * P, (cy - 4) * P], [cx * P, (cy + 4) * P]], closed: false, width: 0.3 });
    }
    ops.push({ k: 'text', x: m * P, y: (m - 3) * P, size: 8, bold: true, text: `${rowName(r)}${c + 1}  (row ${rowName(r)} of ${rows}, column ${c + 1} of ${cols})` });
    pages.push(page(`${rowName(r)}${c + 1}`, ops));
  }
  // the map names the pages that are printed, and marks the blank ones
  const printed = pages.length - 1;
  const count = map.findIndex((o) => o.k === 'text' && o.text.includes('Tape them edge to edge'));
  if (count >= 0) map[count] = { ...(map[count] as Extract<GownExportOp, { k: 'text' }>), text: `${printed} ${printed === 1 ? 'page' : 'pages'} to print (a ${rows} by ${cols} grid; ${blank.size ? `${blank.size} blank, not printed` : 'none blank'}). Tape them edge to edge by their names.` };
  for (const o of map) if (o.k === 'text' && blank.has(o.text)) o.text = `${o.text} blank`;
  return { paper: opts.paper, rows, cols, sheetMm: { w: sheet.w, h: sheet.h }, pages, blank: [...blank] };
}

/** The plan as a PDF file. `pdf-lib` is loaded here, on the designer's tap, never with the page. */
export async function gownExportPdf(plan: GownExportPlan): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  const [font, bold] = await Promise.all([doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold)]);
  const ink = rgb(0, 0, 0);
  const m = GOWN_EXPORT_MARGIN_MM * PT_PER_MM;
  plan.pages.forEach((pg, i) => {
    const page = doc.addPage([pg.wPt, pg.hPt]);
    const Y = (y: number) => pg.hPt - y;
    // a tile draws only inside its margins, so neighbouring tiles butt together exactly
    const clip = i > 0 ? { x0: m, y0: m, x1: pg.wPt - m, y1: pg.hPt - m } : null;
    for (const op of pg.ops) {
      if (op.k === 'text') page.drawText(op.text, { x: op.x, y: Y(op.y), size: op.size, font: op.bold ? bold : font, color: ink });
      else if (op.k === 'rect') page.drawRectangle({ x: op.x, y: Y(op.y + op.h), width: op.w, height: op.h, borderColor: ink, borderWidth: op.width });
      else {
        const pts = op.closed ? [...op.pts, op.pts[0]!] : op.pts;
        for (let j = 1; j < pts.length; j++) {
          let [x1, y1] = pts[j - 1]!, [x2, y2] = pts[j]!;
          if (clip) {
            const c = clipSegment(x1, y1, x2, y2, clip);
            if (!c) continue;
            [x1, y1, x2, y2] = c;
          }
          page.drawLine({ start: { x: x1, y: Y(y1) }, end: { x: x2, y: Y(y2) }, thickness: op.width, color: ink, ...(op.dash ? { dashArray: op.dash.map((d) => d * PT_PER_MM) } : {}) });
        }
      }
    }
  });
  doc.setTitle(plan.pages[0]?.ops.find((o): o is Extract<GownExportOp, { k: 'text' }> => o.k === 'text')?.text ?? 'Pattern');
  return doc.save();
}

/** Liang–Barsky: the part of a segment inside a box, or null. */
export function clipSegment(x1: number, y1: number, x2: number, y2: number, b: { x0: number; y0: number; x1: number; y1: number }): [number, number, number, number] | null {
  let t0 = 0, t1 = 1;
  const dx = x2 - x1, dy = y2 - y1;
  for (const [p, q] of [[-dx, x1 - b.x0], [dx, b.x1 - x1], [-dy, y1 - b.y0], [dy, b.y1 - y1]] as const) {
    if (p === 0) { if (q < 0) return null; continue; }
    const r = q / p;
    if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
  }
  return [x1 + t0 * dx, y1 + t0 * dy, x1 + t1 * dx, y1 + t1 * dy];
}
