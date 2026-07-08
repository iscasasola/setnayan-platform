/**
 * Unit suite for the Adaptive Pax Pricing pure helpers (Phase 2). Load-bearing
 * invariants: the meter fills on the SURE-attending basis by default, live_pax
 * is always max(minimum-pax floor, headcount), the bar caps at 100% while the
 * "exceeded" / overBy state still reports the true excess, and no target
 * (NULL/0 estimated_pax) yields null (the meter is simply hidden).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  computePaxProgress,
  headcountForBasis,
  type GuestStats,
} from './guests';

const STATS: GuestStats = {
  total: 100, // includes declined
  attending: 60,
  pending: 25,
  declined: 10,
  maybe: 5,
  plus_ones: 0,
};

// ── headcountForBasis ───────────────────────────────────────────────────────

test('headcountForBasis: default is sure attending only', () => {
  assert.equal(headcountForBasis(STATS), 60);
  assert.equal(headcountForBasis(STATS, 'attending'), 60);
});

test('headcountForBasis: attending_plus_maybe adds maybes', () => {
  assert.equal(headcountForBasis(STATS, 'attending_plus_maybe'), 65);
});

test('headcountForBasis: invited is everyone still on the list (total minus declined)', () => {
  assert.equal(headcountForBasis(STATS, 'invited'), 90);
});

// ── computePaxProgress — under the floor ────────────────────────────────────

test('computePaxProgress: under target — fills on sure attending, live_pax holds the floor', () => {
  const p = computePaxProgress(STATS, 180);
  assert.ok(p);
  assert.equal(p.target, 180);
  assert.equal(p.headcount, 60);
  assert.equal(p.livePax, 180); // floor protects the vendor number
  assert.equal(p.progressPct, 33); // round(60/180*100)
  assert.equal(p.exceeded, false);
  assert.equal(p.overBy, 0);
  assert.equal(p.remaining, 120);
});

// ── computePaxProgress — over the floor ─────────────────────────────────────

test('computePaxProgress: exceeded — live_pax follows the real count, bar caps at 100', () => {
  const p = computePaxProgress(STATS, 50);
  assert.ok(p);
  assert.equal(p.headcount, 60);
  assert.equal(p.livePax, 60); // count has overtaken the floor
  assert.equal(p.progressPct, 100); // capped (would be 120)
  assert.equal(p.exceeded, true);
  assert.equal(p.overBy, 10);
  assert.equal(p.remaining, 0);
});

test('computePaxProgress: exactly at target is not exceeded', () => {
  const p = computePaxProgress(STATS, 60);
  assert.ok(p);
  assert.equal(p.exceeded, false);
  assert.equal(p.overBy, 0);
  assert.equal(p.progressPct, 100);
});

// ── computePaxProgress — basis override ─────────────────────────────────────

test('computePaxProgress: honors a non-default basis', () => {
  const p = computePaxProgress(STATS, 180, 'attending_plus_maybe');
  assert.ok(p);
  assert.equal(p.headcount, 65);
});

// ── computePaxProgress — no target ──────────────────────────────────────────

test('computePaxProgress: null / 0 / negative target yields null (meter hidden)', () => {
  assert.equal(computePaxProgress(STATS, null), null);
  assert.equal(computePaxProgress(STATS, undefined), null);
  assert.equal(computePaxProgress(STATS, 0), null);
  assert.equal(computePaxProgress(STATS, -5), null);
});

// ── Unassigned-pax pool (S1 · smart seat-plan guest-reactive) ────────────────

test('pax pool: unassigned = target − listed (non-declined), under target', () => {
  const p = computePaxProgress(STATS, 180);
  assert.ok(p);
  assert.equal(p.listed, 90); // total 100 − declined 10
  assert.equal(p.unassigned, 90); // 180 − 90
  assert.equal(p.overListed, 0);
});

test('pax pool: list past the target → unassigned 0, overListed reports the excess', () => {
  const p = computePaxProgress(STATS, 50);
  assert.ok(p);
  assert.equal(p.listed, 90);
  assert.equal(p.unassigned, 0);
  assert.equal(p.overListed, 40); // 90 − 50
});

test('pax pool: counts ALL listed guests regardless of the display basis', () => {
  const attending = computePaxProgress(STATS, 180, 'attending');
  const withMaybe = computePaxProgress(STATS, 180, 'attending_plus_maybe');
  assert.ok(attending && withMaybe);
  // the meter headcount differs by basis, but the pool always counts non-declined
  assert.notEqual(attending.headcount, withMaybe.headcount);
  assert.equal(attending.listed, 90);
  assert.equal(withMaybe.listed, 90);
});

test('pax pool: a fresh event (0 guests) starts with the full target unassigned (point #1)', () => {
  const empty: GuestStats = { total: 0, attending: 0, pending: 0, declined: 0, maybe: 0, plus_ones: 0 };
  const p = computePaxProgress(empty, 120);
  assert.ok(p);
  assert.equal(p.listed, 0);
  assert.equal(p.unassigned, 120);
  assert.equal(p.overListed, 0);
});
