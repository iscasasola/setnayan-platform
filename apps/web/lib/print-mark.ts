/**
 * lib/print-mark.ts — THE COUPLE'S LOGO, FLATTENED FOR PAPER.
 *
 * Owner 2026-09-28, looking at cale-ice's Entourage card: the crest printed a
 * generic "I & C" ring although the couple had made a real logo in the Maker's
 * Logo tool. Measured on prod (read only): that logo is a studio composition —
 * `<g transform="translate(500 500) scale(0.48828) translate(-1024 -1024)">`
 * layers wrapping plain `<path>`s. The print's old reader
 * (`monogramPathsFrom`) refused ANY `transform=` and fell back to the initials,
 * so every couple whose logo came out of the studio printed letters instead of
 * their mark — silently, on a card that still looked finished.
 *
 * The mark reaching this file has already been through THE resolver the Event
 * Hub hero uses (`resolveEventMonogram` → `resolveEventMonogramSvg`: custom ??
 * uploaded, the read-time safety gate, the ink policy). This module does not
 * decide WHICH mark; it only turns that one mark into outlines the two print
 * backends can draw (an SVG `<path>` and pdf-lib's `drawSvgPath`, neither of
 * which knows about groups or transforms):
 *
 *   · every `<g transform>` / element `transform` is composed and BAKED into
 *     the coordinates (translate · scale · rotate · skewX · skewY · matrix);
 *   · every path is rewritten as absolute M · L · C · Q · Z (H/V/S/T expanded,
 *     arcs converted to cubics — an arc does not survive a skew);
 *   · `<rect> <circle> <ellipse> <polygon> <polyline> <line>` become paths;
 *   · fill and fill-rule are carried per part (the studio traces letters with
 *     `fill-rule="evenodd"` holes), colours normalised to `#rrggbb`, and
 *     `currentColor` left as `null` so the card paints it in the theme's ink —
 *     which is exactly what the resolver's "follow our mood board" ink policy
 *     asks of a surface.
 *
 * Anything it cannot draw faithfully (`<text>`, `<use>`, a pattern or gradient
 * fill, a clip-path) returns null, and the card prints the initials — the same
 * decorative fallback every other surface uses. It never draws half a logo.
 *
 * PURE. No I/O.
 */

export type MarkPart = { d: string; fill: string | null; evenOdd: boolean };
export type FlatMark = {
  /** The tight bounds of the drawn outlines, in the mark's own units. */
  bounds: { x: number; y: number; w: number; h: number };
  parts: MarkPart[];
};

type M6 = [number, number, number, number, number, number];
const ID: M6 = [1, 0, 0, 1, 0, 0];

function mul(a: M6, b: M6): M6 {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

const nums = (s: string): number[] => (s.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);

/** `transform="…"` → one matrix. Unknown functions make the whole mark undrawable. */
export function parseTransform(raw: string | null | undefined): M6 | null {
  if (!raw) return ID;
  let m: M6 = ID;
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g;
  let hit: RegExpExecArray | null;
  let consumed = '';
  while ((hit = re.exec(raw))) {
    consumed += hit[0];
    const fn = hit[1]!.toLowerCase();
    const a = nums(hit[2]!);
    let t: M6;
    if (fn === 'translate') t = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0];
    else if (fn === 'scale') t = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0];
    else if (fn === 'rotate') {
      const r = ((a[0] ?? 0) * Math.PI) / 180;
      const c = Math.cos(r);
      const s = Math.sin(r);
      t = [c, s, -s, c, 0, 0];
      if (a.length >= 3) t = mul(mul([1, 0, 0, 1, a[1]!, a[2]!], t), [1, 0, 0, 1, -a[1]!, -a[2]!]);
    } else if (fn === 'skewx') t = [1, 0, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 1, 0, 0];
    else if (fn === 'skewy') t = [1, Math.tan(((a[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0];
    else if (fn === 'matrix' && a.length === 6) t = a as M6;
    else return null;
    m = mul(m, t);
  }
  // Something that is not a transform function (garbage) — refuse rather than guess.
  if (raw.replace(/[\s,]/g, '') !== consumed.replace(/[\s,]/g, '')) return null;
  return m;
}

const ap = (m: M6, x: number, y: number): [number, number] => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];

/** SVG arc (endpoint form) → cubic Béziers, in absolute coordinates. */
function arcToCubics(x1: number, y1: number, rx: number, ry: number, phiDeg: number, large: number, sweep: number, x2: number, y2: number): number[][] {
  if (rx === 0 || ry === 0) return [[x1, y1, x2, y2, x2, y2]];
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (x1 - x2) / 2;
  const dy = (y1 - y2) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
  if (lam > 1) {
    rx *= Math.sqrt(lam);
    ry *= Math.sqrt(lam);
  }
  const sign = large === sweep ? -1 : 1;
  const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  const co = sign * Math.sqrt(Math.max(0, num / den));
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    return a;
  };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  else if (sweep && dt < 0) dt += 2 * Math.PI;
  const segs = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2)));
  const step = dt / segs;
  const k = (4 / 3) * Math.tan(step / 4);
  const out: number[][] = [];
  let t = t1;
  const pt = (a: number): [number, number] => {
    const ex = rx * Math.cos(a);
    const ey = ry * Math.sin(a);
    return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy];
  };
  const dpt = (a: number): [number, number] => {
    const ex = -rx * Math.sin(a);
    const ey = ry * Math.cos(a);
    return [cos * ex - sin * ey, sin * ex + cos * ey];
  };
  for (let i = 0; i < segs; i += 1) {
    const [p0x, p0y] = pt(t);
    const [d0x, d0y] = dpt(t);
    const [p1x, p1y] = pt(t + step);
    const [d1x, d1y] = dpt(t + step);
    out.push([p0x + k * d0x, p0y + k * d0y, p1x - k * d1x, p1y - k * d1y, p1x, p1y]);
    t += step;
  }
  return out;
}

/**
 * Path data → absolute M · L · C · Q · Z with `m` applied to every point.
 * Returns null when the data cannot be read (a malformed number run).
 */
export function transformPathData(d: string, m: M6, track?: (x: number, y: number) => void): string | null {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? [];
  const out: string[] = [];
  const r = (v: number) => String(Math.round(v * 1000) / 1000);
  const emit = (cmd: string, pts: number[]) => {
    const tp: string[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const [x, y] = ap(m, pts[i]!, pts[i + 1]!);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
      track?.(x, y);
      tp.push(`${r(x)} ${r(y)}`);
    }
    out.push(cmd + tp.join(' '));
    return true;
  };
  let i = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let lastC: [number, number] | null = null;
  let lastQ: [number, number] | null = null;
  const isCmd = (t: string | undefined) => t !== undefined && /^[a-zA-Z]$/.test(t);
  const take = (n: number): number[] | null => {
    const v: number[] = [];
    for (let k = 0; k < n; k += 1) {
      const t = tokens[i];
      if (t === undefined || isCmd(t)) return null;
      v.push(Number(t));
      i += 1;
    }
    return v;
  };
  while (i < tokens.length) {
    if (isCmd(tokens[i])) {
      cmd = tokens[i]!;
      i += 1;
    } else if (!cmd) return null;
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? cx : 0;
    const oy = rel ? cy : 0;
    if (C === 'Z') {
      out.push('Z');
      cx = sx;
      cy = sy;
      lastC = lastQ = null;
      cmd = '';
      continue;
    }
    if (C === 'M') {
      const v = take(2);
      if (!v) return null;
      cx = v[0]! + ox;
      cy = v[1]! + oy;
      sx = cx;
      sy = cy;
      if (!emit('M', [cx, cy])) return null;
      cmd = rel ? 'l' : 'L'; // implicit lineto after a moveto
      lastC = lastQ = null;
      continue;
    }
    if (C === 'L' || C === 'H' || C === 'V') {
      let x = cx;
      let y = cy;
      if (C === 'L') {
        const v = take(2);
        if (!v) return null;
        x = v[0]! + ox;
        y = v[1]! + oy;
      } else {
        const v = take(1);
        if (!v) return null;
        if (C === 'H') x = v[0]! + ox;
        else y = v[0]! + oy;
      }
      if (!emit('L', [x, y])) return null;
      cx = x;
      cy = y;
      lastC = lastQ = null;
      continue;
    }
    if (C === 'C' || C === 'S') {
      let x1: number;
      let y1: number;
      let rest: number[];
      if (C === 'C') {
        const v = take(6);
        if (!v) return null;
        x1 = v[0]! + ox;
        y1 = v[1]! + oy;
        rest = [v[2]! + ox, v[3]! + oy, v[4]! + ox, v[5]! + oy];
      } else {
        const v = take(4);
        if (!v) return null;
        x1 = lastC ? 2 * cx - lastC[0] : cx;
        y1 = lastC ? 2 * cy - lastC[1] : cy;
        rest = [v[0]! + ox, v[1]! + oy, v[2]! + ox, v[3]! + oy];
      }
      if (!emit('C', [x1, y1, ...rest])) return null;
      lastC = [rest[0]!, rest[1]!];
      lastQ = null;
      cx = rest[2]!;
      cy = rest[3]!;
      continue;
    }
    if (C === 'Q' || C === 'T') {
      let qx: number;
      let qy: number;
      let x: number;
      let y: number;
      if (C === 'Q') {
        const v = take(4);
        if (!v) return null;
        qx = v[0]! + ox;
        qy = v[1]! + oy;
        x = v[2]! + ox;
        y = v[3]! + oy;
      } else {
        const v = take(2);
        if (!v) return null;
        qx = lastQ ? 2 * cx - lastQ[0] : cx;
        qy = lastQ ? 2 * cy - lastQ[1] : cy;
        x = v[0]! + ox;
        y = v[1]! + oy;
      }
      if (!emit('Q', [qx, qy, x, y])) return null;
      lastQ = [qx, qy];
      lastC = null;
      cx = x;
      cy = y;
      continue;
    }
    if (C === 'A') {
      const v = take(7);
      if (!v) return null;
      const x = v[5]! + ox;
      const y = v[6]! + oy;
      for (const c of arcToCubics(cx, cy, v[0]!, v[1]!, v[2]!, v[3]! ? 1 : 0, v[4]! ? 1 : 0, x, y)) {
        if (!emit('C', c)) return null;
      }
      cx = x;
      cy = y;
      lastC = lastQ = null;
      continue;
    }
    return null;
  }
  return out.join('');
}

const NAMED: Record<string, string> = { black: '#000000', white: '#ffffff', red: '#ff0000', gold: '#ffd700', silver: '#c0c0c0', gray: '#808080', grey: '#808080' };

/** A fill value → `#rrggbb`; `null` = the theme's ink (currentColor / inherit); `'none'` = not drawn; `undefined` = undrawable. */
export function normaliseFill(raw: string | null | undefined): string | null | 'none' | undefined {
  if (raw == null) return null;
  const v = raw.trim().toLowerCase();
  if (!v || v === 'currentcolor' || v === 'inherit') return null;
  if (v === 'none' || v === 'transparent') return 'none';
  let m = /^#([0-9a-f]{6})$/.exec(v);
  if (m) return `#${m[1]}`;
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`;
  const rgb = /^rgba?\(\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?\s*[, ]\s*([\d.]+)%?/.exec(v);
  if (rgb) {
    const h = (n: string) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0');
    return `#${h(rgb[1]!)}${h(rgb[2]!)}${h(rgb[3]!)}`;
  }
  if (NAMED[v]) return NAMED[v]!;
  return undefined; // url(#gradient), var(), hsl() … not something paper can be told
}

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag) ?? new RegExp(`\\s${name}\\s*=\\s*'([^']*)'`, 'i').exec(tag);
  return m ? m[1]! : null;
};
const styleProp = (tag: string, prop: string): string | null => {
  const style = attr(tag, 'style');
  if (!style) return null;
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(style);
  return m ? m[1]!.trim() : null;
};

function shapeToPath(name: string, tag: string): string | null {
  const n = (k: string) => Number(attr(tag, k) ?? 0);
  if (name === 'rect') {
    const x = n('x');
    const y = n('y');
    const w = n('width');
    const h = n('height');
    if (!(w > 0 && h > 0)) return '';
    return `M${x} ${y}H${x + w}V${y + h}H${x}Z`;
  }
  if (name === 'circle' || name === 'ellipse') {
    const cx = n('cx');
    const cy = n('cy');
    const rx = name === 'circle' ? n('r') : n('rx');
    const ry = name === 'circle' ? n('r') : n('ry');
    if (!(rx > 0 && ry > 0)) return '';
    return `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;
  }
  if (name === 'polygon' || name === 'polyline') {
    const p = nums(attr(tag, 'points') ?? '');
    if (p.length < 4) return '';
    let d = `M${p[0]} ${p[1]}`;
    for (let i = 2; i + 1 < p.length; i += 2) d += `L${p[i]} ${p[i + 1]}`;
    return name === 'polygon' ? `${d}Z` : d;
  }
  if (name === 'line') return null; // a stroke-only element — see below
  return null;
}

/** Elements whose CONTENT is never drawn directly. */
const NON_RENDERED = new Set(['defs', 'clippath', 'mask', 'pattern', 'symbol', 'lineargradient', 'radialgradient', 'filter', 'title', 'desc', 'metadata', 'style']);
/** Elements that would draw something these outlines cannot reproduce. */
const UNDRAWABLE = new Set(['text', 'tspan', 'textpath', 'use', 'image', 'foreignobject', 'switch']);
const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon', 'polyline', 'line']);

/**
 * The couple's resolved mark → flat outlines, or null when it cannot be drawn
 * faithfully (the card then prints the initials).
 */
export function flattenSvgMark(svg: string | null | undefined): FlatMark | null {
  if (!svg || !/^\s*<svg\b/i.test(svg)) return null;
  const tagRe = /<(\/?)([a-zA-Z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;
  type Frame = { name: string; m: M6; fill: string | null | 'none'; evenOdd: boolean | null };
  const stack: Frame[] = [];
  const parts: MarkPart[] = [];
  let skip = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const track = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  let hit: RegExpExecArray | null;
  let sawRoot = false;
  while ((hit = tagRe.exec(svg))) {
    const closing = hit[1] === '/';
    const name = hit[2]!.toLowerCase().replace(/^svg:/, '');
    const tag = ` ${hit[3] ?? ''}`;
    const selfClosing = hit[4] === '/';
    if (name.startsWith('!') || name.startsWith('?')) continue;
    if (closing) {
      if (skip > 0) {
        if (NON_RENDERED.has(name)) skip -= 1;
        continue;
      }
      if (stack.length && stack[stack.length - 1]!.name === name) stack.pop();
      continue;
    }
    if (skip > 0) {
      if (NON_RENDERED.has(name) && !selfClosing) skip += 1;
      continue;
    }
    if (NON_RENDERED.has(name)) {
      if (!selfClosing) skip += 1;
      continue;
    }
    if (UNDRAWABLE.has(name)) return null;
    if (/\s(clip-path|mask|filter)\s*=/i.test(tag)) return null;
    const parent = stack[stack.length - 1];
    const own = parseTransform(attr(tag, 'transform'));
    if (!own) return null;
    const m = parent ? mul(parent.m, own) : own;
    const fillRaw = styleProp(tag, 'fill') ?? attr(tag, 'fill');
    const fill = fillRaw == null ? (parent ? parent.fill : null) : normaliseFill(fillRaw);
    if (fill === undefined) return null;
    const ruleRaw = styleProp(tag, 'fill-rule') ?? attr(tag, 'fill-rule');
    const evenOdd = ruleRaw ? ruleRaw.trim().toLowerCase() === 'evenodd' : parent?.evenOdd ?? null;
    if (name === 'svg') {
      if (sawRoot) return null; // a nested viewport would need its own viewBox mapping
      sawRoot = true;
      if (!selfClosing) stack.push({ name, m, fill, evenOdd });
      continue;
    }
    if (SHAPES.has(name)) {
      const opacity = Number(styleProp(tag, 'opacity') ?? attr(tag, 'opacity') ?? 1);
      if (opacity === 0) continue;
      if (fill === 'none') {
        // A stroke-only element (a hairline flourish) — outlines alone cannot draw a stroke.
        const stroke = styleProp(tag, 'stroke') ?? attr(tag, 'stroke');
        if (stroke && normaliseFill(stroke) !== 'none') return null;
        continue;
      }
      const d = name === 'path' ? attr(tag, 'd') : shapeToPath(name, tag);
      if (d === null) return null;
      if (!d.trim()) continue;
      const flat = transformPathData(d, m, track);
      if (flat === null) return null;
      if (flat) parts.push({ d: flat, fill, evenOdd: evenOdd === true });
      if (!selfClosing) stack.push({ name, m, fill, evenOdd });
      continue;
    }
    // Any other container (<g>, <a>): push its frame so children inherit.
    if (!selfClosing) stack.push({ name, m, fill, evenOdd });
  }
  if (!parts.length || !Number.isFinite(minX) || maxX - minX <= 0 || maxY - minY <= 0) return null;
  /* The box above holds every CONTROL point — a curve's handles can reach far
   * past the ink it draws (a swash's tail, a traced bowl with no point on its
   * extreme). The bounds a mark is CENTRED by are the ink's own. */
  const ink = partsBounds(parts);
  const bounds = ink ?? { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  return { bounds, parts };
}

/** The ink box of several parts (`pathDataBounds` of each), or null. */
export function partsBounds(parts: ReadonlyArray<{ d: string }>): { x: number; y: number; w: number; h: number } | null {
  let box: { x0: number; y0: number; x1: number; y1: number } | null = null;
  for (const p of parts) {
    const b = pathDataBounds(p.d);
    if (!b) continue;
    box = box
      ? { x0: Math.min(box.x0, b.x), y0: Math.min(box.y0, b.y), x1: Math.max(box.x1, b.x + b.w), y1: Math.max(box.y1, b.y + b.h) }
      : { x0: b.x, y0: b.y, x1: b.x + b.w, y1: b.y + b.h };
  }
  if (!box || !(box.x1 - box.x0 > 0) || !(box.y1 - box.y0 > 0)) return null;
  return { x: box.x0, y: box.y0, w: box.x1 - box.x0, h: box.y1 - box.y0 };
}

/** The parameters in (0, 1) where one axis of a Bézier turns (its extrema). */
function turns(p: readonly number[]): number[] {
  const out: number[] = [];
  const inside = (t: number) => t > 0 && t < 1 && out.push(t);
  if (p.length === 3) {
    // quadratic: B'(t) = 2[(p1 - p0) + t(p0 - 2p1 + p2)]
    const den = p[0]! - 2 * p[1]! + p[2]!;
    if (Math.abs(den) > 1e-12) inside((p[0]! - p[1]!) / den);
    return out;
  }
  // cubic: B'(t) = a t² + b t + c
  const a = 3 * (-p[0]! + 3 * p[1]! - 3 * p[2]! + p[3]!);
  const b = 6 * (p[0]! - 2 * p[1]! + p[2]!);
  const c = 3 * (p[1]! - p[0]!);
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) inside(-c / b);
    return out;
  }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return out;
  const q = Math.sqrt(disc);
  inside((-b + q) / (2 * a));
  inside((-b - q) / (2 * a));
  return out;
}

function bez(p: readonly number[], t: number): number {
  const u = 1 - t;
  if (p.length === 3) return u * u * p[0]! + 2 * u * t * p[1]! + t * t * p[2]!;
  return u * u * u * p[0]! + 3 * u * u * t * p[1]! + 3 * u * t * t * p[2]! + t * t * t * p[3]!;
}

/**
 * THE INK BOX of absolute `M · L · C · Q · Z` path data (what
 * `transformPathData` writes) — every curve measured at its own extrema, so a
 * handle that reaches past the stroke never widens the box. Null when there is
 * no ink (empty data, or data this reader does not know).
 */
export function pathDataBounds(d: string): { x: number; y: number; w: number; h: number } | null {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  let i = 0;
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const take = (n: number): number[] | null => {
    const v: number[] = [];
    for (let k = 0; k < n; k += 1) {
      const t = tokens[i];
      if (t === undefined || /^[a-zA-Z]$/.test(t)) return null;
      v.push(Number(t));
      i += 1;
    }
    return v;
  };
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i]!)) {
      cmd = tokens[i]!;
      i += 1;
      // Absolute M · L · C · Q · Z only — anything else is not ours to guess.
      if (!/^[MLCQZ]$/.test(cmd)) return null;
    } else if (!cmd) return null;
    if (cmd === 'Z') {
      cx = sx;
      cy = sy;
      cmd = ''; // a number straight after Z is malformed, never a loop
      continue;
    }
    if (cmd === 'M' || cmd === 'L') {
      const v = take(2);
      if (!v) return null;
      [cx, cy] = [v[0]!, v[1]!];
      if (cmd === 'M') [sx, sy] = [cx, cy];
      add(cx, cy);
      continue;
    }
    if (cmd === 'C' || cmd === 'Q') {
      const v = take(cmd === 'C' ? 6 : 4);
      if (!v) return null;
      const xs = [cx, ...v.filter((_, k) => k % 2 === 0)];
      const ys = [cy, ...v.filter((_, k) => k % 2 === 1)];
      add(xs[xs.length - 1]!, ys[ys.length - 1]!);
      for (const t of turns(xs)) add(bez(xs, t), bez(ys, t));
      for (const t of turns(ys)) add(bez(xs, t), bez(ys, t));
      [cx, cy] = [xs[xs.length - 1]!, ys[ys.length - 1]!];
      continue;
    }
    return null;
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** The machine-built raster wrapper (`monogram-svg-safe.ts` RASTER_MARK) → its image bytes. */
export function rasterMarkPayload(svg: string | null | undefined): { mime: 'image/png' | 'image/jpeg' | 'image/webp'; bytes: Uint8Array; w: number; h: number } | null {
  if (!svg) return null;
  const m = /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 (\d{1,5}) (\d{1,5})"><image width="\d{1,5}" height="\d{1,5}" href="data:image\/(webp|png|jpeg);base64,([A-Za-z0-9+/]+={0,2})"\/><\/svg>$/.exec(svg);
  if (!m) return null;
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!(w > 0 && h > 0)) return null;
  return { mime: `image/${m[3]}` as 'image/png' | 'image/jpeg' | 'image/webp', bytes: new Uint8Array(Buffer.from(m[4]!, 'base64')), w, h };
}
