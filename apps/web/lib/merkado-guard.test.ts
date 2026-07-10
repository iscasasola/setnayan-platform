/**
 * Unit suite for the Merkado watch guard (2026-07-10).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBuildGuard, type GuardPick } from './merkado-guard';

function pick(p: Partial<GuardPick> & { vendorId: string }): GuardPick {
  return {
    label: p.vendorId,
    pricePhp: null,
    freeCandidateDayKeys: null,
    withinReach: null,
    ...p,
  };
}

test('a feasible team → ok, no issues', () => {
  const g = computeBuildGuard({
    picks: [
      pick({ vendorId: 'v', label: 'Venue', pricePhp: 200000, freeCandidateDayKeys: ['d1', 'd2'], withinReach: true }),
      pick({ vendorId: 'c', label: 'Caterer', pricePhp: 150000, freeCandidateDayKeys: ['d1'], withinReach: true }),
    ],
    candidateDayKeys: ['d1', 'd2', 'd3'],
    totalBudgetPhp: 600000,
  });
  assert.equal(g.ok, true);
  assert.deepEqual(g.issues, []);
});

test('over budget → a build-wide budget issue with the overage', () => {
  const g = computeBuildGuard({
    picks: [pick({ vendorId: 'v', pricePhp: 500000 }), pick({ vendorId: 'c', pricePhp: 200000 })],
    candidateDayKeys: ['d1'],
    totalBudgetPhp: 600000,
  });
  const b = g.issues.find((i) => i.kind === 'budget');
  assert.ok(b, 'has a budget issue');
  assert.equal(b!.vendorId, null, 'budget is build-wide, not per-vendor');
  assert.match(b!.text, /Over budget by/);
  assert.equal(g.ok, false);
});

test('out-of-reach pick → a per-vendor reach issue; unknown reach never flags', () => {
  const g = computeBuildGuard({
    picks: [
      pick({ vendorId: 'far', label: 'Manila Caterer', withinReach: false }),
      pick({ vendorId: 'unknown', label: 'Traveling Band', withinReach: null }),
    ],
    candidateDayKeys: ['d1'],
    totalBudgetPhp: null,
  });
  const reach = g.issues.filter((i) => i.kind === 'reach');
  assert.equal(reach.length, 1, 'only the KNOWN out-of-range pick flags');
  assert.equal(reach[0]!.vendorId, 'far');
  assert.match(reach[0]!.text, /doesn’t reach your venue/);
});

test('no shared date → flags the most-restrictive pick', () => {
  const g = computeBuildGuard({
    picks: [
      pick({ vendorId: 'v', label: 'Venue', freeCandidateDayKeys: ['d1', 'd2'] }),
      pick({ vendorId: 'p', label: 'Photographer', freeCandidateDayKeys: ['d3'] }),
    ],
    candidateDayKeys: ['d1', 'd2', 'd3'],
    totalBudgetPhp: null,
  });
  const d = g.issues.find((i) => i.kind === 'date');
  assert.ok(d, 'has a date issue');
  assert.equal(d!.vendorId, 'p', 'the single-date photographer is the most restrictive');
  assert.equal(g.ok, false);
});

test('a shared date exists → no date issue', () => {
  const g = computeBuildGuard({
    picks: [
      pick({ vendorId: 'v', freeCandidateDayKeys: ['d1', 'd2'] }),
      pick({ vendorId: 'p', freeCandidateDayKeys: ['d2', 'd3'] }),
    ],
    candidateDayKeys: ['d1', 'd2', 'd3'],
    totalBudgetPhp: null,
  });
  assert.equal(g.issues.some((i) => i.kind === 'date'), false, 'd2 is shared → no clash');
});

test('fail-open: all-unknown inputs never raise an issue', () => {
  const g = computeBuildGuard({
    picks: [pick({ vendorId: 'a' }), pick({ vendorId: 'b' })],
    candidateDayKeys: [],
    totalBudgetPhp: null,
  });
  assert.equal(g.ok, true);
  assert.deepEqual(g.issues, []);
});

test('a single date-constrained pick alone never clashes', () => {
  const g = computeBuildGuard({
    picks: [pick({ vendorId: 'v', freeCandidateDayKeys: ['dX'] })],
    candidateDayKeys: ['d1', 'd2'],
    totalBudgetPhp: null,
  });
  assert.equal(g.issues.some((i) => i.kind === 'date'), false, 'need ≥2 constrained picks to clash');
});
