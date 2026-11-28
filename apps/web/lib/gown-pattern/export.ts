/**
 * 👗 gown-pattern/export — the cutting blocks at TRUE SIZE (plan step B12; the approved drawing is the prototype
 * `gown_maker_v205.html`: `pieceSVG` · `patTiles` · `patBuild`, ported; owner D28: A4 and US Letter).
 *
 * `gownPatternPages` is pure: one drawing model (`GownDraw`, mm, y down) that both the on-screen page previews
 * (`gownPageSvg`) and the PDF (`gownPatternPdf`) draw from, so the screen shows exactly what prints.
 *   · Page 1 is the page map: every piece small, its pages numbered (a blank page marked —), how to print and tape, and
 *     the allowances in words.
 *   · Then each piece's pages: true size, 1 cm overlap with the next page (a tinted strip and a dashed line, with
 *     crosses to line up), the page's name, "Page n of N", and a 5 cm test square on EVERY page, in a corner the piece
 *     leaves free. A page the piece does not touch is not printed.
 *   · A piece that would need more than 40 pages comes as a measured diagram instead (its size, radii, stitching
 *     lengths, the allowances) — the plotter sheet still has it at full size.
 *   · The plotter sheet: every piece side by side at true size, one large SVG.
 * The PDF draws the same model with `pdf-lib`, imported only when the designer taps Export. No price, amount or money
 * on any page.
 * 🔒 lib/gown-pattern/export.test.ts (held to the prototype's own patBuild, prototype-v205.golden.json)
 */
import type { GownBlockPiece, GownPoint } from './skirt';
import { gownPieceGeom, type GownPieceGeom, type GownSeamAllow } from './allowance';
import { formatCount } from '../format-number';

import { GOWN_PAPERS, type GownPaper } from './words';
export { GOWN_PAPERS, type GownPaper };
/** mm: paper margin, overlap between pages, room round each piece; the most pages one piece may take (v205 PAT_*). */
export const GOWN_PAT_MARGIN = 10;
export const GOWN_PAT_OVERLAP = 10;
export const GOWN_PAT_EDGE = 5;
export const GOWN_PAT_MAX_PAGES = 40;
export const GOWN_TEST_SQUARE_MM = 50;
export const PT_PER_MM = 72 / 25.4;

/** The printed colours, as numbers (the pattern is a printed document, not a page of the app). */
export type GownInk = readonly [number, number, number];
export const GOWN_PAT_INK = {
  ink: [44, 42, 41],
  rust: [157, 63, 30],
  blue: [31, 79, 168],
  paper: [251, 246, 238],
  cutFill: [255, 253, 249],
  white: [255, 255, 255],
  faint: [187, 187, 187],
  grey: [153, 153, 153],
} as const satisfies Record<string, GownInk>;

/** One thing to draw, mm, y down from the top-left of the printable area. */
export type GownDraw =
  | { k: 'path'; pts: GownPoint[]; closed: boolean; stroke: GownInk | null; width: number; dash?: readonly [number, number]; fill?: GownInk; fillOpacity?: number }
  | { k: 'text'; x: number; y: number; size: number; text: string; color: GownInk; bold?: boolean; anchor?: 'start' | 'middle' | 'end'; rotate?: number; halo?: boolean }
  | { k: 'rect'; x: number; y: number; w: number; h: number; stroke: GownInk | null; width: number; dash?: readonly [number, number]; fill?: GownInk; fillOpacity?: number; testSquare?: boolean };
export type GownPatternPage = { kind: 'map' | 'tile' | 'diagram'; label: string; head: string; ops: GownDraw[]; piece?: string; r?: number; c?: number; square: readonly [number, number] };
export type GownPatternBook = {
  paper: GownPaper;
  aw: number;
  ah: number;
  pages: GownPatternPage[];
  total: number;
  tiles: number;
  diagrams: { piece: string; pages: number }[];
  perPiece: { piece: string; pages: number; cols: number; rows: number; diagram: boolean }[];
  plot: { w: number; h: number; ops: GownDraw[] };
};

type Style = { sw: number; cw: number; dash: readonly [number, number]; tw: number; nw: number; fs: number };
/** v205 PAT_SCREEN (the order view) and PAT_PRINT (the pages). */
export const GOWN_PAT_SCREEN: Style = { sw: 2.5, cw: 1.8, dash: [10, 6], tw: 2, nw: 2.2, fs: 1 };
export const GOWN_PAT_PRINT: Style = { sw: 0.6, cw: 0.45, dash: [4, 2.5], tw: 0.45, nw: 0.5, fs: 0.45 };

const I = GOWN_PAT_INK;

/** v205 `pieceSVG`: one piece as drawing ops; (ox, oy) is where the piece's own zero sits. */
export function gownPieceDraw(p: GownBlockPiece, G: GownPieceGeom, ox: number, oy: number, st: Style = GOWN_PAT_SCREEN): GownDraw[] {
  const f = st.fs, ys = p.outline.map((q) => q[1]), maxY = Math.max(...ys), top = Math.min(0, ...ys), out: GownDraw[] = [];
  const at = (q: GownPoint): GownPoint => [ox + q[0], oy + q[1]];
  if (G.C) out.push({ k: 'path', pts: G.C.map(at), closed: true, stroke: I.ink, width: st.cw, dash: st.dash, fill: I.cutFill });
  out.push({ k: 'path', pts: G.P.map(at), closed: true, stroke: I.ink, width: st.sw, fill: I.paper });
  for (const [x1, y1, x2, y2] of G.N) out.push({ k: 'path', pts: [at([x1, y1]), at([x2, y2])], closed: false, stroke: I.ink, width: st.nw });
  G.roles.forEach((r, k) => {
    if (r !== 'fold') return; // the fold, named along its edge
    const a0 = G.P[k]!, b0 = G.P[(k + 1) % G.P.length]!, [a, b] = a0[1] < b0[1] ? [a0, b0] : [b0, a0];
    const mx = ox + a[0] + (b[0] - a[0]) * 0.3, my = oy + a[1] + (b[1] - a[1]) * 0.3;
    out.push({ k: 'text', x: mx + 14 * f, y: my, size: 26 * f, color: I.rust, rotate: -90, anchor: 'middle', text: 'PLACE ON FOLD' });
  });
  for (const d of p.darts) {
    const pts: GownPoint[] = 'a' in d ? [d.a, d.apex, d.b] : [[d.x - d.w / 2, 0], [d.x, d.len], [d.x + d.w / 2, 0]];
    out.push({ k: 'path', pts: pts.map(at), closed: false, stroke: I.ink, width: st.tw });
  }
  for (const [px, py, t] of p.points) {
    out.push({ k: 'path', pts: [at([px - 12, py]), at([px + 12, py])], closed: false, stroke: I.rust, width: 3 * f });
    out.push({ k: 'path', pts: [at([px, py - 12]), at([px, py + 12])], closed: false, stroke: I.rust, width: 3 * f });
    out.push({ k: 'text', x: ox + px + 16, y: oy + py - 10, size: 24 * f, color: I.rust, text: t });
  }
  for (const [mx, my, t] of p.marks) {
    out.push({ k: 'path', pts: [at([0, my]), at([mx, my])], closed: false, stroke: I.rust, width: 1.5 * f, dash: [12, 8] });
    out.push({ k: 'text', x: ox + 10, y: oy + my - 8, size: 26 * f, color: I.rust, text: `${t} line` });
  }
  if (p.vent) out.push({ k: 'path', pts: [at([2, maxY - p.vent]), at([2, maxY])], closed: false, stroke: I.rust, width: 5 * f });
  // the grain: a line with an arrow head at each end (the SVG marker: 5 × the line's width long)
  const [g1, g2] = p.grain, gl = Math.hypot(g2[0] - g1[0], g2[1] - g1[1]) || 1, ux = (g2[0] - g1[0]) / gl, uy = (g2[1] - g1[1]) / gl, L = 5 * st.tw, Wd = 2.5 * st.tw;
  out.push({ k: 'path', pts: [at(g1), at(g2)], closed: false, stroke: I.ink, width: st.tw });
  for (const [e, s] of [[g2, 1], [g1, -1]] as const) {
    out.push({ k: 'path', pts: [at([e[0] - s * ux * L - uy * Wd, e[1] - s * uy * L + ux * Wd]), at(e), at([e[0] - s * ux * L + uy * Wd, e[1] - s * uy * L - ux * Wd])], closed: true, stroke: null, width: 0, fill: I.ink });
  }
  const ty = p.labelY ?? Math.min(maxY - 40, 160 + top);
  out.push({ k: 'text', x: ox + 20, y: oy + ty, size: 34 * f, bold: true, color: I.ink, text: p.name });
  out.push({ k: 'text', x: ox + 20, y: oy + ty + 40 * f, size: 26 * f, color: I.ink, text: p.cut });
  return out;
}

/** v205 `polyHitsRect`: does this closed outline touch the rectangle? */
export function gownPolyHitsRect(pts: readonly GownPoint[], x0: number, y0: number, x1: number, y1: number): boolean {
  const inR = ([x, y]: GownPoint) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  if (pts.some(inR)) return true;
  const inP = (x: number, y: number) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i]!, [xj, yj] = pts[j]!; if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; }
    return c;
  };
  if (inP(x0, y0) || inP(x1, y0) || inP(x0, y1) || inP(x1, y1)) return true;
  const o = (p: GownPoint, q: GownPoint, r: GownPoint) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const seg = (a: GownPoint, b: GownPoint, c: GownPoint, d: GownPoint) => o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b);
  const R: GownPoint[] = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  for (let i = 0; i < pts.length; i++) for (let k = 0; k < 4; k++) if (seg(pts[i]!, pts[(i + 1) % pts.length]!, R[k]!, R[(k + 1) % 4]!)) return true;
  return false;
}

type Tiles = { aw: number; ah: number; sx: number; sy: number; bx: number; by: number; cols: number; rows: number; tiles: { r: number; c: number; x: number; y: number; used: boolean }[]; n: number };
/** v205 `patTiles`. */
export function gownPatTiles(G: GownPieceGeom, paper: GownPaper): Tiles {
  const pp = GOWN_PAPERS[paper], aw = pp.w - 2 * GOWN_PAT_MARGIN, ah = pp.h - 2 * GOWN_PAT_MARGIN, sx = aw - GOWN_PAT_OVERLAP, sy = ah - GOWN_PAT_OVERLAP;
  const bx = G.box[0] - GOWN_PAT_EDGE, by = G.box[1] - GOWN_PAT_EDGE, W = G.box[2] - G.box[0] + 2 * GOWN_PAT_EDGE, H = G.box[3] - G.box[1] + 2 * GOWN_PAT_EDGE;
  const cols = Math.max(1, Math.ceil((W - GOWN_PAT_OVERLAP) / sx)), rows = Math.max(1, Math.ceil((H - GOWN_PAT_OVERLAP) / sy)), pts = G.C ?? G.P, tiles: Tiles['tiles'] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = bx + c * sx, y = by + r * sy; tiles.push({ r, c, x, y, used: gownPolyHitsRect(pts, x, y, x + aw, y + ah) }); }
  return { aw, ah, sx, sy, bx, by, cols, rows, tiles, n: tiles.filter((t) => t.used).length };
}

const wrapT = (t: string, n = 100) => {
  const out: string[] = [];
  let l = '';
  for (const w of String(t).split(' ')) { if (l && (l + ' ' + w).length > n) { out.push(l); l = w; } else l = l ? l + ' ' + w : w; }
  if (l) out.push(l);
  return out;
};
function textBlock(items: string[], x: number, y: number, fs: number, n: number): GownDraw[] {
  const ops: GownDraw[] = [];
  let yy = y;
  for (const t of items) { for (const ln of wrapT(t, n)) { ops.push({ k: 'text', x, y: yy, size: fs, color: I.ink, text: ln }); yy += fs * 1.45; } yy += fs * 0.5; }
  return ops;
}
/** v205 `testSq`: the 5 cm square and its two lines of words. */
function testSquare(x: number, y: number): GownDraw[] {
  return [
    { k: 'rect', x, y, w: GOWN_TEST_SQUARE_MM, h: GOWN_TEST_SQUARE_MM, stroke: I.blue, width: 0.35, testSquare: true },
    { k: 'text', x: x + 25, y: y + 23, size: 4.2, anchor: 'middle', color: I.blue, halo: true, text: '5 cm test square' },
    { k: 'text', x: x + 25, y: y + 30, size: 3.2, anchor: 'middle', color: I.blue, halo: true, text: 'measure it before cutting' },
  ];
}
/** Move (and scale) ops: a page shows the sheet shifted so the tile's corner is its origin. */
function shift(ops: readonly GownDraw[], dx: number, dy: number, s = 1): GownDraw[] {
  return ops.map((o): GownDraw => {
    if (o.k === 'path') return { ...o, pts: o.pts.map(([x, y]) => [dx + x * s, dy + y * s] as GownPoint), width: o.width * s, ...(o.dash ? { dash: [o.dash[0] * s, o.dash[1] * s] as const } : {}) };
    if (o.k === 'text') return { ...o, x: dx + o.x * s, y: dy + o.y * s, size: o.size * s };
    return { ...o, x: dx + o.x * s, y: dy + o.y * s, w: o.w * s, h: o.h * s, width: o.width * s };
  });
}

/** v205 `patBuild`: every page of one order's pattern, the page map first. `who` names the order on every page. */
export function gownPatternPages(list: readonly { p: GownBlockPiece }[], opts: { sa: GownSeamAllow; net: boolean; paper: GownPaper; who: string }): GownPatternBook {
  const { sa, net, paper } = opts, pp = GOWN_PAPERS[paper], aw = pp.w - 2 * GOWN_PAT_MARGIN, ah = pp.h - 2 * GOWN_PAT_MARGIN, who = (opts.who || 'Client').slice(0, 40);
  const pcs = list.map(({ p }, i) => { const G = gownPieceGeom(p, sa, net), T = gownPatTiles(G, paper); return { p, G, T, i, diagram: T.n > GOWN_PAT_MAX_PAGES }; });
  const head = (t: string, n: number, of: number): GownDraw[] => [
    { k: 'text', x: 2, y: 6, size: 4, bold: true, color: I.ink, halo: true, text: t },
    { k: 'text', x: aw - 2, y: 6, size: 4, anchor: 'end', color: I.ink, halo: true, text: `Page ${formatCount(n)} of ${formatCount(of)}` },
  ];
  const tilePages = pcs.filter((x) => !x.diagram).flatMap((x) => x.T.tiles.filter((t) => t.used).map((t) => ({ x, t })));
  const diag = pcs.filter((x) => x.diagram), total = 1 + tilePages.length + diag.length, pages: GownPatternPage[] = [];
  const freeCorner = (pts: readonly GownPoint[], t: { x: number; y: number }): [number, number] => {
    for (const [cx, cy] of [[aw - 54, ah - 54], [4, ah - 54], [aw - 54, 12], [4, 12]] as const) if (!gownPolyHitsRect(pts, t.x + cx - 2, t.y + cy - 2, t.x + cx + 52, t.y + cy + 52)) return [cx, cy];
    return [aw - 54, ah - 54];
  };
  // page 1: the map
  {
    const items = pcs.map((x) => ({ x, w: x.T.cols * x.T.sx + GOWN_PAT_OVERLAP, h: x.T.rows * x.T.sy + GOWN_PAT_OVERLAP }));
    const pack = (s: number) => {
      let cx = 0, cy = 14, rowH = 0;
      const out: { it: (typeof items)[number]; X: number; Y: number }[] = [];
      for (const it of items) { const w = it.w * s, h = it.h * s + 12; if (cx > 0 && cx + w > aw) { cx = 0; cy += rowH + 4; rowH = 0; } out.push({ it, X: cx, Y: cy }); cx += w + 6; rowH = Math.max(rowH, h); }
      return { out, H: cy + rowH };
    };
    let s = 0.25, lay = pack(s);
    while (s > 0.01) { lay = pack(s); if (lay.H <= ah - 112) break; s *= 0.9; }
    let pn = 2;
    const num = new Map<string, number>(), body: GownDraw[] = [];
    for (const { x, t } of tilePages) num.set(x.i + ':' + t.r + ':' + t.c, pn++);
    diag.forEach((x) => num.set('d' + x.i, pn++));
    for (const { it, X, Y } of lay.out) {
      const x = it.x, T = x.T, ox = X - T.bx * s, oy = Y + 12 - T.by * s;
      body.push({ k: 'text', x: X, y: Y + 8, size: 3.6, bold: true, color: I.ink, text: `${x.p.name}${x.diagram ? ' (diagram, page ' + num.get('d' + x.i) + ')' : ''}` });
      body.push({ k: 'path', pts: (x.G.C ?? x.G.P).map(([a, b]) => [ox + a * s, oy + b * s] as GownPoint), closed: true, stroke: I.ink, width: 0.3, fill: I.paper });
      if (!x.diagram)
        for (const t of T.tiles) {
          const tx = ox + t.x * s, ty = oy + t.y * s, k = num.get(x.i + ':' + t.r + ':' + t.c);
          body.push({ k: 'rect', x: tx, y: ty, w: aw * s, h: ah * s, stroke: t.used ? I.blue : I.faint, width: 0.25, ...(t.used ? {} : { dash: [1, 1] as const }) });
          body.push({ k: 'text', x: tx + (aw * s) / 2, y: ty + (ah * s) / 2 + 1.5, size: Math.max(2, Math.min(5, (aw * s) / 4)), anchor: 'middle', color: t.used ? I.blue : I.grey, text: t.used ? String(k) : '—' });
        }
    }
    const how = [
      'Print at 100 % (actual size). Turn off “fit to page”.',
      'Measure the 5 cm test square on any page first. If it is not 5 cm, the printer scaled it.',
      'Lay the pages out as on this map. Each page overlaps the next by 1 cm: line up the dashed overlap lines and the crosses, then tape.',
      `Solid line: stitching. ${net ? 'This is a net pattern: add your own allowance as you cut.' : `Dashed line: cut (seams ${sa.seam} cm, hem ${sa.hem} cm, zip ${sa.zip} cm, necklines and armholes ${sa.neck} cm).`} Pages marked — are blank and are not printed.`,
    ];
    pages.push({
      kind: 'map',
      label: 'Page map',
      head: `Page 1 of ${total}`,
      ops: [...head(`Page map · ${who} · ${pp.name}`, 1, total), ...shift(body, 0, 4), ...textBlock(how.map((t, i) => `${i + 1}. ${t}`), 2, ah - 100, 3.4, 98), ...testSquare(aw - 54, ah - 54)],
      square: [aw - 54, ah - 54],
    });
  }
  // the tiles
  let n = 2;
  for (const { x, t } of tilePages) {
    const T = x.T, pts = x.G.C ?? x.G.P, [qx, qy] = freeCorner(pts, t), guides: GownDraw[] = [];
    const cross = (cx: number, cy: number) => {
      guides.push({ k: 'path', pts: [[cx - 3, cy], [cx + 3, cy]], closed: false, stroke: I.blue, width: 0.3 });
      guides.push({ k: 'path', pts: [[cx, cy - 3], [cx, cy + 3]], closed: false, stroke: I.blue, width: 0.3 });
    };
    for (let c = 0; c < T.cols - 1; c++) for (let r = 0; r < T.rows; r++) for (const fr of [0.3, 0.7]) cross(T.bx + (c + 1) * T.sx + GOWN_PAT_OVERLAP / 2, T.by + r * T.sy + fr * ah);
    for (let r = 0; r < T.rows - 1; r++) for (let c = 0; c < T.cols; c++) for (const fr of [0.3, 0.7]) cross(T.bx + c * T.sx + fr * aw, T.by + (r + 1) * T.sy + GOWN_PAT_OVERLAP / 2);
    const right = t.c < T.cols - 1, below = t.r < T.rows - 1, left = t.c > 0, above = t.r > 0, ov: GownDraw[] = [];
    const dashed = (p2: GownPoint[]): GownDraw => ({ k: 'path', pts: p2, closed: false, stroke: I.blue, width: 0.3, dash: [2, 1.5] });
    if (right) ov.push({ k: 'rect', x: aw - GOWN_PAT_OVERLAP, y: 0, w: GOWN_PAT_OVERLAP, h: ah, stroke: null, width: 0, fill: I.blue, fillOpacity: 0.06 }, dashed([[aw - GOWN_PAT_OVERLAP, 0], [aw - GOWN_PAT_OVERLAP, ah]]));
    if (below) ov.push({ k: 'rect', x: 0, y: ah - GOWN_PAT_OVERLAP, w: aw, h: GOWN_PAT_OVERLAP, stroke: null, width: 0, fill: I.blue, fillOpacity: 0.06 }, dashed([[0, ah - GOWN_PAT_OVERLAP], [aw, ah - GOWN_PAT_OVERLAP]]));
    if (left) ov.push(dashed([[GOWN_PAT_OVERLAP, 0], [GOWN_PAT_OVERLAP, ah]]));
    if (above) ov.push(dashed([[0, GOWN_PAT_OVERLAP], [aw, GOWN_PAT_OVERLAP]]));
    pages.push({
      kind: 'tile',
      piece: x.p.name,
      r: t.r,
      c: t.c,
      label: `${x.p.name}, row ${t.r + 1} column ${t.c + 1}`,
      head: `Page ${n} of ${total}`,
      ops: [...shift([...gownPieceDraw(x.p, x.G, 0, 0, GOWN_PAT_PRINT), ...guides], -t.x, -t.y), ...ov, ...head(`${x.p.name} · row ${t.r + 1}, column ${t.c + 1} · ${who}`, n, total), ...testSquare(qx, qy)],
      square: [qx, qy],
    });
    n++;
  }
  // pieces too big for home printing: a drawing with its measurements
  for (const x of diag) {
    const G = x.G, W = G.box[2] - G.box[0], H = G.box[3] - G.box[1], s = Math.min((aw - 30) / W, (ah - 154) / H), ox = 18 - G.box[0] * s, oy = 24 - G.box[1] * s;
    const cmv = (v: number) => (Math.round(v) / 10).toFixed(1) + ' cm';
    const sc: Style = { sw: 0.5 / s, cw: 0.4 / s, dash: [3 / s, 2 / s], tw: 0.4 / s, nw: 0.4 / s, fs: (0.35 / s) * 0.4 };
    const lens: Record<string, number> = {};
    G.roles.forEach((r, k) => { const a = G.P[k]!, b = G.P[(k + 1) % G.P.length]!; lens[r] = (lens[r] || 0) + Math.hypot(b[0] - a[0], b[1] - a[1]); });
    const RN: Record<string, string> = { seam: 'seams', hem: 'hem', zip: 'zip side', neck: 'necklines and armholes' };
    const dim: GownDraw[] = [
      { k: 'path', pts: [[ox + G.box[0] * s, oy + G.box[3] * s + 8], [ox + G.box[2] * s, oy + G.box[3] * s + 8]], closed: false, stroke: I.rust, width: 0.3 },
      { k: 'text', x: ox + ((G.box[0] + G.box[2]) / 2) * s, y: oy + G.box[3] * s + 14, size: 3.6, anchor: 'middle', color: I.rust, text: `${cmv(W)} across${net ? '' : ', with allowance'}` },
      { k: 'path', pts: [[ox + G.box[2] * s + 6, oy + G.box[1] * s], [ox + G.box[2] * s + 6, oy + G.box[3] * s]], closed: false, stroke: I.rust, width: 0.3 },
      { k: 'text', x: ox + G.box[2] * s + 4, y: oy + G.box[1] * s - 3, size: 3.6, anchor: 'end', color: I.rust, text: `${cmv(H)} long` },
    ];
    const facts = [
      `Too big to print at home: ${x.T.n} pages on ${pp.name}. Draw it from these measurements on pattern paper or straight on the fabric, or print the plotter sheet at a print shop.`,
      ...(x.p.radii ? [`Waist radius ${cmv(x.p.radii[0])} (stitching line); hem radius ${cmv(x.p.radii[1])}, both from the same corner point.`] : []),
      `Stitching lengths: ${Object.entries(lens).filter(([r]) => r !== 'fold').map(([r, L]) => `${RN[r]} ${cmv(L)}`).join(' · ')}.`,
      net ? 'Net pattern: add your own allowance as you cut.' : `Allowances: seams ${sa.seam} cm, hem ${sa.hem} cm, zip ${sa.zip} cm, necklines and armholes ${sa.neck} cm.`,
      `Drawn at about 1:${Math.round(1 / s)}: do not measure the drawing, use the numbers.`,
    ];
    pages.push({
      kind: 'diagram',
      piece: x.p.name,
      label: `${x.p.name} (diagram)`,
      head: `Page ${n} of ${total}`,
      ops: [...head(`${x.p.name} · measured diagram · ${who}`, n, total), ...shift(gownPieceDraw(x.p, G, ox / s, oy / s, sc), 0, 0, s), ...dim, ...textBlock(facts, 2, 24 + H * s + 24, 3.2, 104), ...testSquare(aw - 54, ah - 54)],
      square: [aw - 54, ah - 54],
    });
    n++;
  }
  // the plotter sheet: every piece side by side at true size, on one sheet
  let px = 20, ph = 0;
  const parts: GownDraw[] = [], top = Math.min(...pcs.map((x) => x.G.box[1]));
  for (const x of pcs) { parts.push(...gownPieceDraw(x.p, x.G, px - x.G.box[0], 30 - top, GOWN_PAT_PRINT)); px += x.G.box[2] - x.G.box[0] + 30; ph = Math.max(ph, x.G.box[3] - top); }
  const PW = px - 10, PH = ph + 100;
  const plot = { w: PW, h: PH, ops: [{ k: 'text', x: 20, y: 18, size: 8, bold: true, color: I.ink, text: `${who} · cutting blocks at true size (1:1)` } as GownDraw, ...parts, ...testSquare(20, PH - 62)] };
  return { paper, aw, ah, pages, total, tiles: tilePages.length, diagrams: diag.map((x) => ({ piece: x.p.name, pages: x.T.n })), perPiece: pcs.map((x) => ({ piece: x.p.name, pages: x.T.n, cols: x.T.cols, rows: x.T.rows, diagram: x.diagram })), plot };
}

// ── Drawing the model ────────────────────────────────────────────────────────────────────────────────────────────

const hexOfInk = (c: GownInk) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
const escX = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
const f2 = (x: number) => x.toFixed(2);

/** One page (or the plotter sheet) as an SVG at true size: width × height mm, 1 unit = 1 mm. */
export function gownPageSvg(ops: readonly GownDraw[], w: number, h: number, label = 'Pattern page', opts: { oneInk?: boolean } = {}): string {
  // On screen (oneInk) every line and word is currentColor, so the sheet follows the page's light or dark ink; the
  // stitched area is a faint wash of it and there is no white paper. Printed pages keep the drawing's own inks.
  const hexOf = opts.oneInk ? (c: GownInk) => (c === I.paper ? 'currentColor' : c === I.cutFill || c === I.white ? 'none' : 'currentColor') : hexOfInk;
  const washOf = (c: GownInk | undefined, o: number | undefined) => (opts.oneInk && c === I.paper ? 0.06 : o);
  let s = '';
  for (const o of ops) {
    if (o.k === 'path') {
      const d = 'M' + o.pts.map(([x, y]) => `${f2(x)} ${f2(y)}`).join('L') + (o.closed ? 'Z' : '');
      s += `<path d="${d}" fill="${o.fill ? hexOf(o.fill) : 'none'}"${washOf(o.fill, o.fillOpacity) != null ? ` fill-opacity="${washOf(o.fill, o.fillOpacity)}"` : ''} stroke="${o.stroke ? hexOf(o.stroke) : 'none'}" stroke-width="${f2(o.width)}"${o.dash ? ` stroke-dasharray="${f2(o.dash[0])} ${f2(o.dash[1])}"` : ''} stroke-linejoin="miter" stroke-miterlimit="12"/>`;
    } else if (o.k === 'rect') {
      s += `<rect${o.testSquare ? ' class="pp-test"' : ''} x="${f2(o.x)}" y="${f2(o.y)}" width="${f2(o.w)}" height="${f2(o.h)}" fill="${o.fill ? hexOf(o.fill) : 'none'}"${o.fillOpacity != null ? ` fill-opacity="${o.fillOpacity}"` : ''} stroke="${o.stroke ? hexOf(o.stroke) : 'none'}" stroke-width="${f2(o.width)}"${o.dash ? ` stroke-dasharray="${o.dash[0]} ${o.dash[1]}"` : ''}/>`;
    } else {
      const rot = o.rotate ? ` transform="rotate(${o.rotate} ${f2(o.x)} ${f2(o.y)})"` : '';
      const halo = o.halo && !opts.oneInk ? ` stroke="${hexOf(I.white)}" stroke-width="${f2(o.size * 0.25)}" paint-order="stroke"` : '';
      s += `<text x="${f2(o.x)}" y="${f2(o.y)}" font-size="${f2(o.size)}"${o.bold ? ' font-weight="700"' : ''}${o.anchor && o.anchor !== 'start' ? ` text-anchor="${o.anchor}"` : ''} fill="${hexOf(o.color)}"${halo}${rot} font-family="Helvetica, Arial, sans-serif">${escX(o.text)}</text>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f2(w)}mm" height="${f2(h)}mm" viewBox="0 0 ${f2(w)} ${f2(h)}" role="img" aria-label="${escX(label)}">${opts.oneInk ? '' : `<rect width="${f2(w)}" height="${f2(h)}" fill="${hexOf(I.white)}"/>`}${s}</svg>`;
}

/** The pages as a PDF at true size on the chosen paper (`pdf-lib` is loaded here, on the designer's tap). */
export async function gownPatternPdf(book: GownPatternBook, title: string): Promise<Uint8Array> {
  const L = await import('pdf-lib');
  const { PDFDocument, StandardFonts, rgb, degrees, pushGraphicsState, popGraphicsState, rectangle, clip, endPath } = L;
  const doc = await PDFDocument.create();
  const [font, bold] = await Promise.all([doc.embedFont(StandardFonts.Helvetica), doc.embedFont(StandardFonts.HelveticaBold)]);
  const P = PT_PER_MM, pp = GOWN_PAPERS[book.paper], m = GOWN_PAT_MARGIN * P, W = pp.w * P, H = pp.h * P;
  const col = (c: GownInk) => rgb(c[0] / 255, c[1] / 255, c[2] / 255);
  // the standard font draws Latin-1 only: keep what it can (our words are; a client's name may not be)
  const safe = (t: string) => t.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/—/g, '-').replace(/–/g, '-').replace(/✓/g, 'v').replace(/[^\x20-\x7e -ÿ]/g, '?');
  for (const pg of book.pages) {
    const page = doc.addPage([W, H]);
    const X = (x: number) => m + x * P, Y = (y: number) => H - m - y * P;
    // draw only inside the printable area, as the prototype's SVG page does
    page.pushOperators(pushGraphicsState(), rectangle(m, m, book.aw * P, book.ah * P), clip(), endPath());
    for (const o of pg.ops) {
      if (o.k === 'path') {
        const d = 'M' + o.pts.map(([x, y]) => `${(x * P).toFixed(3)} ${(y * P).toFixed(3)}`).join(' L ') + (o.closed ? ' Z' : '');
        page.drawSvgPath(d, {
          x: m,
          y: H - m,
          ...(o.fill ? { color: col(o.fill), opacity: o.fillOpacity ?? 1 } : {}),
          ...(o.stroke ? { borderColor: col(o.stroke), borderWidth: o.width * P } : { borderWidth: 0 }),
          ...(o.dash ? { borderDashArray: [o.dash[0] * P, o.dash[1] * P] } : {}),
        });
      } else if (o.k === 'rect') {
        page.drawRectangle({
          x: X(o.x),
          y: Y(o.y + o.h),
          width: o.w * P,
          height: o.h * P,
          ...(o.fill ? { color: col(o.fill), opacity: o.fillOpacity ?? 1 } : {}),
          ...(o.stroke ? { borderColor: col(o.stroke), borderWidth: o.width * P } : { borderWidth: 0 }),
          ...(o.dash ? { borderDashArray: [o.dash[0] * P, o.dash[1] * P] } : {}),
        });
      } else {
        const f = o.bold ? bold : font, text = safe(o.text), size = o.size * P, tw = f.widthOfTextAtSize(text, size);
        const dx = o.anchor === 'middle' ? -tw / 2 : o.anchor === 'end' ? -tw : 0;
        if (o.rotate) {
          // rotated about its own point (the fold's words run up its edge); pdf-lib turns counter-clockwise, y up
          const a = (-o.rotate * Math.PI) / 180;
          page.drawText(text, { x: X(o.x) + dx * Math.cos(a), y: Y(o.y) + dx * Math.sin(a), size, font: f, color: col(o.color), rotate: degrees(-o.rotate) });
        } else page.drawText(text, { x: X(o.x) + dx, y: Y(o.y), size, font: f, color: col(o.color) });
      }
    }
    page.pushOperators(popGraphicsState());
  }
  doc.setTitle(safe(title));
  return doc.save();
}

