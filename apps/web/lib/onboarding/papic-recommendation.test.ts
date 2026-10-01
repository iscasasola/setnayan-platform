/**
 * The onboarding Papic recommendation (owner 2026-10-01): the NEAREST live pack,
 * a tie goes UP, sized from the admin-editable config — never a constant here.
 * Run from apps/web:  npx tsx --test lib/onboarding/papic-recommendation.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestPackStep, recommendedPackStep, targetPoolPoints, type PapicSizing } from './papic-recommendation';

// A test fixture of the shape the admin table holds — the module itself holds none of these.
const SIZING: PapicSizing = { pointsPerGuest: 150, recommendFloorPoints: 5000, ceilingPoints: 100000 };
const LADDER = [5000, 6000, 7000, 10000, 20000, 30000, 50000, 100000].map((points) => ({ points }));
const pack = (guests: number) => LADDER[recommendedPackStep(LADDER, guests, SIZING) - 1]!.points;

test('the owner\'s worked examples (DECISION_LOG 2026-10-01)', () => {
  assert.equal(pack(150), 20000, '150 guests → 22,500 → the nearest pack is 20,000');
  assert.equal(pack(200), 30000);
  assert.equal(pack(300), 50000);
  assert.equal(pack(400), 50000);
  assert.equal(pack(500), 100000, '500 guests → 75,000 is exactly half-way → UP');
});

test('the floor and the ceiling clamp the target', () => {
  assert.equal(pack(10), 5000);
  assert.equal(targetPoolPoints(10, SIZING), 5000);
  assert.equal(targetPoolPoints(5000, SIZING), 100000);
});

test('a tie goes to the bigger pack', () => {
  assert.equal(nearestPackStep([{ points: 10 }, { points: 20 }], 15), 2);
});

test('nothing to recommend without sizing, a guest count, or a pack', () => {
  assert.equal(recommendedPackStep(LADDER, 150, null), 0);
  assert.equal(recommendedPackStep(LADDER, null, SIZING), 0);
  assert.equal(recommendedPackStep(LADDER, 0, SIZING), 0);
  assert.equal(recommendedPackStep([], 150, SIZING), 0);
});

test('a ladder that lost a pack still lands on a real one', () => {
  const short = [{ points: 5000 }, { points: 50000 }];
  assert.equal(recommendedPackStep(short, 400, SIZING), 2, '60,000 is nearer 50,000 than 5,000');
});
