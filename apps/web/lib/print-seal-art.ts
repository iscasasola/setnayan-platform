/**
 * 🖨 THE SEALS ON PAPER — the v84 seal art (`lib/print-seal-art.generated.ts`, baked from the owner-approved
 * `badge-milestones_v84.html` by `scripts/gen-print-seal-art.mjs`) with the AWARD's own year on its ribbon, and No. 1
 * from the award kit's shipped No. 1 art (fetched through its door `loadNo1Seal`, made still — no animation).
 *
 * Every letter is an outline (Cinzel Bold), so a print shop's machine draws it without the font.
 * ⚠ SERVER ONLY — the art is ~270 KB. Never imported by a client file (🔒 lib/prints-wear-only-v84-badges.test.ts).
 */
import type { StoredSeal } from '@/lib/shop-seals';
import { PRINT_SEAL_GLYPHS, PRINT_SEAL_KERN, PRINT_SEAL_SVG, PRINT_SEAL_UPM, PRINT_SEAL_YEAR_SLOT } from '@/lib/print-seal-art.generated';

type ArtKey = keyof typeof PRINT_SEAL_SVG;

/** Which v84 seal art each stored seal wears (the prototype's `SN`: medal · heart · crest · partner). */
export const SEAL_ART_OF: Readonly<Record<Exclude<StoredSeal, 'no1'>, ArtKey>> = {
  top10: 'medal',
  clients_choice: 'heart',
  most_in_demand: 'crest',
  verified_partner: 'partner',
};

/** Every seal's drawing box: the prototype's `viewBox="-10 -14 320 304"` (No. 1: its own, same size). */
export const SEAL_ART_W = 320;
export const SEAL_ART_H = 304;

const r3 = (n: number) => +n.toFixed(3);

function cubic(d: string): (u: number) => [number, number] {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = (d.match(/-?\d*\.?\d+/g) || []).map(Number) as [number, number, number, number, number, number, number, number];
  return (u) => {
    const v = 1 - u;
    const a = v * v * v;
    const b = 3 * v * v * u;
    const c = 3 * v * u * u;
    const e = u * u * u;
    return [a * x0 + b * x1 + c * x2 + e * x3, a * y0 + b * y1 + c * y2 + e * y3];
  };
}

/** The year words on the ribbon, as the generator lays a textPath: centred, each glyph's middle on the curve. */
export function sealYearOutlines(key: ArtKey, year: number): string {
  const slot = PRINT_SEAL_YEAR_SLOT[key];
  const str = `${slot.lead}${Math.trunc(year)}`;
  const pt = cubic(slot.d);
  const NS = 400;
  const P: Array<[number, number]> = [pt(0)];
  const L = [0];
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
  const k = slot.size / PRINT_SEAL_UPM;
  const chars = Array.from(str).filter((ch) => PRINT_SEAL_GLYPHS[ch]);
  const adv = chars.map((ch, i) => (PRINT_SEAL_GLYPHS[ch]![0] + (PRINT_SEAL_KERN[ch + (chars[i + 1] ?? '')] ?? 0)) * k);
  const w = adv.reduce((s, a) => s + a, 0) + slot.ls * (chars.length - 1);
  let pen = L[NS]! / 2 - w / 2;
  return chars
    .map((ch, i) => {
      const [x, y, ang] = at(pen + adv[i]! / 2);
      pen += adv[i]! + slot.ls;
      const [a, d] = PRINT_SEAL_GLYPHS[ch]!;
      if (!d) return '';
      return `<g transform="translate(${r3(x)} ${r3(y)}) rotate(${r3(ang)})"><path transform="scale(${r3(k)} ${r3(-k)}) translate(${r3(-a / 2)} 0)" d="${d}"/></g>`;
    })
    .join('');
}

/**
 * One seal as a standalone <svg> document (`size` px wide), still, ids prefixed with `uid`, carrying its award year.
 * Async because No. 1's art is loaded on demand (it is never imported statically — award-kit test).
 */
export async function sealPrintSvg(seal: StoredSeal, year: number, uid: string, size = SEAL_ART_W): Promise<string> {
  const u = uid.replace(/[^A-Za-z0-9_-]/g, '') || 'sl';
  if (seal === 'no1') {
    // through the award kit's own door (the art is only ever fetched by import()); made still for paper
    const { loadNo1Seal } = await import('@/app/_components/award/no1-seal');
    const art = await loadNo1Seal(year, 'card', `${u}_`);
    return art
      .replace(/<(animate|animateTransform|animateMotion|set)\b[^>]*\/>/g, '')
      .replace(/ class="[^"]*"/g, '')
      .replace('width="200" height="190"', `width="${r3(size)}" height="${r3((size * SEAL_ART_H) / SEAL_ART_W)}"`);
  }
  const key = SEAL_ART_OF[seal];
  return PRINT_SEAL_SVG[key]
    .replace(/§/g, `${u}_`)
    .replace('{{YEAR}}', sealYearOutlines(key, year))
    .replace('width="200" height="190"', `width="${r3(size)}" height="${r3((size * SEAL_ART_H) / SEAL_ART_W)}"`);
}
