/**
 * 👗 gown/quote — what a design needs, held to prototype v206's own quote lines (`v206-quote.fixture.json`, captured from
 * the prototype's `quoteLines` for five gowns). The gown is built here as the stage builds it, measured
 * (`gownMeasure`), and turned into the contract's quantities (`gownQuantitiesOf`); each line the prototype prints is
 * compared with the key the shop's quote reads. Quantities only: nothing here is a price.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as THREE from 'three';
import { sanitizeGownQuantities, startingGownConfig, type GownConfig, type GownLook, type GownQuantities } from '../../gown-config';
import { parseGownBody } from '../body/load';
import type { GownRig } from '../body/rig';
import { solveGownBody } from '../body/solve';
import { gownApplyLook } from '../compat';
import { gownClothFeel, gownFabricType } from '../fabric/types';
import { buildDress, emptyDress } from '../dress/build';
import { emptyGownPose, gownClearArms, gownPoseBody } from '../motion/poses';
import { buildCape, emptyCape } from '../dress/cape';
import { restingCloth, writeDress } from '../dress/cloth';
import { buildEnvelope, emptyEnvelope } from '../dress/table';
import { buildGownSleeve, emptySleeve } from '../parts/sleeves';
import { buildGownOverlay } from '../parts/overlay';
import { buildGownLace } from '../parts/lace';
import { buildGownBeads } from '../parts/beads';
import { gownMeasure } from './measure';
import { gownQuantitiesOf } from './quantities';

type Line = { key: string; label: string; qty: number; unit: string };
type Row = { name: string; look: Partial<GownLook>; hem: string; heel: number; gown: Record<string, unknown>; M: Line[]; laceN: number; beadSets: [string, number][] };
const REF = JSON.parse(readFileSync(join(__dirname, 'v206-quote.fixture.json'), 'utf8')) as { rows: Row[] };
const GLB = join(__dirname, '../../../public/gown/female.glb');
let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) { const b = readFileSync(GLB); rig = parseGownBody(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return rig;
};
const arr = (g: THREE.BufferGeometry) => (g.attributes.position as THREE.BufferAttribute).array as Float32Array;

// As captured: an A-line with no veil, cape, sleeves, beads or lace, then the look.
// The prototype keeps a few choices from one gown to the next (a look does not set them): read them from the gown it priced.
const CARRIED = ['lining', 'waistStay', 'horsehair', 'petti', 'skirtLayers', 'boning', 'closure', 'pieces', 'fabric'] as const;
const designOf = (r: Row): GownConfig => {
  const g = { ...gownApplyLook(startingGownConfig(), { slits: [], cuts: [], trims: [], veil: 'none', sleeve: 'none', cape: 'none', sil: 'aline', bead: 'none', lace: 'none', ...r.look } as Partial<GownLook>), hem: 'floor', hemCm: 0, heel: r.heel } as GownConfig;
  for (const k of CARRIED) if (r.gown[k] !== undefined) (g as Record<string, unknown>)[k] = r.gown[k];
  return g;
};

/** The stage's order for what the quote measures: the gown, the sleeves, the overlay, the cape, the lace and the beads. */
function quantitiesOf(B: GownRig, g: GownConfig): GownQuantities {
  const T = emptyEnvelope(), D = emptyDress(), C = restingCloth(), K = emptyCape(), feel = gownClothFeel(gownFabricType(g.fabric).props, g.skirtLayers);
  D.hold = feel.hold; D.foldK = feel.foldK;
  solveGownBody(B);
  // Posed as the stage poses her, in her shoes: the skirt is cut to the floor she stands on.
  const S = emptyGownPose(B);
  S.pose = 'a'; S.t = 1; S.lastQ = new Array(B.nb).fill(null);
  gownPoseBody(B, S, g.heel);
  buildEnvelope(B, T);
  const floorY = S.floorY;
  buildDress(B, T, D, g, floorY, S.floorStand ?? floorY, { standing: true });
  if (gownClearArms(B, S, T, g.heel)) { buildEnvelope(B, T); buildDress(B, T, D, g, floorY, S.floorStand ?? floorY, { standing: true }); }
  writeDress(D, T, C, { pleat: g.pleat, n: g.pleatN, amp: g.pleatCm / 100 / B.P.S });
  const sl: (THREE.BufferGeometry | null)[] = [], worn: Partial<Record<'L' | 'R', Float32Array>> = {};
  for (const sd of ['L', 'R'] as const) { const geo = emptySleeve(); if (buildGownSleeve(B, T, sd, g, geo)) { sl.push(geo); worn[sd] = arr(geo); } else sl.push(null); }
  const ov = buildGownOverlay(B, T, D, g);
  const hung = buildCape(B, T, D, C, K, g, { floorY, pose: 'a', sleeves: worn });
  const lace = g.lace !== 'none' ? buildGownLace(B, T, D, g) : null;
  const beads = buildGownBeads(B, D, T, g, { phone: false }).sets;
  const m = gownMeasure(B, T, D, g, {
    cape: hung ? K : null, overlay: ov, flutter: sl, sleeves: sl.map((x) => (x ? { pos: arr(x), index: x.index!.array } : null)),
    lace, beads, straps: null, flowers: null, illu: null,
  });
  return gownQuantitiesOf(g, m);
}
/** The prototype's line for a key; several lines with one key add up (two zips, two satin lines). */
const lineSum = (r: Row, key: string, label?: RegExp) => r.M.filter((l) => l.key === key && (!label || label.test(l.label))).reduce((s, l) => s + l.qty, 0);

test('the quantities match the prototype\'s quote lines, gown by gown', async () => {
  const B = await body();
  for (const r of REF.rows) {
    const g = designOf(r), q = quantitiesOf(B, g), M = q.materials, near = (got: number, want: number, tol: number, what: string) => assert.ok(Math.abs(got - want) <= tol, `${r.name}: ${what} ${got} vs the prototype's ${want}`);
    // The outer: the prototype's first line, plus any other line in the gown's own fabric (puff sleeves).
    near(M.outerM, lineSum(r, `fab_${g.fabric}`, /outer|sleeves/), 0.15, 'outer metres');
    near(M.liningM, lineSum(r, `lin_${g.lining}`), 0.15, 'lining');
    near(M.netM + M.veilM, lineSum(r, 'net'), 0.01, 'petticoat and veil tulle');
    near(M.boningM, lineSum(r, 'boning'), 0.05, 'boning');
    assert.equal(M.zippers, lineSum(r, 'zipper'), `${r.name}: zippers`);
    near(M.buttons, lineSum(r, 'button'), 1, 'covered buttons');
    near(M.eyelets, lineSum(r, 'eyelet'), 2, 'eyelets');
    assert.equal(M.cordM, lineSum(r, 'cord'), `${r.name}: lacing cord`);
    assert.equal(M.waistStays, lineSum(r, 'waiststay'), `${r.name}: waist stay`);
    near(M.horsehairM, lineSum(r, 'horsehair'), 0.1, 'horsehair braid');
    near(M.laceYardM, lineSum(r, 'lace_yard'), 0.05, 'lace by the yard');
    near(M.laceMotifs, lineSum(r, 'lace_motif'), Math.max(2, lineSum(r, 'lace_motif') * 0.05), 'lace motifs');
    near(M.beads.crystal / 100, lineSum(r, 'bead_crystal'), Math.max(0.1, lineSum(r, 'bead_crystal') * 0.05), 'crystals (100s)');
    near(M.pipingM, lineSum(r, 'piping'), 0.05, 'piping');
    near(M.ruffleM, lineSum(r, `fab_${g.fabric}`, /ruffle/), 0.03, 'ruffle fabric');
    near(M.sleeveChiffonM + M.overlayM, lineSum(r, 'fab_chiffon'), 0.15, 'chiffon (flutter sleeves and overlay)');
    near(M.capeM, lineSum(r, 'fab_tulle', /cape/), 0.15, 'the cape\'s own cloth');
    assert.equal(q.labour.flutter, lineSum(r, 'flutter'), `${r.name}: flutter sleeves to make`);
    assert.equal(q.labour.overlay, lineSum(r, 'overlay'), `${r.name}: the overlay to make`);
    assert.equal(q.labour.cape !== 'none', lineSum(r, `cape_${g.cape}`) > 0, `${r.name}: the cape to make`);
    // Everything the shop is sent passes its own check.
    assert.ok(sanitizeGownQuantities(q).ok, `${r.name}: the quantities pass the contract's check`);
  }
});
