import test from 'node:test';
import assert from 'node:assert/strict';
import { springLinear, holdsFor, SPRING_FALLBACK } from './choreography';

test('springLinear emits 48 points ending exactly at 1', () => {
  const s = springLinear(170, 20, 1, 48);
  assert.ok(s.startsWith('linear(') && s.endsWith(')'));
  const vals = s
    .slice('linear('.length, -1)
    .split(',')
    .map((v) => Number(v));
  assert.equal(vals.length, 48);
  assert.equal(vals[0], 0);
  assert.equal(vals[vals.length - 1], 1);
  vals.forEach((v) => assert.ok(Number.isFinite(v)));
});

test('the house spring overshoots past 1 and settles (stiffness 170 · damping 20 is underdamped)', () => {
  const vals = springLinear(170, 20, 1, 48)
    .slice('linear('.length, -1)
    .split(',')
    .map(Number);
  const peak = Math.max(...vals);
  assert.ok(peak > 1.0, `expected overshoot, peak=${peak}`);
  assert.ok(peak < 1.2, `overshoot should be gentle, peak=${peak}`);
  // the tail settles: the last quarter never strays far from 1
  vals.slice(-12).forEach((v) => assert.ok(Math.abs(v - 1) < 0.03));
});

test('holdsFor maps tempo durations to the 250–400ms hold band with a ≥600ms settle', () => {
  assert.deepEqual(holdsFor(3), { holdMs: 250, settleMs: 600 }); // Quick
  assert.deepEqual(holdsFor(6), { holdMs: 300, settleMs: 600 }); // Classic
  assert.deepEqual(holdsFor(10), { holdMs: 400, settleMs: 600 }); // Ceremonial
});

test('the no-linear() fallback is an overshooting bezier, never linear', () => {
  assert.match(SPRING_FALLBACK, /^cubic-bezier\(/);
  assert.notEqual(SPRING_FALLBACK, 'linear');
});
