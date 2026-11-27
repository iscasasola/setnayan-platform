/**
 * 👗 gown/body-rules + gown/ease — golden numbers from the prototype's PROGRESS.md (corpus
 * prototypes/gown_maker_2026-11-27/PROGRESS.md): v182 ideal by height, v170 bra sizes, v169 limits, v185 cup limit,
 * v171 heel and bust-position snaps, and the v186 ease rows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startingGownBody, startingGownConfig, type GownBodyKey, type GownBodyVals } from '../gown-config';
import {
  gownBraNote,
  gownBraOf,
  gownBraSize,
  gownBustPosition,
  gownDoubleCheck,
  gownEstimateKg,
  gownEstimateShoulders,
  gownFatPercent,
  gownIdeal,
  gownInches,
  gownLimit,
  gownSetNumber,
  gownShapedVals,
  gownSnapBustT,
  gownSnapHeel,
} from './body-rules';
import { gownEaseRows, gownEaseWhy } from './ease';

const base = (): GownBodyVals => ({ ...startingGownBody().vals });
const near = (got: number, want: number, tol: number, why: string) => assert.ok(Math.abs(got - want) <= tol, `${why}: got ${got}, want ${want} ± ${tol}`);

test('v182 ideal by height: 140 / 155 / 170 / 185 cm (bust / underbust / waist / hips)', () => {
  assert.deepEqual(gownIdeal(140), { bust: 78, underbust: 66.5, waist: 63, hips: 83.5 });
  assert.deepEqual(gownIdeal(155), { bust: 84, underbust: 72, waist: 68, hips: 90 });
  assert.deepEqual(gownIdeal(170), { bust: 90, underbust: 77, waist: 73, hips: 96.5 });
  assert.deepEqual(gownIdeal(185), { bust: 96, underbust: 82, waist: 77.5, hips: 103 });
});

test('v182 weights at the ideal figure keep her BMI about 21.5 (140 → 42.1, 155 → 51.6, 185 → 73.1 kg)', () => {
  const at = (h: number) => ({ height: h, ...gownIdeal(h) });
  near(gownEstimateKg(at(140)), 42.1, 0.06, '140 cm');
  near(gownEstimateKg(at(155)), 51.6, 0.06, '155 cm');
  near(gownEstimateKg(at(185)), 73.1, 0.06, '185 cm');
  // PROGRESS v182 prints 62.4 kg at 170 cm. That printout is the body's weight after the fit; the equation gives 62.05.
  near(gownEstimateKg(at(170)), 62.4, 0.5, '170 cm');
  for (const h of [140, 155, 170, 185]) {
    const kg = gownEstimateKg(at(h));
    near(kg / (h / 100) ** 2, 21.5, 0.2, `BMI at ${h} cm`);
  }
});

test('height first (v182): she sets bust 96 at 185 cm, then 160 cm → the bust stays 96, the rest follows (waist 69.5, hips 92)', () => {
  let s = { vals: base(), given: [] as GownBodyKey[] };
  s = gownSetNumber(s.vals, s.given, 'height', 185);
  assert.deepEqual([s.vals.bust, s.vals.underbust, s.vals.waist, s.vals.hips], [96, 82, 77.5, 103]);
  s = gownSetNumber(s.vals, s.given, 'bust', 96);
  s = gownSetNumber(s.vals, s.given, 'height', 160);
  assert.equal(s.vals.bust, 96, 'a number she set stays hers');
  assert.equal(s.vals.waist, 69.5);
  assert.equal(s.vals.hips, 92);
  assert.deepEqual(s.given, ['height', 'bust']);
});

test('v169 limits follow height: weight BMI 10–62 (24–149 kg at 155 cm); bust 45–105 %, waist 34–115 %, hips 48–120 %', () => {
  const v = base();
  assert.deepEqual(gownLimit(v, 'weight'), [24, 149]);
  assert.deepEqual(gownLimit(v, 'waist'), [52.5, 150]);
  assert.deepEqual(gownLimit(v, 'hips'), [74.5, 170]);
  assert.deepEqual(gownLimit(v, 'shoulders'), [32.5, 43.5]);
  assert.deepEqual(gownLimit({ ...v, height: 140 }, 'bust'), [65, 100], 'the absolute floor, and underbust + 28 on top');
  assert.deepEqual(gownLimit({ ...v, height: 224, underbust: 130 }, 'bust'), [101, 158], 'shares of a tall height inside the absolute range');
  // Changing her height brings every other number inside its new limits.
  const short = gownSetNumber({ ...v, waist: 140, hips: 160 }, ['waist', 'hips'], 'height', 140);
  assert.ok(short.vals.waist <= 140 * 1.15 && short.vals.hips <= 140 * 1.2);
});

test('v185 cup limit: bust 129 on underbust 72 stops at 100, and the ribs (underbust) never grow for it', () => {
  const s = gownSetNumber(base(), [], 'bust', 129);
  assert.equal(s.vals.bust, 100);
  assert.equal(s.vals.underbust, 72, 'the ribcage is unchanged');
  // Her underbust first gives the room.
  const ub = gownSetNumber(base(), [], 'underbust', 90);
  const big = gownSetNumber(ub.vals, ub.given, 'bust', 118);
  assert.equal(big.vals.bust, 118);
  assert.deepEqual(gownLimit(big.vals, 'underbust'), [90, 114]);
  assert.match(gownDoubleCheck(gownSetNumber(base(), [], 'bust', 100).vals, []), /as full as a cup can be/);
});

test('v170 bra sizes: the four printed pairs, and the band and cup boundaries', () => {
  const s = (ub: number, b: number) => {
    const z = gownBraSize(ub, b);
    return z && `${z.eu} · ${z.us} · ${z.uk}`;
  };
  // PROGRESS v170.
  assert.equal(s(72, 84), '70A · 32A · 32A');
  assert.equal(s(76, 92), '75C · 34C · 34C');
  assert.equal(s(88, 110), '90F · 40DDD · 40E');
  assert.equal(s(112, 140), '110I · 48I · 48G');
  // The chart's own boundaries (v170: AA 10–12, A 12–14 …; EU E = US DD = UK DD).
  assert.equal(s(72, 82), '70AA · 32AA · 32AA', 'exactly 10 cm over: AA');
  assert.equal(s(72, 90), '70D · 32D · 32D');
  assert.equal(s(72, 92), '70E · 32DD · 32DD');
  assert.equal(s(73, 87), '75B · 34B · 34B', 'the band rounds to the nearest 5 cm');
  assert.equal(gownBraSize(72, 80)?.small, true, 'under 10 cm over: a very small cup');
  assert.equal(gownBraSize(72, 100)?.big, false, 'the cup limit stays inside store sizes');
  assert.equal(gownBraSize(0, 84), null);
  assert.equal(gownBraSize(84, 84), null);
  // "about" until she gives her underbust.
  assert.match(gownBraNote(base(), []), /^Bra size for a full, smooth cup: about 70A /);
  assert.deepEqual(gownBraOf(base(), ['underbust']), { eu: '70A', us: '32A', uk: '32A', exact: true });
});

test('v171 snaps: heels to Flat, 4, 7, 10, 12 within 0.75 cm; the bust position to its three within 0.12', () => {
  assert.equal(gownSnapHeel(6.4), 7);
  assert.equal(gownSnapHeel(9.5), 10);
  assert.equal(gownSnapHeel(11.5), 12);
  assert.equal(gownSnapHeel(5), 5);
  assert.equal(gownSnapHeel(14), 14);
  assert.equal(gownSnapHeel(0.5), 0);
  assert.equal(gownSnapBustT(-0.9), -1);
  assert.equal(gownSnapBustT(0.1), 0);
  assert.equal(gownSnapBustT(0.5), 0.5);
  assert.equal(gownBustPosition(gownSnapBustT(0.95)), 'low');
  assert.equal(gownBustPosition(0.5), 'custom');
  assert.equal(gownInches(7), '2¾', 'v171 reads "7 cm · 2¾ in"');
  assert.equal(gownInches(0.5), '¼');
});

test('v189 shoulders follow height (24.5 %) and ribcage; v173 fat share; v186 shapewear takes its share', () => {
  const v = base();
  assert.equal(gownEstimateShoulders(v, false), 38, 'v189: 24.5 % of 155 cm');
  assert.equal(gownEstimateShoulders({ ...v, bust: 120, underbust: 96 }, false), 43, 'v189: 120/96 → 43 cm (+0.2 per cm of underbust over 72)');
  assert.equal(gownEstimateShoulders({ ...v, bust: 140, underbust: 112 }, false), 43.5, '140/112 → the 28 % cap, 43.5 cm');
  assert.equal(gownEstimateShoulders(v, true), 39.5, 'athletic: 1.5 cm broader');
  near(gownFatPercent(v, false), 76 - (20 * 155) / 68, 1e-9, 'Relative Fat Mass');
  near(gownFatPercent(v, true), 76 - (20 * 155) / 68 - 10, 1e-9, 'athletic: 10 points less');
  assert.equal(gownShapedVals(v, 'none'), v);
  const firm = gownShapedVals(v, 'firm');
  near(firm.waist, 68 - 68 * 0.05, 1e-9, 'firm shapewear takes 5 % off the waist');
  assert.ok(firm.hips >= firm.waist + 2 && firm.bust >= firm.underbust + 4);
  assert.equal(gownShapedVals({ ...v, waist: 140 }, 'corset').waist, 134, 'at most 6 cm off the waist');
});

test('the double-check note: soft, for unusual numbers only, never for the default body', () => {
  assert.equal(gownDoubleCheck(base(), []), '');
  assert.match(gownDoubleCheck({ ...base(), waist: 130, bust: 100, hips: 100 }, []), /waist is much bigger/);
  assert.match(gownDoubleCheck({ ...base(), weight: 30 }, ['weight']), /A weight of 30 kg at 155 cm is unusual/);
  assert.equal(gownDoubleCheck({ ...base(), weight: 30 }, []), '', 'an estimated weight is not hers to double-check');
  assert.match(gownDoubleCheck(base(), [], { reached: { bust: 80 } }), /can't quite reach a bust of 84 cm/);
});

test('v186 ease rows: woven unboned, boned strapless, stretch and corset', () => {
  const v = base();
  const s = startingGownConfig();
  // The start is a sweetheart (strapless) A-line in satin: boned ease, the skirt flares free, the underbust row shows.
  assert.deepEqual(gownEaseRows(v, s), [
    { part: 'Bust', body: 84, ease: 1, gown: 85 },
    { part: 'Waist', body: 68, ease: 0.5, gown: 68.5 },
    { part: 'Hips', body: 90, ease: 6, gown: 'skirt flares: free' },
    { part: 'Under bust', body: 72, ease: 0.5, gown: 72.5 },
  ]);
  assert.equal(gownEaseWhy(s), 'Boned or strapless: close to the body so it stays up.');
  const woven = { ...s, neck: 'bateau' as const, sil: 'sheath' as const, sleeve: 'long' as const, boning: 'soft' as const };
  assert.deepEqual(
    gownEaseRows(v, woven, { upperArm: 27, wrist: 15 }).map((r) => [r.part, r.ease, r.gown]),
    [['Bust', 2.5, 86.5], ['Waist', 1.5, 69.5], ['Hips', 3, 93], ['Upper arm', 4, 31], ['Wrist', 3, 18]],
  );
  assert.equal(gownEaseWhy(woven), 'Woven, unboned: room to breathe, sit and dance.');
  const stretch = { ...woven, fabric: 'stretch_crepe_jersey', sil: 'mermaid' as const };
  assert.deepEqual(gownEaseRows(v, stretch, { knee: 36 }).map((r) => r.ease), [-2, -2, -1, 4]);
  const corset = { ...s, boning: 'corset' as const };
  assert.deepEqual(gownEaseRows(v, corset).map((r) => r.ease), [0, -1, 6, -1]);
});

test('the body rules are pure: no three.js, no DOM, no money', () => {
  for (const f of ['body-rules.ts', 'ease.ts']) {
    const src = readFileSync(join(__dirname, f), 'utf8');
    assert.ok(!/from ['"]three|document\.|window\.|localStorage/.test(src), `${f} is pure`);
    assert.ok(!/₱|centavo|price|cost/i.test(src), `${f} holds no money`);
  }
});
