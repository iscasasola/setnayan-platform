// Regenerate: node apps/web/scripts/gown-pattern-golden.mjs <specs corpus>/prototypes/gown_maker_2026-11-27/gown_maker_v205.html > apps/web/lib/gown-pattern/prototype-v205.golden.json
// Runs the prototype's OWN draftSkirt / draftBodice (gown_maker_v205.html) on fixed inputs and prints their outputs as
// JSON, so the TypeScript port can be held to them. Input file is passed as argv[2]; nothing from it is imported.
import { readFileSync } from 'node:fs';
const html = readFileSync(process.argv[2], 'utf8');
const lines = html.split('\n');
const start = lines.findIndex((l) => l.startsWith('function draftSkirt('));
// v205: as far as the export (patCutList, patBuild), which ends where the print file begins.
const end = lines.findIndex((l) => l.startsWith('function patPrintDoc(')) > 0 ? lines.findIndex((l) => l.startsWith('function patPrintDoc(')) : lines.findIndex((l) => l.startsWith('function blockSVG('));
const gStart = lines.findIndex((l) => l.startsWith('const GMEAS = ['));
const gEnd = lines.findIndex((l, i) => i > gStart && l.startsWith('];'));
// v197: the silhouette table (`SIL`: A-line and saya ease 10, the skim rule) is read by draftSkirt.
const silLine = lines.find((l) => l.startsWith('const SIL = {'));
if (start < 0 || end < 0 || gStart < 0 || gEnd < 0 || !silLine) throw new Error('prototype functions not found');
const src = [
  'const clamp = (x, a, b) => Math.max(a, Math.min(b, x));',
  "const esc = (t) => String(t).replace(/[&<>\"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', \"'\": '&#39;' })[c]);",
  'const quote = { prices: {} }, SIL_NAME = {}, DRAFT_SHOW = null;',
  'const isMan = () => false, STRAPLESS = {}, gown = { neck: "sweetheart", boning: "soft", sleeve: "none", sil: "aline", slits: [], train: "none" }, dress = { hem: "floor" };',
  silLine,
  lines.slice(gStart, gEnd + 1).join('\n'),
  lines.slice(start, end).join('\n'),
  'return { draftSkirt, draftBodice, DRAFT, patGeom: typeof patGeom === "function" ? patGeom : null, SA_DEF: typeof SA_DEF === "object" ? SA_DEF : null, patCutList: typeof patCutList === "function" ? patCutList : null, patBuild: typeof patBuild === "function" ? patBuild : null, quote };',
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
// v205: the cut line, the allowance per edge and the notches (`patGeom`) on every skirt and bodice above, at the usual
// allowances and at an unusual set, and as a net pattern. Rounded to the micron.
if (X.patGeom) {
  const q = (a) => (Array.isArray(a) ? a.map(q) : typeof a === 'number' ? Math.round(a * 1000) / 1000 : a);
  const odd = { seam: 1, hem: 5, zip: 2.5, neck: 0.6 };
  const geoms = (res) => (res.pieces || []).map((p) => ({ usual: q((({ C, N, D }) => ({ C, N, D }))(X.patGeom(p, X.SA_DEF, false))), odd: q((({ C, N, D }) => ({ C, N, D }))(X.patGeom(p, odd, false))), net: q((({ C, N, D }) => ({ C, N, D }))(X.patGeom(p, X.SA_DEF, true))) }));
  out.saDefault = X.SA_DEF;
  out.saOdd = odd;
  out.geom = { skirts: out.skirts.map((s) => geoms(s.result)), bodices: out.bodices.map((b) => geoms(b.result)) };
  // Stress: the largest allowances on every bodice (tight armholes and necklines make the moved edges loop), and a
  // narrow gore whose point is needle-sharp (it must be squared off, not thrown out).
  const most = { seam: 3, hem: 8, zip: 4, neck: 2 };
  out.saMost = most;
  out.geomMost = out.bodices.map((b) => (b.result.pieces || []).map((p) => q((({ C, N, D }) => ({ C, N, D }))(X.patGeom(p, most, false)))));
  // a 29° point: its mitre lands at about 4 × the allowance (kept: under the 6 × limit; a tighter limit would square it)
  const slot = [[120, 0], ...Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (1 + 0.15 + (0.7 * i) / 8); return [150 + 25 * Math.cos(a), 25 - 25 * Math.sin(a) + 20]; }), [180, 0]];
  out.gore = { name: 'Gore', cut: 'Cut 2', outline: [[0, 0], [260, 0], [130, 500]], edges: ['seam', 'seam', 'seam'], darts: [], marks: [], points: [], grain: [[130, 50], [130, 400]] };
  // a square with a round bay cut into its top edge, tighter than the 3 cm allowance: the moved edges cross in a loop,
  // and the loop is cut off
  out.scoop = { name: 'Scoop', cut: 'Cut 2', outline: [[0, 0], ...slot, [300, 0], [300, 300], [0, 300]], edges: Array(slot.length + 4).fill('seam'), darts: [], marks: [], points: [], grain: [[150, 60], [150, 260]] };
  out.scoopGeom = q((({ C, N, D }) => ({ C, N, D }))(X.patGeom(out.scoop, most, false)));
  out.goreGeom = q((({ C, N, D }) => ({ C, N, D }))(X.patGeom(out.gore, most, false)));
}
// v205: the cutting list and the export pages on a few whole orders (bodice + skirt), each as the prototype builds them.
if (X.patCutList && X.patBuild) {
  const vb = bodies[2], meas = { ...skirtEst(vb), ...bodiceMeas(vb) };
  const easeAll = [{ part: 'Bust', ease: 2.5 }, { part: 'Waist', ease: 1.5 }, { part: 'Hips', ease: 6 }];
  const orderOf = (sil, gown, cut, extra = {}) => ({ client: 'Ana Reyes', vals: vb, design3d: { v: 2, gown: { sil, ...gown }, hem: 'floor' }, gownMeasEst: meas, ease: easeAll, cut, ...extra });
  const cases = [
    { name: 'plain A-line, no lining, quote metres', o: orderOf('aline', { petti: 'none', train: 'none' }, { outerName: 'Duchess satin', lining: 'none', layers: [], accent: null, lace: null, incl: [], metres: { outer: 4.2, lining: 0, tulle: 0 } }) },
    { name: 'ball gown, satin lining, two tulle layers, a train, a cape in the gown fabric', o: orderOf('ball', { petti: 'soft', train: 'chapel', skirtLayers: 2 }, { outerName: 'Mikado', lining: 'satin', layers: ['soft', 'full'], accent: null, lace: null, incl: ['the cape'], metres: { outer: 14, lining: 11.9, tulle: 6 } }) },
    { name: 'sheath, accent sleeves and lace, sent before the quote saved metres', o: orderOf('sheath', { petti: 'none', train: 'none' }, { outerName: null, lining: 'silk', layers: [], accent: 'sleeves', lace: null, incl: [], metres: null }) },
    { name: 'mermaid, net pattern, odd allowances', o: orderOf('mermaid', { petti: 'none', train: 'none' }, { outerName: 'Crepe', lining: 'none', layers: [], accent: null, lace: 'sleeves', incl: ['the overlay'], metres: { outer: 3.1, lining: 0, tulle: 0 } }, { netPattern: true }) },
    { name: 'a very long ball gown: the circle is too big to tape, so it comes as a measured diagram', o: { ...orderOf('ball', { petti: 'none', train: 'none' }, { outerName: 'Mikado', lining: 'none', layers: [], accent: null, lace: null, incl: [], metres: { outer: 16, lining: 0, tulle: 0 } }), gownMeasEst: { ...meas, waistFloor: 135 } } },
    { name: 'fit and flare, a set of its own', o: orderOf('fitflare', { petti: 'none', train: 'none' }, { outerName: 'Crepe', lining: 'cotton', layers: [], accent: null, lace: null, incl: [], metres: { outer: 3.6, lining: 3.06, tulle: 0 } }, { seamAllow: { seam: 1, hem: 5, zip: 2.5, neck: 0.6 } }) },
  ];
  out.cutCases = cases.map(({ name, o }) => {
    const C = X.patCutList(o, {});
    const B = { a4: X.patBuild(o, {}, 'a4'), letter: X.patBuild(o, {}, 'letter') };
    const pages = (b) => ({ total: b.total, tiles: b.tiles, diagrams: b.diagrams, perPiece: b.perPiece, kinds: b.pages.map((p) => p.kind), labels: b.pages.map((p) => p.label),
      // the numbers drawn on every page that a ruler can check: the test square, and each page's own size
      squares: b.pages.map((p) => (p.svg.match(/class="pp-test" x="([\d.]+)" y="([\d.]+)" width="50" height="50"/) || []).slice(1).map(Number)),
      heads: b.pages.map((p) => ((p.svg.match(/class="pp-no">([^<]*)</) || [])[1] || '')) });
    return { name, order: { est: o.gownMeasEst, vals: o.vals, sil: o.design3d.gown.sil, gown: o.design3d.gown, cut: o.cut, netPattern: !!o.netPattern, seamAllow: o.seamAllow || null, client: o.client }, cutList: C, pages: { a4: pages(B.a4), letter: pages(B.letter) } };
  });
}
process.stdout.write(JSON.stringify(out));
