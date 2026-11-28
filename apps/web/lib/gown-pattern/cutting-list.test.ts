/**
 * 👗 THE CUTTING LIST (plan step B11): every piece, how many, fold or pair, which fabric, its size with the allowance,
 * and the metres by the prototype's own rule — so it can sit beside the bride's quote. No price on it.
 *
 * Run: cd apps/web && npx tsx --test lib/gown-pattern/cutting-list.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startingGownBody, startingGownConfig, type GownMeasures } from '../gown-config';
import { gownOrderBlocks } from './order';
import { GOWN_SEAM_ALLOWANCE_DEFAULT } from './allowance';
import { gownCutCount, gownCutMetres, gownCuttingList, gownMetresAgree, type GownCutRow } from './cutting-list';

const measures: GownMeasures = { waistHip: { cm: 22, from: 'typed' }, waistFloor: { cm: 100, from: 'typed' } };
const skirtOf = (sil: 'sheath' | 'aline' | 'ball') => {
  const b = gownOrderBlocks({ ...startingGownConfig(), sil }, startingGownBody(), measures);
  assert.ok(b.skirt.ok);
  return b.skirt.ok ? b.skirt.pieces : [];
};

test('1 · the cut notes read as counts: fold, pair, or four quarters', () => {
  assert.deepEqual(gownCutCount('Cut 1 on the fold'), { count: 1, fold: true });
  assert.deepEqual(gownCutCount('Cut 2'), { count: 2, fold: false });
  assert.deepEqual(gownCutCount('Cut 2 (a pair)'), { count: 2, fold: false });
  assert.deepEqual(gownCutCount('Cut 4 (or 2 half circles on the fold)'), { count: 4, fold: false });
});

test('2 · a sheath skirt: front on the fold, back as a pair, each the block plus its allowance; lined adds the same in lining', () => {
  const list = gownCuttingList({ skirt: skirtOf('sheath') }, GOWN_SEAM_ALLOWANCE_DEFAULT, { lined: true });
  const [front, back] = list.rows;
  assert.deepEqual([front!.piece, front!.count, front!.fold, front!.pair, front!.fabric], ['Skirt front', 1, true, false, 'outer']);
  assert.deepEqual([back!.piece, back!.count, back!.fold, back!.pair], ['Skirt back', 2, false, true]);
  // 100 cm block + 1.5 cm waist seam + 4 cm hem; 23.3 cm wide + 1.5 cm side seam (the fold adds nothing)
  assert.equal(front!.lengthCm, 105.5);
  assert.ok(Math.abs(front!.widthCm - 24.8) <= 0.1, `front width ${front!.widthCm}`);
  assert.ok(back!.widthCm > front!.widthCm, 'the back carries the zip allowance on its centre');
  assert.deepEqual(list.rows.filter((r) => r.fabric === 'lining').map((r) => r.piece), ['Skirt front', 'Skirt back']);
  const net = gownCuttingList({ skirt: skirtOf('sheath') }, { ...GOWN_SEAM_ALLOWANCE_DEFAULT, on: false }, { lined: false });
  assert.equal(net.rows[0]!.lengthCm, 100, 'a net pattern lists the sewing line');
  assert.equal(net.metres.lining, 0);
});

test('3 · metres by the prototype rule: length + 10 cm × widths on folded 150 cm cloth, + 15 %, up to a tenth', () => {
  const row = (lengthCm: number, widthCm: number, count: number, fold: boolean): GownCutRow => ({ piece: 'x', count, fold, pair: !fold && count % 2 === 0, fabric: 'outer', lengthCm, widthCm });
  // a fold piece 105.5 × 24.8 (1 width) and a pair 105.5 × 26.8 cut together (1 lay, 1 width): (115.5 + 115.5) × 1.15 = 2.66 → 2.7
  assert.equal(gownCutMetres([row(105.5, 24.8, 1, true), row(105.5, 26.8, 2, false)]), 2.7);
  // a piece wider than the folded cloth takes two widths; never more than two
  assert.equal(gownCutMetres([row(90, 80, 1, true)]), Math.ceil(2 * 100 * 1.15) / 100 * 1);
  assert.equal(gownCutMetres([row(90, 300, 1, true)]), gownCutMetres([row(90, 80, 1, true)]));
  // four quarters: two lays of a pair
  assert.equal(gownCutMetres([row(100, 50, 4, false)]), Math.ceil(2 * 110 * 1.15 / 10) / 10);
  assert.equal(gownCutMetres([]), 0);
});

test('4 · the list beside the quote: within 10 % agrees, otherwise the sheet says so; an unread quote never agrees', () => {
  assert.equal(gownMetresAgree(5.4, 5), true);
  assert.equal(gownMetresAgree(5.6, 5), false);
  assert.equal(gownMetresAgree(4.5, 5), true);
  assert.equal(gownMetresAgree(5, 0), false);
  assert.equal(gownMetresAgree(0, 5), false);
});

test('5 · a full A-line and a circle skirt list every piece and a sensible length of cloth', () => {
  const a = gownCuttingList({ skirt: skirtOf('aline') }, GOWN_SEAM_ALLOWANCE_DEFAULT, { lined: false });
  assert.ok(a.metres.outer > 2 && a.metres.outer < 8, `A-line ${a.metres.outer} m`);
  const c = gownCuttingList({ skirt: skirtOf('ball') }, GOWN_SEAM_ALLOWANCE_DEFAULT, { lined: false });
  assert.equal(c.rows[0]!.count, 4);
  assert.ok(c.metres.outer > a.metres.outer, 'a circle skirt takes more cloth than an A-line');
});

test('6 · no money anywhere in the allowance or cutting-list code', () => {
  for (const f of ['allowance.ts', 'cutting-list.ts']) {
    const src = readFileSync(join(__dirname, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');
    assert.doesNotMatch(src, /₱|centavo|formatPhp|price/i, `${f} talks about money`);
  }
});
