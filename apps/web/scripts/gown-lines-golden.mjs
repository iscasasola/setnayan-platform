// Regenerate: node apps/web/scripts/gown-lines-golden.mjs <v209 html> > apps/web/lib/gown-pattern/prototype-v209-lines.golden.json
// (v209 is in the specs corpus history: `git -C <corpus> show 137294f:prototypes/gown_maker_2026-11-27/gown_maker_v209.html`.)
// Runs the prototype's OWN draftSkirt / draftBodice and v209's `lnBlocks` + `lnSummary` on fixed inputs and prints the
// design lines they draw and the sentences they write, so lib/gown-pattern/lines.ts can be held to them. Input file
// is argv[2]; nothing from it is imported.
import { readFileSync } from 'node:fs';
const html = readFileSync(process.argv[2], 'utf8');
const L = html.split('\n');
const at = (pre) => L.findIndex((l) => l.startsWith(pre));
const start = at('function draftSkirt('), end = at('function blockSVG(');
const gStart = at('const GMEAS = ['), gEnd = L.findIndex((l, i) => i > gStart && l.startsWith('];'));
const silLine = L.find((l) => l.startsWith('const SIL = {'));
const one = (pre) => { const i = at(pre); if (i < 0) throw new Error(`not found: ${pre}`); return L[i]; };
const block = (pre) => { const i = at(pre); if (i < 0) throw new Error(`not found: ${pre}`); let j = i; while (!/^(function |const |Object\.assign|\/\*)/.test(L[j + 1] ?? 'function ')) j++; return L.slice(i, j + 1).join('\n'); };
if (start < 0 || end < 0 || gStart < 0 || !silLine) throw new Error('prototype functions not found');
const summary = block('function lnSummary(').replace('function lnSummary() {', 'function lnSummary(m) {').replace('const out = [], m = lnMeasured();', 'const out = [];');
const src = [
  'const clamp = (x, a, b) => Math.max(a, Math.min(b, x));',
  "const esc = (t) => String(t).replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' })[c]);",
  'const quote = { prices: {} }, SIL_NAME = {}, DRAFT_SHOW = null;',
  'const isMan = () => false, STRAPLESS = {}, gown = { neck: "sweetheart", boning: "soft", sleeve: "none", sil: "aline", slits: [], train: "none" }, dress = { hem: "floor" };',
  silLine,
  L.slice(gStart, gEnd + 1).join('\n'),
  L.slice(start, end).join('\n'),
  one('const LN_NECKS = '),
  one('const lnG = '),
  one('const lnD = '),
  one('const lnR2 = '),
  one('const lnCurveWord = '),
  summary,
  block('function lnBlocks('),
  'return { draftSkirt, draftBodice, lnBlocks, lnSummary, gown };',
].join('\n');
const X = new Function(src)();

const r = (x) => Math.round(x * 10) / 10;
const v = { height: 160, bust: 88, underbust: 74, waist: 70, hips: 96 };
const skirtEst = { waistHip: 20 + v.height * 0.02, waistFloor: v.height * 0.61, knee: v.hips * 0.38 };
const bodiceMeas = {
  napeWaist: r(0.256 * v.height), frontLen: r(0.27 * v.height), shoulderApex: r(0.16 * v.height), apexApex: r(0.2 * v.bust + 0.4),
  acrossBack: r(34.4 * v.height / 160), acrossChest: r(32.4 * v.height / 160), shoulderLen: r(12.25 * v.height / 160), sideLen: r(0.122 * v.height), neck: r(36),
};
const ease = [{ part: 'Bust', ease: 2.5 }, { part: 'Waist', ease: 1.5 }, { part: 'Hips', ease: 6 }];

const neck = (o) => ({ custom: true, from: 'sweetheart', centre: 17.5, cornerL: 7.25, cornerDepthL: 15, shoulderL: 9, shoulderDepthL: 4, curve: 0.8, cornerR: 7.25, cornerDepthR: 15, shoulderR: 9, shoulderDepthR: 4, ...o });
const back = (o) => ({ custom: true, from: 'scoop', depth: 30, halfL: 12, halfR: 12, curve: 0.866, sideDepth: 12, ...o });
const hem = (o) => ({ custom: true, front: 8, left: 4, back: 0, right: 4, curve: 0.5, edge: 'plain', ...o });
const cases = [
  { name: 'custom neckline, scoop back, high-low hem', sil: 'aline', lines: { neck: neck(), back: back(), hem: hem() } },
  { name: 'uneven neckline, low shoulder point, V back', sil: 'sheath', lines: { neck: neck({ cornerR: 9, cornerDepthR: 18, shoulderL: 14, shoulderDepthL: 12, curve: 0.2 }), back: back({ from: 'v', curve: 0.5, halfL: 10, halfR: 14, depth: 40 }), hem: hem({ edge: 'scallop' }) } },
  { name: 'named lines only (blocks draw them; the sheet says nothing)', sil: 'fitflare', lines: { neck: neck({ custom: false }), back: back({ custom: false, curve: 0.99 }), hem: hem({ custom: false, front: 2, back: 2, edge: 'hanky' }) } },
  { name: 'ball gown: no hem line on the circle skirt', sil: 'ball', lines: { neck: neck({ curve: 0.03, shoulderDepthL: -8, shoulderL: 5 }), hem: hem() } },
  { name: 'mermaid, square back, armholes cut in', sil: 'mermaid', lines: { back: back({ curve: 0.95, sideDepth: 40 }), hem: hem({ front: 3, back: 3, edge: 'curved', custom: true }), armhole: 3.5 } },  // Discriminating cases: a neckline only slightly uneven (under 1 cm), an uneven hem (left ≠ right), and shoulder
  // points stepping down through the "on the shoulder seam" threshold half a centimetre at a time.
  { name: 'slightly uneven neckline, uneven hem', sil: 'aline', lines: { neck: neck({ cornerR: 8 }), hem: hem({ left: 9, right: 2 }) } },
  ...[-4, -3.5, -3, -2.5, -2, -1.5].map((d) => ({ name: `shoulder point at ${d} cm from the collarbone`, sil: 'aline', lines: { neck: neck({ shoulderDepthL: d, shoulderL: 7 }) } })),
];
const style = (d) => (d.error ? d.error : d.pieces.map((p) => ({ name: p.name, style: p.style || [] })));
const out = { input: { vals: v, skirtEstimate: skirtEst, bodiceEstimate: bodiceMeas, ease }, cases: [] };
for (const c of cases) {
  const o = { vals: v, design3d: { v: 2, gown: { sil: c.sil }, hem: 'floor' }, gownMeasEst: { ...skirtEst, ...bodiceMeas }, ease, lines: c.lines };
  const bo = X.draftBodice(o, {}), dr = X.draftSkirt(o, {});
  X.lnBlocks(o, {}, bo, dr);
  X.gown.neck = c.name.includes('armholes') ? 'high' : 'sweetheart';
  out.cases.push({ name: c.name, sil: c.sil, lines: c.lines, highNeck: X.gown.neck === 'high', bodice: style(bo), skirt: style(dr), summary: X.lnSummary(c.lines) });
}
process.stdout.write(JSON.stringify(out, null, 1) + '\n');
