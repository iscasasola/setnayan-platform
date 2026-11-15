/**
 * 🎁 THE GIFT BOX'S GEOMETRY — the approved realistic box (owner 15 Nov: "giftbox approved"; corpus
 * `prototypes/supplier_badges_2026-11-15/gift-box_APPROVED_2026-11-15.html`), ported number for number.
 *
 * A real box in CSS 3D: 1em = 1% of the stage; every face is one flat plane, and the only things that ever animate are
 * `transform` and `opacity`. Every size here is in hundredths of the stage. PURE — no DOM — so the poses, the lid's
 * flight and the sparks are unit-testable and identical on every render.
 */

/** The box: width, depth, height and wall thickness. */
export const W = 46;
export const D = 40;
export const H = 33;
export const T = 1.3;
/** The lid: overhang, skirt height, wall, and how far its top sits above the rim. */
export const O = 1.3;
export const LH = 9.6;
export const TL = 1.1;
export const GAP = 0.5;
export const LW = W + 2 * O;
export const LD = D + 2 * O;
/** Ribbon width. */
export const RW = 7.2;
/** The wax seal's size, and its centre down the front. */
export const SEAL = 16.5;
export const SY = LH + (H - LH) * 0.5;

/** The lid's resting tilt once it has slid off: its far rim on the floor, leaning on the box's top right edge. */
const PHI = 67;
const SIN = Math.sin((PHI * Math.PI) / 180);
const COS = Math.cos((PHI * Math.PI) / 180);
const EY = -((LW / 2) * SIN + LH * COS);
export const EX = W / 2 + (LH - (-H - EY) * COS) / SIN + 0.4;
export const EZ = -2;
const RY = -(H + GAP);

/** Two decimals, the way the prototype writes every length. */
export function n(v: number): number {
  return Math.round(v * 100) / 100;
}

export function pose(x: number, y: number, z: number, rz: number, rx: number): string {
  return `translate3d(${n(x)}em,${n(y)}em,${n(z)}em) rotateZ(${n(rz)}deg) rotateX(${n(rx)}deg)`;
}

export function tr(x: number, y: number, z: number, rot?: string): string {
  return `translate3d(${n(x)}em,${n(y)}em,${n(z)}em)${rot ? ` ${rot}` : ''}`;
}

/** The lid on the box, and where it comes to rest. */
export const LID_REST = pose(0, RY, 0, 0, 0);
export const LID_END = pose(EX, EY, EZ, PHI, 0);

/**
 * The lid's flight, as keyframe stops: pressed down by the squash, up and heavy (tilting back a touch), over the edge,
 * lands a touch too far, settles. Timing is the box's own open length (a multiple of `--sn-dur-enter`).
 */
export const LID_STOPS: ReadonlyArray<readonly [pct: number, transform: string]> = [
  [0, LID_REST],
  [7, pose(0, RY + 0.7, 0, 0, 0)],
  [40, pose(1.5, RY - 13, 0, -7, 7)],
  [62, pose(EX * 0.56, RY - 15.5, EZ * 0.6, 24, 3)],
  [85, pose(EX + 0.2, EY - 0.6, EZ, PHI + 4, 0)],
  [93, pose(EX, EY, EZ, PHI - 1.6, 0)],
  [100, LID_END],
];

/**
 * The ticket inside the box: 44 wide (the voucher's own 316 × 170), standing at the box's centre, turned square to the
 * eye (undoing the world's turn). Laid out 2.5× and scaled back down: a GPU draws a 3D plane at its layout size, so a
 * small plane blown up goes soft.
 */
export const TW = 44;
export const TH = (TW * 170) / 316;
export const TX = 2.5;
const FACE = ' rotateY(29deg) rotateX(25deg)';
function tpose(y: number, s: number, tilt: number): string {
  return `translate3d(0em,${n(y)}em,0em)${FACE} rotateZ(${n(tilt)}deg) scale(${Math.round((s / TX) * 1000) / 1000})`;
}
export const TICKET_START = tpose(-H * 0.35, 0.82, 0);
export const TICKET_END = tpose(-H - TH * 0.5 + 1, 1.16, -3);

/** The keyframes the box needs that depend on its own sizes, as one stylesheet (names are global, prefixed `gmb-`). */
export function boxKeyframes(): string {
  const lid = LID_STOPS.map(([p, t]) => `${p}%{transform:${t}}`).join('');
  return `@keyframes gmb-lid{${lid}}@keyframes gmb-tk{0%{transform:${TICKET_START}}100%{transform:${TICKET_END}}}`;
}

/** A small seeded random — one fixed shape and spark pattern, so a re-render never reshuffles them. */
export function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The wax's irregular edge: one fixed, seeded shape — a smooth closed curve in a 100 × 100 box. */
export const WAX_BLOB: string = (() => {
  const R = rng(23);
  const N = 16;
  const p: Array<[number, number]> = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const r = 45 + (R() - 0.5) * 5.5 + (i % 5 === 2 ? 2.6 : 0);
    p.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r]);
  }
  let d = `M${n(p[0]![0])} ${n(p[0]![1])}`;
  for (let i = 0; i < N; i++) {
    const p0 = p[(i + N - 1) % N]!;
    const p1 = p[i]!;
    const p2 = p[(i + 1) % N]!;
    const p3 = p[(i + 2) % N]!;
    d += ` C${n(p1[0] + (p2[0] - p0[0]) / 6)} ${n(p1[1] + (p2[1] - p0[1]) / 6)},${n(p2[0] - (p3[0] - p1[0]) / 6)} ${n(
      p2[1] - (p3[1] - p1[1]) / 6,
    )},${n(p2[0])} ${n(p2[1])}`;
  }
  return `${d}Z`;
})();

export type Spark = { dx: string; dy: string; rt: string; shape: 'dot' | 'streak' | 'square' };

/** The gold sparks from the opening (they replaced the six flying pieces: a box cannot both break and lift its lid). */
export const SPARKS: readonly Spark[] = (() => {
  const R = rng(5);
  const out: Spark[] = [];
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + ((i - 6.5) / 14) * Math.PI * 1.5 + (R() - 0.5) * 0.25;
    const d = 24 + R() * 22;
    out.push({
      dx: `${n(Math.cos(a) * d)}em`,
      dy: `${n(Math.sin(a) * d - 6)}em`,
      rt: `${Math.round((R() - 0.5) * 240)}deg`,
      shape: i % 3 === 1 ? 'streak' : i % 5 === 3 ? 'square' : 'dot',
    });
  }
  return out;
})();

/**
 * The Setnayan mark embossed all over the gold foil (owner 15 Nov: "more premium and expensive"): a light edge up-left,
 * a shadow down-right, nothing printed — the prototype's `--emb`, from the one shared mark path.
 */
export function embossDataUri(markPath: string): string {
  const m = (x: number, y: number, c: string) =>
    `<g fill='${c}' transform='translate(${x} ${y}) scale(.0072 -.0072) translate(0 -4000)'><path d='${markPath}'/></g>`;
  const t =
    `<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'>` +
    m(12.6, 12.6, 'rgba(255,246,214,.30)') +
    m(13.6, 13.6, 'rgba(60,34,4,.26)') +
    m(13.1, 13.1, 'rgba(201,152,47,.9)') +
    m(62.6, 62.6, 'rgba(255,246,214,.30)') +
    m(63.6, 63.6, 'rgba(60,34,4,.26)') +
    m(63.1, 63.1, 'rgba(201,152,47,.9)') +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(t)}")`;
}
