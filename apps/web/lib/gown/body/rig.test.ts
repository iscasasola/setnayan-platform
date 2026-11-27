/**
 * 👗 gown/body — the faceless mannequin, solved headless on three 0.184, held to the prototype's own numbers (v188).
 * The reference (`v188-sweep.fixture.json`) is the prototype itself at v188 (the owner's body corrections), run in headless Chromium on three 0.160: the v164 sweep of
 * 10 bodies × bust Higher / Average / Lower, solved in turn as the prototype's tests/sweep.js does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { gownEstimateKg, gownSetNumber } from '../body-rules';
import { estimateGownMeasures } from './estimate';
import { parseGownBody } from './load';
import type { GownRig } from './rig';
import { solveBody, solveGownBody } from './solve';

type Row = {
  in: { height: number; bust: number; underbust: number; waist: number; hips: number; bustT: number };
  got: { bust: number; waist: number; hips: number; underbust: number; neck: number };
  kg: number;
  weight: number;
  shoulders: number;
  est: Record<string, number>;
};
const REF = JSON.parse(readFileSync(join(__dirname, 'v188-sweep.fixture.json'), 'utf8')) as { rows: Row[] };
const GLB = join(__dirname, '../../../public/gown/female.glb');

let rig: Promise<GownRig> | null = null;
const body = () => {
  if (!rig) {
    const buf = readFileSync(GLB);
    rig = parseGownBody(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
  }
  return rig;
};

test('the mannequin loads: one skinned body, women only, credited CC0 in its own file', async () => {
  const bytes = readFileSync(GLB);
  const json = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString('utf8')) as { asset: { copyright: string }; meshes: { name: string }[] };
  assert.match(json.asset.copyright, /Innerscene.*CC0/);
  assert.deepEqual(json.meshes.map((m) => m.name), ['base_female_body'], 'one mesh: no stray helper, no second body');
  const B = await body();
  assert.equal(B.n, 10418);
  assert.ok(B.breastV.length > 0 && B.headV.length > 0);
});

test('v186 sweep: 10 bodies × 3 bust positions fit her tape within 0.1 cm, and match v186 within 0.1 cm', async () => {
  const B = await body();
  for (const r of REF.rows) {
    const { height, bust, underbust, waist, hips, bustT } = r.in;
    Object.assign(B.vals, { height, bust, underbust, waist, hips });
    B.fine.bustT = bustT;
    const g = solveGownBody(B);
    const at = `${height}/${bust}/${underbust}/${waist}/${hips} bust ${bustT}`;
    for (const k of ['bust', 'underbust', 'waist', 'hips'] as const) {
      assert.ok(Math.abs(g[k] - r.in[k]) <= 0.1, `${at}: ${k} reads ${g[k].toFixed(2)}, tape ${r.in[k]}`);
      assert.ok(Math.abs(g[k] - r.got[k]) <= 0.1, `${at}: ${k} ${g[k].toFixed(2)} vs v186 ${r.got[k]}`);
    }
    // v176: the neck follows her weight.
    assert.ok(Math.abs(g.neck! - r.got.neck) <= 0.1, `${at}: neck ${g.neck!.toFixed(2)} vs v186 ${r.got.neck}`);
    // v169/v183: the body weighs her estimated weight (v186's own reading within 0.5 kg).
    assert.ok(Math.abs(B.kg - r.kg) <= 0.5, `${at}: ${B.kg} kg vs v186 ${r.kg}`);
    assert.ok(Math.abs(B.kg - gownEstimateKg(B.vals)) <= 0.5, `${at}: the body weighs the estimate`);
    assert.equal(B.vals.shoulders, r.shoulders, `${at}: shoulders follow her height and ribcage`);
    // The gown's own measurements, estimated on the body (half-centimetre readings; one step of rounding allowed).
    const e = estimateGownMeasures(B);
    for (const [k, want] of Object.entries(r.est)) {
      const got = e[k as keyof typeof e];
      assert.ok(got !== undefined && Math.abs(got - want) <= 0.5, `${at}: ${k} ${got} vs v186 ${want}`);
    }
  }
});

test('the bust grows without the ribs (v165/v184/v185): bust 129 on underbust 72 leaves the ribcage unchanged', async () => {
  const B = await body();
  Object.assign(B.vals, { height: 155, bust: 84, underbust: 72, waist: 68, hips: 90 });
  B.fine.bustT = 0;
  solveGownBody(B);
  // v188 (owner's design review): the limbs were about 20 % too thick; the default body now solves at a build of ~0.99.
  assert.ok(Math.abs(B.P.f - 0.985) <= 0.02, `the default build is ${B.P.f.toFixed(3)} (v188: 0.985)`);
  const ribs = { sUb: B.P.sUb, cR: B.P.cR };
  // She asks for 129: the measurement step stops the bust at underbust + 28 (v185), and the ribs keep their size.
  const set = gownSetNumber(B.vals, [], 'bust', 129);
  assert.equal(set.vals.bust, 100);
  Object.assign(B.vals, set.vals);
  solveGownBody(B);
  assert.ok(Math.abs(B.got.bust - 100) <= 0.1, `the cup reaches 100 (${B.got.bust.toFixed(2)})`);
  assert.ok(Math.abs(B.P.sUb - ribs.sUb) < 1e-3, `the ribcage scale is unchanged (sUb ${B.P.sUb.toFixed(3)} vs ${ribs.sUb.toFixed(3)})`);
  assert.equal(B.P.cR, ribs.cR, 'the upper ribcage is unchanged');
  assert.ok(Math.abs(B.got.underbust - 72) <= 0.1);
  // Past the limit, straight into the engine (as v186 does too): the ribs may ease in, never grow.
  B.vals.bust = 129;
  solveGownBody(B);
  assert.ok(B.P.sUb <= ribs.sUb + 1e-9 && B.P.cR <= ribs.cR + 1e-9, 'the ribs never grow for the bust');
});

test('a solve takes under 100 ms (one pass of the girth fit, after the first build)', async () => {
  const B = await body();
  const times: number[] = [];
  for (const r of REF.rows.filter((_, i) => i % 3 === 1)) {
    Object.assign(B.vals, { height: r.in.height, bust: r.in.bust, underbust: r.in.underbust, waist: r.in.waist, hips: r.in.hips });
    const t = performance.now();
    solveBody(B);
    times.push(performance.now() - t);
  }
  const worst = Math.max(...times);
  assert.ok(worst < 100, `slowest solve ${worst.toFixed(0)} ms (${times.map((x) => x.toFixed(0)).join(', ')})`);
});

test('the body engine is plain math: no DOM, no material, no shadows, no lights', () => {
  const dir = __dirname;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.ts') && !x.endsWith('.test.ts'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    assert.ok(!/\bdocument\.|\bwindow\.|localStorage|castShadow|receiveShadow|shadowMap|Light\(/.test(src), `${f} stays plain math`);
    assert.ok(!/barong|camisa|trouser|male\.json/i.test(src), `${f}: women only`);
  }
});
