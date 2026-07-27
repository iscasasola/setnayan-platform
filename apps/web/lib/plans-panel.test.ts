/**
 * Unit suite for the Plans-panel PURE core (`plans-panel.ts`) — the Compare
 * surface reframed as "Plans" (Explore_Replan_BUILD_SPEC_2026-07-27 §3 PR-F).
 *
 * Load-bearing invariants (all money/contract-adjacent):
 *   • Locked categories come from the LIVE plan only — a stale snapshot flag
 *     must never pin (or un-pin) a row.
 *   • Pinned rows and candidate rows are disjoint, deterministic, and deduped.
 *   • Loading a plan NEVER re-opens a locked category and never emits a pick
 *     without a vendorId.
 *
 * Run via the repo's `test:unit` script (`tsx --test`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  lockedGroupIdsOf,
  partitionPlanRows,
  planPicksToApply,
  isPlanLoadable,
  type PlansRowPick,
} from './plans-panel';

const pick = (over: Partial<PlansRowPick> & { groupId: string }): PlansRowPick => ({
  label: over.groupId,
  vendorName: `${over.groupId} vendor`,
  costPhp: 1000,
  locked: false,
  ...over,
});

// ── lockedGroupIdsOf ─────────────────────────────────────────────────────────

test('lockedGroupIdsOf returns locked groups in plan order, deduped', () => {
  const picks = [
    pick({ groupId: 'catering' }),
    pick({ groupId: 'reception_venue', locked: true }),
    pick({ groupId: 'photography', locked: true }),
    pick({ groupId: 'reception_venue', locked: true }),
  ];
  assert.deepEqual(lockedGroupIdsOf(picks), ['reception_venue', 'photography']);
});

test('lockedGroupIdsOf is empty when nothing is locked', () => {
  assert.deepEqual(lockedGroupIdsOf([pick({ groupId: 'catering' })]), []);
  assert.deepEqual(lockedGroupIdsOf([]), []);
});

// ── partitionPlanRows ────────────────────────────────────────────────────────

test('partitionPlanRows pins locked rows and leaves the rest as candidates', () => {
  const current = [
    pick({ groupId: 'reception_venue', vendorName: 'Casa Amara', costPhp: 250000, locked: true }),
    pick({ groupId: 'catering', vendorName: 'Tita Neneng', costPhp: 90000 }),
  ];
  const { lockedRows, candidateRows } = partitionPlanRows({
    currentPicks: current,
    savedPickSets: [],
  });
  assert.deepEqual(lockedRows, [
    {
      groupId: 'reception_venue',
      label: 'reception_venue',
      vendorName: 'Casa Amara',
      costPhp: 250000,
    },
  ]);
  assert.deepEqual(candidateRows, [{ groupId: 'catering', label: 'catering' }]);
});

test('partitionPlanRows: a locked category NEVER appears as a candidate row, even when a saved plan still holds a candidate there', () => {
  // The couple saved "Plan A" with a catering candidate, then LOCKED a caterer.
  const current = [pick({ groupId: 'catering', vendorName: 'Locked Caterer', locked: true })];
  const saved = [[pick({ groupId: 'catering', vendorName: 'Old Candidate', vendorId: 'v1' })]];
  const { lockedRows, candidateRows } = partitionPlanRows({
    currentPicks: current,
    savedPickSets: saved,
  });
  assert.equal(lockedRows.length, 1);
  assert.equal(lockedRows[0]?.vendorName, 'Locked Caterer');
  assert.deepEqual(candidateRows, []);
});

test('partitionPlanRows ignores a SNAPSHOT locked flag — only the live plan pins', () => {
  // The snapshot was saved while photography was locked; it has since unlocked.
  const current = [pick({ groupId: 'photography', vendorName: 'Now A Candidate' })];
  const saved = [[pick({ groupId: 'photography', vendorName: 'Was Locked', locked: true })]];
  const { lockedRows, candidateRows } = partitionPlanRows({
    currentPicks: current,
    savedPickSets: saved,
  });
  assert.deepEqual(lockedRows, []);
  assert.deepEqual(candidateRows, [{ groupId: 'photography', label: 'photography' }]);
});

test('partitionPlanRows unions saved-only categories, current-plan order first', () => {
  const current = [pick({ groupId: 'catering' })];
  const saved = [
    [pick({ groupId: 'florals_decor' }), pick({ groupId: 'catering' })],
    [pick({ groupId: 'catering' }), pick({ groupId: 'hair_makeup' })],
  ];
  const { candidateRows } = partitionPlanRows({ currentPicks: current, savedPickSets: saved });
  assert.deepEqual(
    candidateRows.map((r) => r.groupId),
    ['catering', 'florals_decor', 'hair_makeup'],
  );
});

test('partitionPlanRows: pinned and candidate rows are disjoint', () => {
  const current = [
    pick({ groupId: 'reception_venue', locked: true }),
    pick({ groupId: 'catering' }),
  ];
  const saved = [[pick({ groupId: 'reception_venue' }), pick({ groupId: 'photography' })]];
  const { lockedRows, candidateRows } = partitionPlanRows({
    currentPicks: current,
    savedPickSets: saved,
  });
  const pinned = new Set(lockedRows.map((r) => r.groupId));
  assert.ok(candidateRows.every((r) => !pinned.has(r.groupId)));
});

test('partitionPlanRows does not mutate its inputs', () => {
  const current = [pick({ groupId: 'catering', locked: true })];
  const saved = [[pick({ groupId: 'photography' })]];
  const currentCopy = JSON.parse(JSON.stringify(current));
  const savedCopy = JSON.parse(JSON.stringify(saved));
  partitionPlanRows({ currentPicks: current, savedPickSets: saved });
  assert.deepEqual(current, currentCopy);
  assert.deepEqual(saved, savedCopy);
});

// ── planPicksToApply (Load / merge semantics) ────────────────────────────────

test('planPicksToApply drops picks in a LOCKED category — a load never re-opens a contract', () => {
  const out = planPicksToApply({
    snapshotPicks: [
      pick({ groupId: 'reception_venue', vendorId: 'v-old-venue' }),
      pick({ groupId: 'catering', vendorId: 'v-caterer' }),
    ],
    lockedGroupIds: ['reception_venue'],
  });
  assert.deepEqual(out, [{ planGroupId: 'catering', vendorId: 'v-caterer' }]);
});

test('planPicksToApply drops picks with no vendorId (legacy snapshots)', () => {
  const out = planPicksToApply({
    snapshotPicks: [pick({ groupId: 'catering' }), pick({ groupId: 'photography', vendorId: 'v2' })],
    lockedGroupIds: [],
  });
  assert.deepEqual(out, [{ planGroupId: 'photography', vendorId: 'v2' }]);
});

test('planPicksToApply keeps EVERY vendor of a multi-pick category but dedupes exact repeats', () => {
  const out = planPicksToApply({
    snapshotPicks: [
      pick({ groupId: 'florals_decor', vendorId: 'a' }),
      pick({ groupId: 'florals_decor', vendorId: 'b' }),
      pick({ groupId: 'florals_decor', vendorId: 'a' }),
    ],
    lockedGroupIds: [],
  });
  assert.deepEqual(out, [
    { planGroupId: 'florals_decor', vendorId: 'a' },
    { planGroupId: 'florals_decor', vendorId: 'b' },
  ]);
});

test('planPicksToApply preserves snapshot order', () => {
  const out = planPicksToApply({
    snapshotPicks: [
      pick({ groupId: 'c', vendorId: '3' }),
      pick({ groupId: 'a', vendorId: '1' }),
      pick({ groupId: 'b', vendorId: '2' }),
    ],
    lockedGroupIds: [],
  });
  assert.deepEqual(
    out.map((p) => p.planGroupId),
    ['c', 'a', 'b'],
  );
});

test('planPicksToApply on an all-locked snapshot yields nothing (and isPlanLoadable is false)', () => {
  const args = {
    snapshotPicks: [pick({ groupId: 'reception_venue', vendorId: 'v1' })],
    lockedGroupIds: ['reception_venue'],
  };
  assert.deepEqual(planPicksToApply(args), []);
  assert.equal(isPlanLoadable(args), false);
});

test('isPlanLoadable is true as soon as one unlocked, vendorId-bearing pick survives', () => {
  assert.equal(
    isPlanLoadable({
      snapshotPicks: [
        pick({ groupId: 'reception_venue', vendorId: 'v1' }),
        pick({ groupId: 'catering', vendorId: 'v2' }),
      ],
      lockedGroupIds: ['reception_venue'],
    }),
    true,
  );
  assert.equal(isPlanLoadable({ snapshotPicks: [], lockedGroupIds: [] }), false);
});
