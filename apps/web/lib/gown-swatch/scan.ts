/**
 * 👗 SCAN A SWATCH BOOK (gown maker port step B13; the approved drawing is the prototype
 * `prototypes/gown_maker_2026-11-27/gown_maker_v198.html`, Settings › Fabrics and lace › "Scan a swatch book":
 * `sbFind` · `sbSplit` · `sbTile` · `sbCut` · `sbGroup` · `sbColName`, ported, not redrawn).
 *
 * One photo of a swatch-book page → every fabric square on it found, the tilt the page was photographed at, the
 * card paper's light and colour cast flattened (so a swatch reads as its own colour, not the room's), touching
 * swatches cut apart, each swatch's true size from the card's width, a bridal colour name, and a style grouping.
 *
 * PURE: it works on RGBA byte arrays (what a browser canvas hands over) and never touches the DOM, the network or a
 * model. The designer's browser loads the photo into a canvas and passes its pixels here; nothing is sent anywhere
 * until she taps Save, and then only through the shop's own `fabric_save`.
 * ⛔ The prototype's AI label reader is NOT ported (owner, Q10): names and codes are typed by the designer.
 * 🔒 lib/gown-swatch/scan.test.ts (generated pages: plain, tilted, shadowed, touching, white-on-white, a table).
 */

/** A picture as the browser hands it over: RGBA bytes, row by row. */
export type GownRgba = { data: ArrayLike<number>; width: number; height: number };
/** One found swatch, in the page photo's own pixels (centre, size along the page's tilt). */
export type GownScanBox = { cx: number; cy: number; w: number; h: number };
type Grid = { g: Float32Array; gw: number; gh: number };
type Fit = number[] | Grid;
/** One page after finding: the tilt, the card's width in the photo, the paper's light map, and the swatches. */
export type GownScanPage = { width: number; height: number; ang: number; cardW: number; fit: Fit[]; boxes: GownScanBox[] };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ── Colour ──────────────────────────────────────────────────────────────────────────────────────────────────────

/** The bridal colour names a swatch is called by when the designer has not named a near-identical one herself. */
export const GOWN_SCAN_COLOURS: ReadonlyArray<readonly [string, readonly [number, number, number]]> = [
  ['White', [250, 250, 248]], ['Diamond white', [244, 243, 238]], ['Off-white', [240, 236, 226]], ['Ivory', [240, 232, 214]],
  ['Cream', [240, 226, 196]], ['Champagne', [226, 204, 170]], ['Nude', [222, 190, 165]], ['Beige', [210, 190, 165]],
  ['Blush', [238, 205, 200]], ['Peach', [244, 196, 170]], ['Pink', [232, 160, 180]], ['Dusty rose', [196, 140, 142]],
  ['Mauve', [170, 130, 150]], ['Rose gold', [200, 150, 135]], ['Coral', [236, 125, 105]], ['Red', [180, 35, 45]],
  ['Burgundy', [110, 28, 45]], ['Wine', [90, 24, 44]], ['Lilac', [200, 175, 220]], ['Lavender', [185, 170, 215]],
  ['Plum', [95, 50, 85]], ['Dusty blue', [140, 165, 190]], ['Sky blue', [165, 200, 230]], ['Royal blue', [40, 70, 160]],
  ['Navy', [28, 38, 70]], ['Teal', [30, 110, 115]], ['Sage', [160, 178, 150]], ['Emerald', [20, 110, 80]],
  ['Olive', [110, 115, 60]], ['Mint', [185, 225, 200]], ['Yellow', [240, 215, 110]], ['Gold', [200, 160, 80]],
  ['Mocha', [120, 88, 70]], ['Taupe', [150, 132, 118]], ['Brown', [95, 65, 45]], ['Terracotta', [190, 100, 70]],
  ['Silver', [192, 192, 196]], ['Grey', [128, 128, 128]], ['Charcoal', [60, 60, 64]], ['Black', [25, 25, 25]],
];

const LIN = new Float32Array(256);
for (let i = 0; i < 256; i++) { const v = i / 255; LIN[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
type Lab = [number, number, number];
/** sRGB (D65) → CIE L*a*b*. */
export function gownLab(r: number, g: number, b: number): Lab {
  const R = LIN[clamp(Math.round(r), 0, 255)]!, G = LIN[clamp(Math.round(g), 0, 255)]!, B = LIN[clamp(Math.round(b), 0, 255)]!;
  const h = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const x = h((0.4124564 * R + 0.3575761 * G + 0.1804375 * B) / 0.95047), y = h(0.2126729 * R + 0.7151522 * G + 0.072175 * B), z = h((0.0193339 * R + 0.119192 * G + 0.9503041 * B) / 1.08883);
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
}
/** Colour difference, CIEDE2000. */
export function gownDeltaE(p: Lab, q: Lab): number {
  const [L1, a1, b1] = p, [L2, a2, b2] = q, rad = Math.PI / 180, Cm = (Math.hypot(a1, b1) + Math.hypot(a2, b2)) / 2, G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const ap1 = a1 * (1 + G), ap2 = a2 * (1 + G), C1 = Math.hypot(ap1, b1), C2 = Math.hypot(ap2, b2);
  const hp = (b: number, a: number) => (a === 0 && b === 0 ? 0 : (Math.atan2(b, a) / rad + 360) % 360), h1 = hp(b1, ap1), h2 = hp(b2, ap2);
  const dL = L2 - L1, dC = C2 - C1;
  let dh = 0;
  if (C1 * C2) { dh = h2 - h1; if (dh > 180) dh -= 360; else if (dh < -180) dh += 360; }
  const dH = 2 * Math.sqrt(C1 * C2) * Math.sin((dh / 2) * rad), Lm = (L1 + L2) / 2, Cp = (C1 + C2) / 2;
  let hm = h1 + h2;
  if (C1 * C2) { if (Math.abs(h1 - h2) <= 180) hm /= 2; else hm = hm < 360 ? (hm + 360) / 2 : (hm - 360) / 2; }
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const Rc = 2 * Math.sqrt(Cp ** 7 / (Cp ** 7 + 25 ** 7)), Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2), Sc = 1 + 0.045 * Cp, Sh = 1 + 0.015 * Cp * T;
  const Rt = -Math.sin(2 * 30 * Math.exp(-(((hm - 275) / 25) ** 2)) * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}
const COL_LABS = GOWN_SCAN_COLOURS.map(([n, c]) => [n, gownLab(c[0], c[1], c[2])] as const);
const HEX_RE = /^#[0-9a-f]{6}$/i;

/** A swatch's colour name: a name the designer already gave a near-identical colour, else the nearest bridal colour. */
export function gownColourName(rgb: readonly [number, number, number], own: ReadonlyArray<{ name: string | null; hex: string }> = []): string {
  const lab = gownLab(rgb[0], rgb[1], rgb[2]);
  let best = '', bd = 3;
  for (const c of own) {
    if (!c.name || !HEX_RE.test(c.hex)) continue;
    const d = gownDeltaE(lab, gownLab(parseInt(c.hex.slice(1, 3), 16), parseInt(c.hex.slice(3, 5), 16), parseInt(c.hex.slice(5, 7), 16)));
    if (d < bd) { bd = d; best = c.name.slice(0, 30); }
  }
  if (best) return best;
  let nd = Infinity;
  for (const [n, l] of COL_LABS) { const d = gownDeltaE(lab, l); if (d < nd) { nd = d; best = n; } }
  return best;
}
export const gownHexOf = (rgb: readonly number[]) => '#' + rgb.slice(0, 3).map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');

// ── Pixels (what the prototype asked a canvas to do) ─────────────────────────────────────────────────────────────

/** Shrink by averaging the source pixels under each output pixel (a canvas's high-quality smoothing). */
export function gownShrink(img: GownRgba, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(w * h * 4), sx = img.width / w, sy = img.height / h, D = img.data;
  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = y0; yy < Math.min(img.height, y1); yy++) for (let xx = x0; xx < Math.min(img.width, x1); xx++) { const i = (yy * img.width + xx) * 4; r += D[i]!; g += D[i + 1]!; b += D[i + 2]!; a += D[i + 3]!; n++; }
      const o = (y * w + x) * 4;
      out[o] = r / n; out[o + 1] = g / n; out[o + 2] = b / n; out[o + 3] = a / n;
    }
  }
  return out;
}

/** The (bw × bh) rectangle centred at (cx, cy), turned by `ang`, straightened into an nu × nv picture. */
export function gownCutOut(img: GownRgba, cx: number, cy: number, bw: number, bh: number, ang: number, nu: number, nv: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(nu * nv * 4), cs = Math.cos(ang), sn = Math.sin(ang), W = img.width, H = img.height, D = img.data;
  const fx = bw / nu, fy = bh / nv, ss = clamp(Math.ceil(Math.max(fx, fy)), 1, 4);
  const px = (x: number, y: number, j: number) => {
    const X = clamp(x - 0.5, 0, W - 1), Y = clamp(y - 0.5, 0, H - 1), x0 = Math.floor(X), y0 = Math.floor(Y), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), ax = X - x0, ay = Y - y0;
    const at = (xx: number, yy: number) => D[(yy * W + xx) * 4 + j]!;
    return (at(x0, y0) * (1 - ax) + at(x1, y0) * ax) * (1 - ay) + (at(x0, y1) * (1 - ax) + at(x1, y1) * ax) * ay;
  };
  for (let y = 0; y < nv; y++) for (let x = 0; x < nu; x++) {
    const s = [0, 0, 0, 0];
    for (let sy = 0; sy < ss; sy++) for (let sxx = 0; sxx < ss; sxx++) {
      const lx = (x + (sxx + 0.5) / ss - nu / 2) * fx, ly = (y + (sy + 0.5) / ss - nv / 2) * fy, X = cx + lx * cs - ly * sn, Y = cy + lx * sn + ly * cs;
      for (let j = 0; j < 4; j++) s[j]! += px(X, Y, j);
    }
    const o = (y * nu + x) * 4;
    for (let j = 0; j < 4; j++) out[o + j] = s[j]! / (ss * ss);
  }
  return out;
}

// ── Finding (sbFind) ─────────────────────────────────────────────────────────────────────────────────────────────

function solve(A: number[][], b: number[]): number[] {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r]![i]!) > Math.abs(A[p]![i]!)) p = r;
    [A[i], A[p]] = [A[p]!, A[i]!]; [b[i], b[p]] = [b[p]!, b[i]!];
    const d = A[i]![i] || 1e-9;
    for (let r = i + 1; r < n; r++) { const f = A[r]![i]! / d; if (!f) continue; for (let c = i; c < n; c++) A[r]![c]! -= f * A[i]![c]!; b[r]! -= f * b[i]!; }
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]!; for (let c = i + 1; c < n; c++) s -= A[i]![c]! * x[c]!; x[i] = s / (A[i]![i] || 1e-9); }
  return x;
}
/** The paper's brightness at (u, v) in −1…1 page space: the block light map, or the smooth surface. */
function ev(c: Fit, u: number, v: number): number {
  if (!Array.isArray(c)) {
    const x = clamp(((u + 1) / 2) * c.gw - 0.5, 0, c.gw - 1), y = clamp(((v + 1) / 2) * c.gh - 0.5, 0, c.gh - 1), x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(c.gw - 1, x0 + 1), y1 = Math.min(c.gh - 1, y0 + 1), fx = x - x0, fy = y - y0, g = c.g;
    return Math.max(30, (g[y0 * c.gw + x0]! * (1 - fx) + g[y0 * c.gw + x1]! * fx) * (1 - fy) + (g[y1 * c.gw + x0]! * (1 - fx) + g[y1 * c.gw + x1]! * fx) * fy);
  }
  return Math.max(30, c[0]! + c[1]! * u + c[2]! * v + c[3]! * u * u + c[4]! * u * v + c[5]! * v * v);
}
/** What makes the card paper at (x, y) read as neutral white. */
export function gownPaperGain(pg: GownScanPage, x: number, y: number): number[] {
  const u = (x / pg.width) * 2 - 1, v = (y / pg.height) * 2 - 1;
  return pg.fit.map((c) => clamp(244 / ev(c, u, v), 0.5, 2.6));
}
/** Square grow (dilate) or shrink (erode), two 1-D passes. */
function morph(src: Uint8Array, w: number, h: number, r: number, grow: boolean): Uint8Array {
  const run = (a: Uint8Array, horiz: boolean) => {
    const o = new Uint8Array(a.length), L = horiz ? w : h, N = horiz ? h : w, st = horiz ? 1 : w, full = 2 * r + 1;
    for (let j = 0; j < N; j++) {
      const base = horiz ? j * w : j;
      let s = 0;
      for (let i = -r; i <= r; i++) s += i < 0 || i >= L ? (grow ? 0 : 1) : a[base + i * st]!;
      for (let i = 0; i < L; i++) {
        o[base + i * st] = grow ? (s > 0 ? 1 : 0) : s === full ? 1 : 0;
        const out = i - r, inn = i + r + 1;
        s -= out < 0 || out >= L ? (grow ? 0 : 1) : a[base + out * st]!;
        s += inn < 0 || inn >= L ? (grow ? 0 : 1) : a[base + inn * st]!;
      }
    }
    return o;
  };
  return run(run(src, true), false);
}
/** Connected patches of a mask, and which page edges each touches. */
function parts(m: Uint8Array, w: number, h: number): { pix: number[]; edge: number }[] {
  const seen = new Uint8Array(m.length), out: { pix: number[]; edge: number }[] = [], st = new Int32Array(m.length);
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || seen[s]) continue;
    let n = 0, k = 0, edge = 0;
    st[n++] = s; seen[s] = 1;
    const pix: number[] = [];
    while (k < n) {
      const p = st[k++]!, x = p % w, y = (p / w) | 0;
      pix.push(p);
      if (x === 0) edge |= 1; if (x === w - 1) edge |= 2; if (y === 0) edge |= 4; if (y === h - 1) edge |= 8;
      if (x > 0 && m[p - 1] && !seen[p - 1]) { seen[p - 1] = 1; st[n++] = p - 1; }
      if (x < w - 1 && m[p + 1] && !seen[p + 1]) { seen[p + 1] = 1; st[n++] = p + 1; }
      if (y > 0 && m[p - w] && !seen[p - w]) { seen[p - w] = 1; st[n++] = p - w; }
      if (y < h - 1 && m[p + w] && !seen[p + w]) { seen[p + w] = 1; st[n++] = p + w; }
    }
    out.push({ pix, edge });
  }
  return out;
}

/** Find the fabric squares on one page photo. Works on a small copy (≤ 420 px) so a phone stays cool. */
export function gownFindSwatches(img: GownRgba): GownScanPage {
  const W0 = img.width, H0 = img.height, k = Math.min(1, 420 / Math.max(W0, H0)), w = Math.max(8, Math.round(W0 * k)), h = Math.max(8, Math.round(H0 * k)), n = w * h;
  const D = gownShrink(img, w, h);
  /* 1) the card paper: the brightest big, near-neutral tone on the page (not simply the most common one, which can be a table) */
  const hist = new Float32Array(256), Y = new Uint8Array(n);
  for (let i = 0; i < n; i++) { const y = (D[i * 4]! * 2 + D[i * 4 + 1]! * 5 + D[i * 4 + 2]!) >> 3; Y[i] = y; hist[y]!++; }
  const win = (v: number) => { let s = 0; for (let d = -4; d <= 4; d++) s += hist[v + d] || 0; return s; };
  const tone = (v: number) => { const P = [0, 0, 0]; let c = 0; for (let i = 0; i < n; i++) if (Math.abs(Y[i]! - v) <= 8) { P[0]! += D[i * 4]!; P[1]! += D[i * 4 + 1]!; P[2]! += D[i * 4 + 2]!; c++; } return P.map((x) => Math.max(30, x / Math.max(1, c))); };
  let mode = -1;
  for (let v = 250; v >= 40 && mode < 0; v--) { const s = win(v); if (s >= n * 0.08 && s >= win(v + 1) && s >= win(v - 1)) { const t = tone(v), mx = Math.max(...t); if ((mx - Math.min(...t)) / mx < 0.36) mode = v; } }
  if (mode < 0) {
    let cum = 0, lo = 0;
    for (let v = 0; v < 256; v++) { cum += hist[v]!; if (cum >= n * 0.4) { lo = v; break; } }
    let mb = -1; mode = 255;
    for (let v = Math.max(40, lo); v < 256; v++) { const s = win(v); if (s >= mb) { mb = s; mode = v; } }
  }
  const P = tone(mode);
  /* 2) uneven light + colour cast: a smooth surface fitted through the paper only */
  let co: Fit[] = P.map((v) => [v, 0, 0, 0, 0, 0]);
  for (let it = 0; it < 4; it++) {
    const a = it ? 0.965 : 0.8, b = it ? 1.05 : 1.2, A = Array.from({ length: 6 }, () => new Array<number>(6).fill(0)), B = [0, 1, 2].map(() => new Array<number>(6).fill(0));
    let cnt = 0;
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) {
      const i = (y * w + x) * 4, u = (x / (w - 1)) * 2 - 1, v = (y / (h - 1)) * 2 - 1, q = D[i + 1]! / ev(co[1]!, u, v);
      if (q < a || q > b || Math.abs(D[i]! / ev(co[0]!, u, v) - q) > 0.05 || Math.abs(D[i + 2]! / ev(co[2]!, u, v) - q) > 0.07) continue;
      const t = [1, u, v, u * u, u * v, v * v];
      for (let r = 0; r < 6; r++) { for (let s = 0; s < 6; s++) A[r]![s]! += t[r]! * t[s]!; B[0]![r]! += t[r]! * D[i]!; B[1]![r]! += t[r]! * D[i + 1]!; B[2]![r]! += t[r]! * D[i + 2]!; }
      cnt++;
    }
    if (cnt < n * 0.01) break;
    co = B.map((bv) => solve(A.map((r) => r.slice()), bv.slice()));
  }
  let band: { GB: number; gw: number; lo: Float32Array; hi: Float32Array } | null = null;
  /* 2b) the light block by block, so a hard shadow across the page is followed */
  {
    const GB = Math.max(6, Math.round(Math.max(w, h) / 34)), gw = Math.ceil(w / GB), gh = Math.ceil(h / GB), gn = gw * gh, R = Math.max(2, Math.round(Math.max(gw, gh) * 0.11));
    const V = [new Float32Array(gn), new Float32Array(gn), new Float32Array(gn)], has = new Uint8Array(gn), q: number[] = [];
    for (let by = 0; by < gh; by++) for (let bx = 0; bx < gw; bx++) {
      q.length = 0; let tot = 0;
      for (let y = by * GB; y < Math.min(h, (by + 1) * GB); y++) for (let x = bx * GB; x < Math.min(w, (bx + 1) * GB); x++) {
        const i = (y * w + x) * 4, rr = D[i]! / P[0]!, gg = D[i + 1]! / P[1]!, bb = D[i + 2]! / P[2]!;
        tot++;
        if (gg > 0.3 && gg < 1.15 && Math.abs(rr / gg - 1) < 0.07 && Math.abs(bb / gg - 1) < 0.12) q.push(i);
      }
      if (q.length < tot * 0.15) continue;
      const gs = q.map((i) => D[i + 1]!).sort((a, b) => a - b), top = gs[Math.floor(gs.length * 0.85)]! * 0.97, s = [0, 0, 0];
      let c = 0;
      for (const i of q) if (D[i + 1]! >= top) { s[0]! += D[i]!; s[1]! += D[i + 1]!; s[2]! += D[i + 2]!; c++; }
      const kk = by * gw + bx;
      for (let j = 0; j < 3; j++) V[j]![kk] = s[j]! / c;
      has[kk] = 1;
    }
    let got = 0;
    for (let kk = 0; kk < gn; kk++) got += has[kk]!;
    if (got >= gn * 0.2) {
      const filt = (src: Float32Array, ok: Uint8Array, big: boolean): [Float32Array, Uint8Array] => {
        const o = new Float32Array(gn), oh = new Uint8Array(gn);
        for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
          let m = big ? -1 : 1e9, f = 0;
          for (let yy = Math.max(0, y - R); yy <= Math.min(gh - 1, y + R); yy++) for (let xx = Math.max(0, x - R); xx <= Math.min(gw - 1, x + R); xx++) {
            const kk = yy * gw + xx; if (!ok[kk]) continue; f = 1; m = big ? Math.max(m, src[kk]!) : Math.min(m, src[kk]!);
          }
          if (f) { o[y * gw + x] = m; oh[y * gw + x] = 1; }
        }
        return [o, oh];
      };
      const [m1, h1] = filt(V[1]!, has, true), [m2, h2] = filt(m1, h1, false), G = [new Float32Array(gn), new Float32Array(gn), new Float32Array(gn)], ok = new Uint8Array(gn);
      for (let kk = 0; kk < gn; kk++) if (h2[kk]) {
        const g = m2[kk]!, u = (((kk % gw) + 0.5) / gw) * 2 - 1, v = ((((kk / gw) | 0) + 0.5) / gh) * 2 - 1, f1 = ev(co[1]!, u, v);
        ok[kk] = 1; G[1]![kk] = g; G[0]![kk] = (ev(co[0]!, u, v) / f1) * g; G[2]![kk] = (ev(co[2]!, u, v) / f1) * g;
      }
      for (let pass = 0; pass < gw + gh; pass++) {
        let left = 0;
        for (let kk = 0; kk < gn; kk++) {
          if (ok[kk]) continue;
          const x = kk % gw, y = (kk / gw) | 0, s = [0, 0, 0];
          let c = 0;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const xx = x + dx, yy = y + dy;
            if (xx < 0 || yy < 0 || xx >= gw || yy >= gh || ok[yy * gw + xx] !== 1) continue;
            for (let j = 0; j < 3; j++) s[j]! += G[j]![yy * gw + xx]!;
            c++;
          }
          if (c) { for (let j = 0; j < 3; j++) G[j]![kk] = s[j]! / c; ok[kk] = 2; } else left++;
        }
        for (let kk = 0; kk < gn; kk++) if (ok[kk] === 2) ok[kk] = 1;
        if (!left) break;
      }
      const grids: Grid[] = G.map((g) => {
        const s = new Float32Array(gn);
        for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
          let t = 0, c = 0;
          for (let yy = Math.max(0, y - 1); yy <= Math.min(gh - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(gw - 1, x + 1); xx++) { t += g[yy * gw + xx]!; c++; }
          s[y * gw + x] = t / c;
        }
        return { g: s, gw, gh };
      });
      co = grids;
      const lo = new Float32Array(gn), hi = new Float32Array(gn), g1 = grids[1]!.g;
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        let a = 1e9, b = 0;
        for (let yy = Math.max(0, y - 2); yy <= Math.min(gh - 1, y + 2); yy++) for (let xx = Math.max(0, x - 2); xx <= Math.min(gw - 1, x + 2); xx++) { const t = g1[yy * gw + xx]!; if (t < a) a = t; if (t > b) b = t; }
        lo[y * gw + x] = a; hi[y * gw + x] = b;
      }
      band = { GB, gw, lo, hi };
    }
  }
  const pg: GownScanPage = { width: W0, height: H0, ang: 0, cardW: W0, fit: co, boxes: [] };
  /* 3) what is not paper, once the light is flattened */
  const de = new Float32Array(n), Lp = gownLab(244, 244, 244), nh = new Float32Array(64), th = new Float32Array(64), card = new Uint8Array(n), pap = new Uint8Array(n);
  let nn = 0;
  const tex = new Float32Array(n);
  {
    /* fine texture on the full-size page: cloth has a weave, card is flat (finds white cloth on white card) */
    const F = img.data, s1 = new Float32Array(n), s2 = new Float32Array(n), ct = new Uint16Array(n);
    for (let y = 0; y < H0; y++) {
      const cy = Math.min(h - 1, (y * k) | 0) * w;
      for (let x = 0; x < W0; x++) { const j = (y * W0 + x) * 4, c = cy + Math.min(w - 1, (x * k) | 0), v = (F[j]! * 2 + F[j + 1]! * 5 + F[j + 2]!) / 8; s1[c]! += v; s2[c]! += v * v; ct[c]!++; }
    }
    for (let i = 0; i < n; i++) { const c = Math.max(1, ct[i]!), mu = s1[i]! / c; tex[i] = (Math.sqrt(Math.max(0, s2[i]! / c - mu * mu)) / Math.max(40, mu)) * 100; }
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, u = (x / (w - 1)) * 2 - 1, v = (y / (h - 1)) * 2 - 1, q = D[i * 4 + 1]! / ev(co[1]!, u, v);
    const L = gownLab((D[i * 4]! * 244) / ev(co[0]!, u, v), q * 244, (D[i * 4 + 2]! * 244) / ev(co[2]!, u, v));
    const d = Math.hypot(L[0] - Lp[0], L[1] - Lp[1], L[2] - Lp[2]);
    de[i] = d;
    if (q > 0.55) card[i] = 1;
    if (q > 0.965 && q < 1.05 && d < 16) { nh[Math.min(63, (d * 4) | 0)]!++; nn++; pap[i] = 1; }
  }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (pap[i] && pap[i - 1] && pap[i + 1] && pap[i - w] && pap[i + w]) th[Math.min(63, (tex[i]! * 8) | 0)]!++; }
  let ta = 0, tt = 0, tn = 0;
  for (let b = 0; b < 64; b++) tn += th[b]!;
  for (let b = 0; b < 64; b++) { ta += th[b]!; if (ta >= tn * 0.5) { tt = b / 8; break; } }
  const Tt = Math.max(0.9, tt * 2.2 + 0.35);
  let acc = 0, noise = 2;
  for (let b = 0; b < 64; b++) { acc += nh[b]!; if (acc >= nn * 0.9) { noise = b / 4; break; } }
  const T = clamp(noise * 1.6 + 2, 4.5, 14);
  const edgePaper = (i: number) => {
    /* a neutral pixel lit between the nearby paper levels sits on a shadow edge: paper, not cloth */
    if (!band) return false;
    const x = i % w, y = (i / w) | 0, kk = Math.min(band.gw - 1, (x / band.GB) | 0) + ((y / band.GB) | 0) * band.gw, a = band.lo[kk]!, b = band.hi[kk]!;
    if (!(b > a * 1.15)) return false;
    const j = i * 4, gg = D[j + 1]! / P[1]!;
    return D[j + 1]! >= a * 0.92 && D[j + 1]! <= b * 1.04 && Math.abs(D[j]! / P[0]! / gg - 1) < 0.07 && Math.abs(D[j + 2]! / P[2]! / gg - 1) < 0.12;
  };
  let m = new Uint8Array(n);
  for (let i = 0; i < n; i++) m[i] = (de[i]! > T && !edgePaper(i)) || tex[i]! > Tt ? 1 : 0;
  const r1 = Math.max(1, Math.round(w * 0.005)), r2 = Math.max(2, Math.round(w * 0.012)), r0 = Math.max(1, Math.round(w * 0.008));
  const mo = morph(morph(m, w, h, r0, false), w, h, r0, true);
  for (const p of parts(mo, w, h)) {
    /* the table around the card is not a swatch */
    if (!p.edge) continue;
    let x0 = w, x1 = 0, y0 = h, y1 = 0;
    for (const i of p.pix) { const x = i % w, y = (i / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const sides = (p.edge & 1) + ((p.edge >> 1) & 1) + ((p.edge >> 2) & 1) + ((p.edge >> 3) & 1);
    if (sides >= 3 || p.pix.length < 0.6 * (x1 - x0 + 1) * (y1 - y0 + 1) || p.pix.length > n * 0.3) for (const i of p.pix) m[i] = 0;
  }
  m = morph(morph(m, w, h, r1, true), w, h, r1, false); // close small gaps (lace holes, weave)
  {
    /* fill what is fully enclosed (a pale swatch with only its outline found) */
    const out = new Uint8Array(n), st = new Int32Array(n);
    let sn = 0;
    const push = (i: number) => { if (!m[i] && !out[i]) { out[i] = 1; st[sn++] = i; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (sn) { const p = st[--sn]!, x = p % w; if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (p >= w) push(p - w); if (p < n - w) push(p + w); }
    for (let i = 0; i < n; i++) if (!m[i] && !out[i]) m[i] = 1;
  }
  m = morph(morph(m, w, h, r2, false), w, h, r2, true); // open: printed labels and thin lines go
  /* 4) each patch → the tightest rectangle, at the tilt the page was photographed at */
  const box = (pix: number[], a: number) => {
    const cs = Math.cos(a), sn = Math.sin(a), stp = Math.max(1, (pix.length / 1500) | 0);
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (let j = 0; j < pix.length; j += stp) { const x = pix[j]! % w, y = (pix[j]! / w) | 0, u = x * cs + y * sn, v = -x * sn + y * cs; if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
    return [u0, u1, v0, v1] as const;
  };
  const trim = (pix: number[], a: number) => {
    /* shave off what hangs on a side (a printed label, a shadow): keep the solid rectangle */
    const cs = Math.cos(a), sn = Math.sin(a);
    let [u0, u1, v0, v1] = box(pix, a);
    u0 = Math.floor(u0); v0 = Math.floor(v0); u1 = Math.ceil(u1); v1 = Math.ceil(v1);
    const nu = u1 - u0 + 1, nv = v1 - v0 + 1, G = new Uint8Array(nu * nv);
    for (const p of pix) { const x = p % w, y = (p / w) | 0; G[clamp(Math.round(-x * sn + y * cs) - v0, 0, nv - 1) * nu + clamp(Math.round(x * cs + y * sn) - u0, 0, nu - 1)] = 1; }
    let a0 = 0, a1 = nu - 1, b0 = 0, b1 = nv - 1;
    const rowF = (v: number) => { let s = 0; for (let u = a0; u <= a1; u++) s += G[v * nu + u]!; return s / (a1 - a0 + 1); };
    const colF = (u: number) => { let s = 0; for (let v = b0; v <= b1; v++) s += G[v * nu + u]!; return s / (b1 - b0 + 1); };
    for (let it = 0; it < 3; it++) {
      while (b1 - b0 > 4 && rowF(b0) < 0.85) b0++;
      while (b1 - b0 > 4 && rowF(b1) < 0.85) b1--;
      while (a1 - a0 > 4 && colF(a0) < 0.85) a0++;
      while (a1 - a0 > 4 && colF(a1) < 0.85) a1--;
    }
    let cnt = 0;
    for (let v = b0; v <= b1; v++) for (let u = a0; u <= a1; u++) cnt += G[v * nu + u]!;
    return [u0 + a0, u0 + a1, v0 + b0, v0 + b1, cnt] as const;
  };
  const good: { pix: number[]; a: number }[] = [];
  for (const p of parts(m, w, h)) {
    if (p.pix.length < w * w * 0.0018 || p.pix.length > n * 0.5) continue;
    let ba = 0, bs = 1e12;
    const tryA = (a: number) => { const [u0, u1, v0, v1] = box(p.pix, a), s = (u1 - u0 + 1) * (v1 - v0 + 1); if (s < bs) { bs = s; ba = a; } };
    for (let d = -12; d <= 12; d++) tryA((d * Math.PI) / 180);
    const mid = ba;
    for (let d = -3; d <= 3; d++) tryA(mid + (d * 0.25 * Math.PI) / 180);
    const r = trim(p.pix, ba), rw = r[1] - r[0] + 1, rh = r[3] - r[2] + 1;
    if (r[4] / (rw * rh) < 0.78 || Math.min(rw, rh) < w * 0.055 || Math.max(rw, rh) / Math.min(rw, rh) > 3.2) continue;
    good.push({ pix: p.pix, a: ba });
  }
  const angs = good.map((x) => x.a).sort((a, b) => a - b);
  pg.ang = angs.length ? angs[angs.length >> 1]! : 0;
  const cs = Math.cos(pg.ang), sn = Math.sin(pg.ang);
  let bx = good.map((x) => {
    const [u0, u1, v0, v1] = trim(x.pix, pg.ang), uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
    return { cx: (uc * cs - vc * sn) / k, cy: (uc * sn + vc * cs) / k, w: (u1 - u0 + 1) / k, h: (v1 - v0 + 1) / k };
  });
  bx = bx.flatMap((b) => gownSplitSwatch(img, pg.ang, b, (w * 0.055) / k, 0)); // touching swatches cut apart
  pg.boxes = gownReadingOrder(bx, pg.ang);
  /* the card's own width in the photo (a table around it is not counted) */
  const off = Math.ceil(h * Math.abs(sn)) + 2, col = new Uint16Array(w + 2 * off + 4);
  let cm = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (card[y * w + x]) { const c = ++col[Math.round(x * cs + y * sn) + off]!; if (c > cm) cm = c; }
  let x0 = 0, x1 = col.length - 1;
  while (x0 < x1 && col[x0]! < cm * 0.3) x0++;
  while (x1 > x0 && col[x1]! < cm * 0.3) x1--;
  const cw = (x1 - x0 + 1) / k;
  pg.cardW = cw > W0 * 0.93 || cw < W0 * 0.3 ? W0 : cw;
  return pg;
}

/** Rows top to bottom, then left to right along the page's tilt (the order the designer reads them in). */
export function gownReadingOrder(boxes: GownScanBox[], ang: number): GownScanBox[] {
  const cs = Math.cos(ang), sn = Math.sin(ang);
  const at = boxes.map((b) => ({ b, u: b.cx * cs + b.cy * sn, v: -b.cx * sn + b.cy * cs, row: 0 }));
  const hs = boxes.map((b) => b.h).sort((a, b) => a - b), mh = hs.length ? hs[hs.length >> 1]! : 1;
  at.sort((a, b) => a.v - b.v);
  let row = 0, rv = -1e9;
  for (const x of at) { if (x.v - rv > mh * 0.5) { row++; rv = x.v; } x.row = row; }
  at.sort((a, b) => a.row - b.row || a.u - b.u);
  return at.map((x) => x.b);
}

/** Swatches glued edge to edge come out as one patch: cut it where a straight seam runs right across with a sharp, steady colour jump. */
export function gownSplitSwatch(img: GownRgba, ang: number, b: GownScanBox, minPx: number, depth: number): GownScanBox[] {
  if (depth > 4 || Math.max(b.w, b.h) < minPx * 2) return [b];
  const nu = clamp(Math.round(48 * Math.sqrt(b.w / b.h)), 16, 96), nv = clamp(Math.round(48 * Math.sqrt(b.h / b.w)), 16, 96);
  const D = gownCutOut(img, b.cx, b.cy, b.w, b.h, ang, nu, nv), L: Lab[] = [];
  for (let i = 0; i < nu * nv; i++) L.push(gownLab(D[i * 4]!, D[i * 4 + 1]!, D[i * 4 + 2]!));
  const at = (x: number, y: number) => L[y * nu + x]!;
  const mean = (x0: number, x1: number, y0: number, y1: number, vert: boolean) => {
    const s = [0, 0, 0]; let c = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const l = vert ? at(x, y) : at(y, x); s[0]! += l[0]; s[1]! += l[1]; s[2]! += l[2]; c++; }
    return s.map((v) => v / Math.max(1, c));
  };
  const dE = (p: number[], q: number[]) => Math.hypot(p[0]! - q[0]!, p[1]! - q[1]!, p[2]! - q[2]!);
  let best: { vert: boolean; s: number; A: number; sc: number } | null = null;
  for (const vert of [true, false]) {
    const A = vert ? nu : nv, Bn = vert ? nv : nu, side = vert ? b.w : b.h, lo = Math.max(3, Math.ceil(A * 0.22), Math.ceil((minPx / side) * A)), hi = A - lo, rows = Math.max(3, Math.round(Bn / 8));
    for (let s = lo; s <= hi; s++) {
      let pass = 0, sum = 0, sharp = 0;
      for (let r = 0; r < rows; r++) {
        const y0 = Math.floor((r * Bn) / rows) + 1, y1 = Math.max(y0 + 1, Math.floor(((r + 1) * Bn) / rows) - 1);
        const whole = dE(mean(1, s - 1, y0, y1, vert), mean(s + 1, A - 1, y0, y1, vert)), near = dE(mean(s - 3, s - 1, y0, y1, vert), mean(s + 1, s + 3, y0, y1, vert));
        let pk = s, pv = -1;
        for (let t = Math.max(3, s - 6); t <= Math.min(A - 3, s + 6); t++) { const e = dE(mean(t - 3, t - 1, y0, y1, vert), mean(t + 1, t + 3, y0, y1, vert)); if (e > pv) { pv = e; pk = t; } }
        sum += whole;
        if (whole > 4) pass++;
        if (near >= whole * 0.6 && Math.abs(pk - s) <= 1) sharp++;
      }
      const sc = sum / rows;
      if (pass >= rows * 0.85 && sharp >= rows * 0.85 && sc >= 6 && (!best || sc > best.sc)) best = { vert, s, A, sc };
    }
  }
  if (!best) return [b];
  const cs = Math.cos(ang), sn = Math.sin(ang), f = best.s / best.A, S = best.vert ? b.w : b.h, vert = best.vert;
  const mk = (o: number, len: number): GownScanBox => {
    const dx = vert ? o * cs : -o * sn, dy = vert ? o * sn : o * cs;
    return { cx: b.cx + dx, cy: b.cy + dy, w: vert ? len : b.w, h: vert ? b.h : len };
  };
  return [...gownSplitSwatch(img, ang, mk(-S / 2 + (S * f) / 2, S * f), minPx, depth + 1), ...gownSplitSwatch(img, ang, mk((S * f) / 2, S * (1 - f)), minPx, depth + 1)];
}

// ── One swatch (sbTile · sbCut) ──────────────────────────────────────────────────────────────────────────────────

export type GownSwatchTile = { data: Uint8ClampedArray; size: number; side: number; rgb: [number, number, number]; shade: number };

/** One swatch → a square picture, straightened, white-balanced from the paper beside it (its inner 84 %, edges left out). */
export function gownSwatchTile(img: GownRgba, pg: GownScanPage, b: GownScanBox, size?: number): GownSwatchTile {
  const side = Math.max(8, Math.min(b.w, b.h) * 0.84), S = size || (side >= 300 ? 512 : 256);
  const D = gownCutOut(img, b.cx, b.cy, side, side, pg.ang, S, S);
  const cs = Math.cos(pg.ang), sn = Math.sin(pg.ang), hs = side / 2;
  const at = (lx: number, ly: number) => gownPaperGain(pg, b.cx + lx * cs - ly * sn, b.cy + lx * sn + ly * cs);
  const G = [at(-hs, -hs), at(hs, -hs), at(-hs, hs), at(hs, hs)];
  const sum = [0, 0, 0];
  for (let y = 0; y < S; y++) {
    const fy = y / (S - 1);
    for (let x = 0; x < S; x++) {
      const fx = x / (S - 1), i = (y * S + x) * 4;
      for (let j = 0; j < 3; j++) {
        const v = Math.min(255, D[i + j]! * ((G[0]![j]! * (1 - fx) + G[1]![j]! * fx) * (1 - fy) + (G[2]![j]! * (1 - fx) + G[3]![j]! * fx) * fy));
        D[i + j] = v; sum[j]! += v;
      }
    }
  }
  const gl = G.map((q) => q[1]!);
  return { data: D, size: S, side, rgb: sum.map((v) => Math.round(v / (S * S))) as [number, number, number], shade: Math.max(...gl) / Math.min(...gl) };
}

/** Does a pattern show that never repeats inside the swatch? (lace or a print cut by the swatch's edge) */
export function gownPatternCut(D: ArrayLike<number>, S: number): boolean {
  const N = 32, bsz = S / N, L = new Float32Array(N * N);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let s = 0, c = 0;
    for (let yy = Math.floor(y * bsz); yy < Math.floor((y + 1) * bsz); yy += 2) for (let xx = Math.floor(x * bsz); xx < Math.floor((x + 1) * bsz); xx += 2) { const i = (yy * S + xx) * 4; s += D[i]! * 0.25 + D[i + 1]! * 0.6 + D[i + 2]! * 0.15; c++; }
    L[y * N + x] = s / Math.max(1, c);
  }
  {
    /* a plain light ramp across the swatch is not a pattern */
    let sx = 0, sy = 0, sxx = 0;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = L[y * N + x]!, dx = x - (N - 1) / 2, dy = y - (N - 1) / 2; sx += dx * v; sy += dy * v; sxx += dx * dx; }
    sx /= sxx; sy /= sxx;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) L[y * N + x]! -= sx * (x - (N - 1) / 2) + sy * (y - (N - 1) / 2);
  }
  const Hp = new Float32Array(N * N), R = 6;
  let ss = 0;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let s = 0, c = 0;
    for (let yy = Math.max(0, y - R); yy <= Math.min(N - 1, y + R); yy++) for (let xx = Math.max(0, x - R); xx <= Math.min(N - 1, x + R); xx++) { s += L[yy * N + xx]!; c++; }
    const v = L[y * N + x]! - s / c; Hp[y * N + x] = v; ss += v * v;
  }
  const sd = Math.sqrt(ss / (N * N));
  if (sd < 3.5) return false; // plain cloth: weave and sheen only
  const ac = (dx: number, dy: number) => { let s = 0, c = 0; for (let y = 0; y < N - dy; y++) for (let x = 0; x < N - dx; x++) { s += Hp[y * N + x]! * Hp[(y + dy) * N + x + dx]!; c++; } return s / c / (ss / (N * N)); };
  for (const dir of [[1, 0], [0, 1]] as const) {
    let dipped = false;
    for (let l = 1; l <= 16; l++) { const r = ac(dir[0] * l, dir[1] * l); if (r < 0.15) dipped = true; else if (dipped && r >= 0.3) return false; } // it comes round again: a full repeat fits
  }
  return true;
}

/** A swatch's true size in cm, from the card's own width in the photo and the card's real width. */
export function gownSwatchCm(side: number, cardWidthPx: number, cardCm: number): number {
  return clamp((side * cardCm) / Math.max(1, cardWidthPx), 0.5, 120);
}

// ── Styles and notes (sbGroup · sbFlags) ─────────────────────────────────────────────────────────────────────────

export type GownScanItemLabel = { name: string; code: string; style: string; styleEdited: boolean };

/** Same printed name, or the same code family, is one style; its swatches are that style's colours. */
export function gownGroupStyles(items: ReadonlyArray<GownScanItemLabel>, book: string): string[] {
  const fam = (c: string) => c.replace(/[\s\-_./#]*\d+[a-z]?$/i, '').trim().toLowerCase();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const bk = book.trim().slice(0, 40), names = new Map<string, string>(), famName = new Map<string, string>(), famN = new Map<string, number>();
  for (const it of items) if (it.name) { const kk = norm(it.name); if (kk && !names.has(kk)) names.set(kk, it.name); }
  for (const it of items) if (it.code) {
    const f = fam(it.code);
    if (f.length < 2) continue;
    if (it.name) { if (!famName.has(f)) famName.set(f, names.get(norm(it.name)) || it.name); } else famN.set(f, (famN.get(f) || 0) + 1);
  }
  return items.map((it) => {
    if (it.styleEdited) return it.style;
    let s = '';
    if (it.name) s = names.get(norm(it.name)) || it.name;
    else if (it.code) { const f = fam(it.code); s = famName.get(f) || (!bk && (famN.get(f) ?? 0) >= 2 ? f.toUpperCase() : ''); }
    return (s || bk || 'Swatch book').slice(0, 40);
  });
}

export const GOWN_SCAN_NOTE = {
  cut: 'Pattern may be bigger than this swatch. Ask your supplier for a bigger piece.',
  shade: 'Part of this swatch is in shadow: check its colour, or retake the page in even light.',
} as const;

/** What the designer should check on one swatch before saving. */
export function gownScanNotes(it: { cut: boolean; lace: boolean; cm: number; shade: number }): string[] {
  const out: string[] = [];
  if (it.cut || (it.lace && it.cm < 8)) out.push(GOWN_SCAN_NOTE.cut);
  if (it.shade > 1.25) out.push(GOWN_SCAN_NOTE.shade);
  return out;
}
