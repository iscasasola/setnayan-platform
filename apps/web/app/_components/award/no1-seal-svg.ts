/**
 * 🥇 THE No. 1 SEAL — "No. 1 Supplier of the Year" IS THE TOP 10 MEDAL READING #1 RANK (owner 15 Nov, v86
 * `no1RankSvg`): SETNAYAN on the arc, a big #1 filling the face (no mark — "increase the size of 1 to take up the
 * space"), RANK under it, and 34 brilliant-cut diamonds in gold settings all round the rim. The trophy drawing is NOT
 * built (owner: "Return the plaque originally planned … the one with red velvet and diamond studded plaque").
 *
 * Every letter is a Cinzel Bold OUTLINE — owner: "#1 font changed": a picture cannot use the page's Cinzel, so `<text>`
 * fell back to Georgia in the show and turned back to Cinzel on the plaque. Outlines are one shape everywhere.
 * The year rides the ribbon as outlines too, each digit following the ribbon's own (2.4×) flow.
 *
 * ⚠ What EARNS it is still an open owner question — nothing outside the kit may offer it until he rules.
 * ⚠ HEAVY (the art is ~150 KB of SVG): import this module only with `import()` — `loadNo1Seal` (./no1-seal) and the
 * plaque do exactly that, on a tap. Nothing may import it statically (a kit test holds it).
 *
 * PURE: strings of SVG.
 */
import { CINZEL_DIGITS, NO1_ART, NO1_YEAR_PATH } from './no1-rank-art';

type Pt = [number, number];
const r3 = (n: number) => +n.toFixed(3);

/** The cubic "M x,y C x,y x,y x,y" as a point function. */
function cubic(d: string): (u: number) => Pt {
  const n = (d.match(/-?\d*\.?\d+/g) || []).map(Number);
  const [x0, y0, x1, y1, x2, y2, x3, y3] = n as [number, number, number, number, number, number, number, number];
  return (u) => {
    const v = 1 - u;
    const a = v * v * v;
    const b = 3 * v * v * u;
    const c = 3 * v * u * u;
    const e = u * u * u;
    return [a * x0 + b * x1 + c * x2 + e * x3, a * y0 + b * y1 + c * y2 + e * y3];
  };
}

/**
 * Lays `str` out along `pt` as SVG does for `<textPath startOffset="50%" text-anchor="middle">`: centred on the path's
 * length, letter-spacing between the glyphs, each glyph's middle on the path and turned to its tangent.
 */
function layOut(str: string, size: number, ls: number, pt: (u: number) => Pt): Array<[number, number, number]> {
  const NS = 200;
  const L = [0];
  const P: Pt[] = [pt(0)];
  for (let i = 1; i <= NS; i++) {
    const q = pt(i / NS);
    const p = P[i - 1]!;
    P.push(q);
    L.push(L[i - 1]! + Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  const at = (s: number): [number, number, number] => {
    let i = 1;
    while (i < NS && L[i]! < s) i++;
    const a = P[i - 1]!;
    const b = P[i]!;
    const t = (s - L[i - 1]!) / (L[i]! - L[i - 1]! || 1);
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI];
  };
  let w = ls * (str.length - 1);
  for (const ch of str) w += (CINZEL_DIGITS[ch]![0] * size) / 1000;
  let s = L[NS]! / 2 - w / 2;
  const out: Array<[number, number, number]> = [];
  for (const ch of str) {
    const adv = (CINZEL_DIGITS[ch]![0] * size) / 1000;
    out.push(at(s + adv / 2));
    s += adv + ls;
  }
  return out;
}

/** The year on the ribbon: Cinzel Bold digit outlines, each riding the ribbon's flow (kept on the plaque: data-flow). */
function yearOutlines(year: string | number): string {
  const str = String(year).replace(/[^0-9]/g, '');
  if (!str) return '';
  const SIZE = 6.3;
  const LS = 1.7;
  const keys = NO1_YEAR_PATH.values.split(';').map((d) => layOut(str, SIZE, LS, cubic(d)));
  const k = SIZE / 1000;
  const anim = `keyTimes="${NO1_YEAR_PATH.keyTimes}" dur="${NO1_YEAR_PATH.dur}" repeatCount="indefinite" calcMode="spline" keySplines="${NO1_YEAR_PATH.keySplines}"`;
  return [...str]
    .map((ch, i) => {
      const [x, y, a] = keys[0]![i]!;
      const [adv, d] = CINZEL_DIGITS[ch]!;
      const tr = keys.map((kf) => `${r3(kf[i]![0])} ${r3(kf[i]![1])}`).join(';');
      const ro = keys.map((kf) => r3(kf[i]![2])).join(';');
      return (
        `<g transform="translate(${r3(x)} ${r3(y)}) rotate(${r3(a)})">` +
        `<animateTransform data-flow="1" attributeName="transform" type="translate" values="${tr}" ${anim}/>` +
        `<animateTransform data-flow="1" attributeName="transform" type="rotate" additive="sum" values="${ro}" ${anim}/>` +
        `<path transform="scale(${r3(k)} ${r3(-k)}) translate(${-adv / 2} 0)" d="${d}"/></g>`
      );
    })
    .join('');
}

/** The No. 1 seal at `size` wide (the art is 320×304). `uid` prefixes every def id — one per copy on a screen. */
export function no1SealSvg({ anim = true, size = 200, year, uid = 'n1_' }: { anim?: boolean; size?: number; year: string | number; uid?: string }): string {
  let svg = NO1_ART.replace(/§/g, uid).replace('{{YEAR}}', yearOutlines(year));
  svg = svg.replace('width="200" height="190"', `width="${r3(size)}" height="${r3((size * 190) / 200)}"`);
  if (!anim) svg = svg.replace(/<(animate|animateTransform|animateMotion|set)\b[^>]*\/>/g, '');
  return svg;
}

/**
 * The seal as v86 mounts it. `'card'` (`SEALS.no1`): 200×190. `'arch'` (v86 `openSealPlaque`): 372×354, filling the
 * red-velvet niche of the No. 1 plaque.
 */
export function no1Seal(year: string | number, fit: 'card' | 'arch' = 'card', uid?: string): string {
  const svg = no1SealSvg({ anim: true, size: fit === 'arch' ? 372 : 200, year, uid });
  // the root's height is the first one in the string
  return fit === 'arch' ? svg.replace(/height="[\d.]+"/, 'height="354"') : svg;
}
