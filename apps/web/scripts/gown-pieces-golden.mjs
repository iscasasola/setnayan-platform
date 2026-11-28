// Regenerate: node apps/web/scripts/gown-pieces-golden.mjs <v210 html> > apps/web/lib/gown-pattern/prototype-v210-pieces.golden.json
// (v210 is in the specs corpus history: `git -C <corpus> show 0b0fe29:prototypes/gown_maker_2026-11-27/gown_maker_v210.html`.)
// Runs the prototype's OWN patCutList (v210: a bodice or skirt in its own fabric is cut from its own, the other pieces
// in their own fabric are named) on fixed orders and prints the result, so lib/gown-pattern/cutting-list.ts can be held
// to it. Input file is argv[2]; nothing from it is imported.
import { readFileSync } from 'node:fs';
const html = readFileSync(process.argv[2], 'utf8');
const L = html.split('\n');
const at = (pre) => L.findIndex((l) => l.startsWith(pre));
const start = at('function draftSkirt('), end = at('function patPrintDoc(');
const gStart = at('const GMEAS = ['), gEnd = L.findIndex((l, i) => i > gStart && l.startsWith('];'));
const silLine = L.find((l) => l.startsWith('const SIL = {'));
if (start < 0 || end < 0 || gStart < 0 || !silLine) throw new Error('prototype functions not found');
const src = [
  'const clamp = (x, a, b) => Math.max(a, Math.min(b, x));',
  "const esc = (t) => String(t).replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' })[c]);",
  'const quote = { prices: {} }, SIL_NAME = {}, DRAFT_SHOW = null, lnBlocks = () => {};',
  'const isMan = () => false, STRAPLESS = {}, gown = { neck: "sweetheart", boning: "soft", sleeve: "none", sil: "aline", slits: [], train: "none" }, dress = { hem: "floor" };',
  silLine,
  L.slice(gStart, gEnd + 1).join('\n'),
  L.slice(start, end).join('\n'),
  'return { patCutList };',
].join('\n');
const X = new Function(src)();
const r = (x) => Math.round(x * 10) / 10;
const v = { height: 160, bust: 88, underbust: 74, waist: 70, hips: 96 };
const meas = {
  waistHip: 20 + v.height * 0.02, waistFloor: v.height * 0.61, knee: v.hips * 0.38,
  napeWaist: r(0.256 * v.height), frontLen: r(0.27 * v.height), shoulderApex: r(0.16 * v.height), apexApex: r(0.2 * v.bust + 0.4),
  acrossBack: r(34.4 * v.height / 160), acrossChest: r(32.4 * v.height / 160), shoulderLen: r(12.25 * v.height / 160), sideLen: r(0.122 * v.height), neck: r(36),
};
const ease = [{ part: 'Bust', ease: 2.5 }, { part: 'Waist', ease: 1.5 }, { part: 'Hips', ease: 6 }];
const base = { outerName: 'Duchess satin', lining: 'satin', layers: [], accent: null, lace: null, incl: [] };
const cases = [
  { name: 'no pieces of their own: exactly as before', sil: 'aline', cut: { ...base, metres: { outer: 4.2, lining: 3.6, tulle: 0 } } },
  { name: 'a bodice in black lace: cut from its own, its metres checked', sil: 'aline', cut: { ...base, pz: { bodice: 'black lace', skirt: null, other: [] }, metres: { outer: 3.4, bodice: 0.9, lining: 3.6, tulle: 0 } } },
  { name: 'a skirt in blush satin, the sleeves in their own fabric (accent said once)', sil: 'fitflare', cut: { ...base, accent: 'sleeves', pz: { skirt: 'blush satin', other: ['blush chiffon for the sleeves'] }, metres: { outer: 3.9, bodice: 0, lining: 3.3, tulle: 0 } } },
  { name: 'both in their own, a border band, the quote too small for the bodice', sil: 'sheath', cut: { ...base, incl: ['the cape'], pz: { bodice: 'ivory mikado', skirt: 'black crepe', other: ['gold satin for the hem border band'] }, metres: { outer: 2.1, bodice: 0.3, lining: 2.5, tulle: 0 } } },
];
const out = { input: { vals: v, estimate: meas, ease }, cases: [] };
for (const c of cases) {
  const o = { vals: v, design3d: { v: 2, gown: { sil: c.sil, petti: 'none', train: 'none' }, hem: 'floor' }, gownMeasEst: meas, ease, cut: c.cut };
  out.cases.push({ name: c.name, sil: c.sil, cut: c.cut, cutList: X.patCutList(o, {}) });
}
process.stdout.write(JSON.stringify(out) + '\n');
