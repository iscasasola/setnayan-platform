/**
 * 👗 THE SLEEVE BLOCK (plan step B10; from memory, decision D27).
 *   1 · The cap ease is inside its range and the sleeve head = armhole + cap ease (within 2.5 mm).
 *   2 · Upper arm, elbow and wrist = tape + ease; the tape beats the estimate; the underarm seams are equal.
 *   3 · A cap sleeve, no sleeve, butterfly (no fitted block) and missing numbers each answer plainly.
 *   4 · Every constant is printed as "from memory"; no price anywhere in the engine.
 * Run: cd apps/web && npx tsx --test lib/gown-pattern/sleeve.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { draftSleeve, GOWN_SLEEVE, GOWN_SLEEVE_DRAFT_TABLE } from './sleeve';
import { GOWN_DRAFT_TOLERANCE_CM } from './draft-constants';
import type { GownDraftOrder } from './inputs';
import type { GownMeasures } from '../gown-config';

const meas = (m: Record<string, number>, from: 'typed' | 'estimate' = 'typed'): GownMeasures =>
  Object.fromEntries(Object.entries(m).map(([k, cm]) => [k, { cm, from }])) as GownMeasures;
const order = (m: GownMeasures, sleeve: 'long' | 'cap' | 'none' | 'butterfly' = 'long', ease: { part: string; ease: number }[] = []) =>
  ({ vals: { height: 160, bust: 88, waist: 70, hips: 96 }, sil: 'aline', hem: 'floor', measures: m, ease: ease.map((e) => ({ ...e, body: 0, gown: 0 })), sleeve }) as GownDraftOrder & { sleeve: typeof sleeve };
const bodies = [
  { armhole: 38, upperArm: 26, elbow: 24, wrist: 15, armBent: 58 },
  { armhole: 42, upperArm: 30, elbow: 26, wrist: 16, armBent: 60 },
  { armhole: 46, upperArm: 34, elbow: 28, wrist: 17, armBent: 61 },
  { armhole: 50, upperArm: 38, elbow: 31, wrist: 18, armBent: 62 },
];
const near = (c: readonly [string, number, number]) => Math.abs(c[2] - c[1]) <= GOWN_DRAFT_TOLERANCE_CM;

test('1 · the cap ease is in range; the sleeve head is the armhole plus the cap ease', () => {
  assert.ok(GOWN_SLEEVE.capEase >= GOWN_SLEEVE.capEaseMin && GOWN_SLEEVE.capEase <= GOWN_SLEEVE.capEaseMax);
  for (const b of bodies) {
    const d = draftSleeve(order(meas(b)));
    assert.ok(d.ok && d.pieces.length === 1, `refused ${JSON.stringify(b)}: ${!d.ok ? d.error : ''}`);
    if (!d.ok) continue;
    const head = d.checks.find((c) => c[0].startsWith('Sleeve head'))!;
    assert.ok(near(head), `sleeve head ${head[2]} ≠ ${head[1]}`);
    assert.ok(d.capHeight > b.armhole / 4 && d.capHeight < b.armhole / 2.5);
    assert.ok(d.pieces[0]!.outline.every(([x]) => x >= -1e-9), 'the sleeve draws left of the sheet');
  }
});

test('2 · upper arm, elbow, wrist = tape + ease; tape beats estimate; underarm seams equal', () => {
  const b = bodies[1]!;
  const d = draftSleeve(order(meas(b, 'estimate'), 'long', [{ part: 'Upper arm', ease: 4 }, { part: 'Wrist', ease: 3 }]), { upperArm: 31, wrist: 15.5 });
  assert.ok(d.ok && d.pieces.length === 1);
  if (!d.ok) return;
  const row = (w: string) => d.checks.find((c) => c[0].startsWith(w))!;
  assert.equal(row('Upper arm')[1], 31 + 4);
  assert.equal(row('Wrist')[1], 15.5 + 3);
  assert.equal(row('Elbow')[1], b.elbow + GOWN_SLEEVE.elbowEase);
  for (const w of ['Upper arm', 'Elbow', 'Wrist', 'Underarm seams', 'Length']) assert.ok(near(row(w)), `${w}: ${row(w)}`);
  assert.equal(d.src.upperArm, 'tape');
  assert.equal(d.src.elbow, 'estimate');
  assert.equal(d.est, true, 'a sleeve from estimates is not marked');
});

test('3 · cap, none, butterfly and missing numbers each answer plainly', () => {
  const cap = draftSleeve(order(meas({ armhole: 42, upperArm: 30 }), 'cap'));
  assert.ok(cap.ok && cap.pieces.length === 1 && !cap.checks.some((c) => c[0].startsWith('Wrist')));
  const none = draftSleeve(order(meas({}), 'none'));
  assert.ok(none.ok && none.pieces.length === 0);
  const fly = draftSleeve(order(meas({}), 'butterfly'));
  assert.ok(fly.ok && fly.pieces.length === 0 && /not a fitted sleeve/.test(fly.note));
  const miss = draftSleeve(order(meas({ armhole: 42, upperArm: 30 }), 'long'));
  assert.ok(!miss.ok && /missing elbow, wrist, arm length/.test(miss.error));
  const odd = draftSleeve(order(meas({ armhole: 20, upperArm: 60, elbow: 30, wrist: 16, armBent: 60 })));
  assert.ok(!odd.ok && /believable cap/.test(odd.error));
});

test('4 · every constant is in the printed "from memory" table', () => {
  const keys = GOWN_SLEEVE_DRAFT_TABLE.map((r) => r[0]);
  for (const k of ['capEase', 'capHeight', 'elbowEase', 'wristEase', 'elbowLine', 'capSeam']) assert.ok(keys.includes(k), `${k} is not printed`);
});
