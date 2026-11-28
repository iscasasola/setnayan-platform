// Regenerate: node apps/web/scripts/gown-pattern-golden.mjs <specs corpus>/prototypes/gown_maker_2026-11-27/gown_maker_v205.html > apps/web/lib/gown-pattern/prototype-v205.golden.json
// Runs the prototype's OWN draftSkirt / draftBodice (gown_maker_v205.html) on fixed inputs and prints their outputs as
// JSON, so the TypeScript port can be held to them. Input file is passed as argv[2]; nothing from it is imported.
import { readFileSync } from 'node:fs';
const html = readFileSync(process.argv[2], 'utf8');
const lines = html.split('\n');
const start = lines.findIndex((l) => l.startsWith('function draftSkirt('));
const end = lines.findIndex((l) => l.startsWith('function blockSVG('));
const gStart = lines.findIndex((l) => l.startsWith('const GMEAS = ['));
const gEnd = lines.findIndex((l, i) => i > gStart && l.startsWith('];'));
// v197: the silhouette table (`SIL`: A-line and saya ease 10, the skim rule) is read by draftSkirt.
const silLine = lines.find((l) => l.startsWith('const SIL = {'));
if (start < 0 || end < 0 || gStart < 0 || gEnd < 0 || !silLine) throw new Error('prototype functions not found');
const src = [
  'const clamp = (x, a, b) => Math.max(a, Math.min(b, x));',
  'const isMan = () => false, STRAPLESS = {}, gown = { neck: "sweetheart", boning: "soft", sleeve: "none", sil: "aline", slits: [], train: "none" }, dress = { hem: "floor" };',
  silLine,
  lines.slice(gStart, gEnd + 1).join('\n'),
  lines.slice(start, end).join('\n'),
  'return { draftSkirt, draftBodice, DRAFT };',
].join('\n');
const X = new Function(src)();

// The prototype's own 7 test bodies (tests/skirt.js, tests/bod.js).
const bodies = [
  { height: 150, bust: 68, underbust: 62, waist: 52, hips: 74 },
  { height: 155, bust: 84, underbust: 72, waist: 68, hips: 90 },
  { height: 160, bust: 88, underbust: 74, waist: 70, hips: 96 },
  { height: 165, bust: 92, underbust: 76, waist: 74, hips: 100 },
  { height: 155, bust: 108, underbust: 90, waist: 90, hips: 110 },
  { height: 155, bust: 120, underbust: 102, waist: 122, hips: 120 },
  { height: 155, bust: 150, underbust: 128, waist: 145, hips: 160 },
];
const r = (x) => Math.round(x * 10) / 10;
// Skirt estimates exactly as tests/skirt.js gives them.
const skirtEst = (v) => ({ waistHip: 20 + v.height * 0.02, waistFloor: v.height * 0.61, knee: v.hips * 0.38 });
// Bodice measurements: the prototype took these from the 3D body (estMeas), which the port does not have until step A3.
// These are fixed stand-ins shaped like Aldrich's size chart (v179 notes: size 12 = 160 / 88), test fixtures only.
const bodiceMeas = (v) => ({
  napeWaist: r(0.256 * v.height), frontLen: r(0.27 * v.height + (v.bust - 88) * 0.12), shoulderApex: r(0.16 * v.height + (v.bust - 88) * 0.09),
  apexApex: r(0.2 * v.bust + 0.4), acrossBack: r(34.4 * v.height / 160 + (v.bust - 88) * 0.05), acrossChest: r(32.4 * v.height / 160 + (v.bust - 88) * 0.06),
  shoulderLen: r(12.25 * v.height / 160), sideLen: r(0.122 * v.height), neck: r(36 + (v.bust - 88) * 0.12),
});
const out = { skirts: [], bodices: [], errors: [] };
// v197: the A-line and saya now leave the body at the waist (10 cm hip ease); the old A-line is Fit and flare.
const hipEase = (sil) => (sil === 'sheath' ? 3 : sil === 'mermaid' ? 2 : sil === 'aline' || sil === 'terno' ? 10 : 6);
for (const v of bodies) for (const sil of ['aline', 'fitflare', 'terno', 'sheath', 'mermaid', 'ball']) {
  const ease = [{ part: 'Waist', ease: 1.5 }, { part: 'Hips', ease: hipEase(sil) }];
  const o = { vals: v, design3d: { v: 2, gown: { sil }, hem: 'floor' }, gownMeasEst: skirtEst(v), ease };
  out.skirts.push({ input: { vals: v, sil, hem: 'floor', estimate: skirtEst(v), ease }, result: X.draftSkirt(o, {}) });
}
for (const v of bodies) {
  const ease = [{ part: 'Bust', ease: 2.5 }, { part: 'Waist', ease: 1.5 }, { part: 'Hips', ease: 6 }];
  const o = { vals: v, design3d: { gown: { sil: 'aline' }, hem: 'floor' }, gownMeasEst: bodiceMeas(v), ease };
  out.bodices.push({ input: { vals: v, estimate: bodiceMeas(v), ease }, result: X.draftBodice(o, {}) });
}
// Impossible input and the source order (tape > typed > estimate), each as the prototype answers it.
const v = bodies[2];
const ease = [{ part: 'Waist', ease: 1.5 }, { part: 'Hips', ease: 6 }];
out.errors.push({ case: 'no waist to hip', input: { vals: v, sil: 'aline', hem: 'floor', estimate: { waistFloor: 98 }, ease }, result: X.draftSkirt({ vals: v, design3d: { gown: { sil: 'aline' }, hem: 'floor' }, gownMeasEst: { waistFloor: 98 }, ease }, {}) });
out.errors.push({ case: 'no length', input: { vals: v, sil: 'aline', hem: 'floor', estimate: { waistHip: 23 }, ease }, result: X.draftSkirt({ vals: v, design3d: { gown: { sil: 'aline' }, hem: 'floor' }, gownMeasEst: { waistHip: 23 }, ease }, {}) });
out.errors.push({ case: 'bodice missing', input: { vals: v, estimate: { napeWaist: 41 }, ease }, result: X.draftBodice({ vals: v, gownMeasEst: { napeWaist: 41 }, ease }, {}) });
out.sources = {
  input: { vals: v, sil: 'sheath', hem: 'floor', typed: { waistHip: 22 }, estimate: skirtEst(v), tape: { waistFloor: 100 }, ease },
  result: X.draftSkirt({ vals: v, design3d: { v: 2, gown: { sil: 'sheath' }, hem: 'floor' }, gownMeas: { waistHip: 22 }, gownMeasEst: skirtEst(v), ease }, { waistFloor: 100 }),
};
out.knee = {
  input: { vals: v, sil: 'aline', hem: 'knee', estimate: { waistHip: 23, waistFloor: 98, waistHem: 60 }, ease },
  result: X.draftSkirt({ vals: v, design3d: { v: 2, gown: { sil: 'aline' }, hem: 'knee' }, gownMeasEst: { waistHip: 23, waistFloor: 98, waistHem: 60 }, ease }, {}),
};
// v197: an A-line saved before the change (no design version) opens as Fit and flare, blocks included.
out.oldAline = {
  input: { vals: v, sil: 'aline', designV: 1, hem: 'floor', estimate: skirtEst(v), ease: [{ part: 'Waist', ease: 1.5 }, { part: 'Hips', ease: 6 }] },
  result: X.draftSkirt({ vals: v, design3d: { gown: { sil: 'aline' }, hem: 'floor' }, gownMeasEst: skirtEst(v), ease: [{ part: 'Waist', ease: 1.5 }, { part: 'Hips', ease: 6 }] }, {}),
};
out.draft = X.DRAFT;
process.stdout.write(JSON.stringify(out));
