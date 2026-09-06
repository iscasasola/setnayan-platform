/**
 * lock-impact-inputs.test.ts — the WIRING half of the lock announcement.
 *
 * `lock-impact.test.ts` proves the computation. This file proves the adapters
 * that feed it: that the plan groups, the plan titles and — the one that can
 * actually lie to a couple — the two sunk-vendor verdict sets are derived from
 * the SAME shipped functions the vendors page renders the bench from.
 *
 * The failure this guards is not "the modal looks wrong". It is the modal
 * naming a vendor as lost that the bench still shows as available, or naming a
 * plan the couple lost three locks ago as a casualty of this one.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  IMPACT_LOCKED_STATUSES,
  lockImpactTeams,
  lockedGroupIdsFromVendorRows,
  planGroupLabelForCategory,
  savedPlansFromBuildRows,
  sunkVendors,
  type ImpactBenchRow,
  type ImpactBuildRow,
  type ImpactVendorRow,
} from '@/lib/lock-impact-inputs';
import { computeLockImpact, lockImpactCopy } from '@/lib/lock-impact';
import { resolveProbeWindow } from '@/lib/build-date-window';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import { LOCKED_VENDOR_STATUSES } from '@/lib/shortlist-taxonomy';

function vendor(over: Partial<ImpactVendorRow> & { vendorId: string }): ImpactVendorRow {
  return {
    name: over.vendorId,
    category: 'venue',
    status: 'considering',
    profileId: null,
    ...over,
  };
}

// ── The redeclared status set ───────────────────────────────────────────────

test('IMPACT_LOCKED_STATUSES is the same set the rest of the app calls locked', () => {
  // It is redeclared in lock-impact-inputs.ts only to keep that module free of a
  // 'use server' import chain. If the canonical sets ever grow a status and this
  // one does not, a newly-locked category stops counting and the modal starts
  // reporting plans as lost that were already dead.
  assert.deepEqual([...IMPACT_LOCKED_STATUSES].sort(), [...CONFIRMED_VENDOR_STATUSES].sort());
  assert.deepEqual([...IMPACT_LOCKED_STATUSES].sort(), [...LOCKED_VENDOR_STATUSES].sort());
});

// ── lockedGroupIdsFromVendorRows ────────────────────────────────────────────

test('only the locked statuses settle a plan group', () => {
  const ids = lockedGroupIdsFromVendorRows([
    { category: 'venue', status: 'contracted' },
    { category: 'catering', status: 'considering' },
    { category: 'photographer', status: 'deposit_paid' },
  ]);
  assert.ok(ids.length === 2, `expected 2 locked groups, got ${JSON.stringify(ids)}`);
  assert.ok(!ids.includes('catering'), 'a considering pick has settled nothing');
});

test('a category that maps to no plan group is skipped, never bucketed', () => {
  const ids = lockedGroupIdsFromVendorRows([
    { category: 'not_a_real_category', status: 'contracted' },
    { category: null, status: 'contracted' },
  ]);
  assert.deepEqual(ids, []);
});

test('two locked vendors in one group yield ONE group id', () => {
  const ids = lockedGroupIdsFromVendorRows([
    { category: 'photographer', status: 'contracted' },
    { category: 'photographer', status: 'complete' },
  ]);
  assert.equal(ids.length, 1);
});

test('a casualty is filed under a real plan-group label, never a raw id', () => {
  const label = planGroupLabelForCategory('venue');
  assert.ok(label.length > 0);
  assert.notEqual(label, 'venue');
  assert.equal(planGroupLabelForCategory('not_a_real_category'), 'Your team');
});

// ── savedPlansFromBuildRows ─────────────────────────────────────────────────

function buildRow(over: Partial<ImpactBuildRow> & { build_id: string }): ImpactBuildRow {
  return { label: null, title: null, created_at: null, snapshot: { picks: [] }, ...over };
}

test('a plan is named with the words on the couple’s own screen', () => {
  const plans = savedPlansFromBuildRows([
    buildRow({ build_id: 'b1', title: 'Garden Classic' }),
    // Untitled → the same auto title the Compare column header shows.
    buildRow({ build_id: 'b2', title: null, created_at: '2026-01-02' }),
  ]);
  assert.equal(plans[0]!.title, 'Garden Classic');
  assert.match(plans[1]!.title, /^Build \d+$/);
});

test('legacy A/B/C rows lead, named rows follow oldest-first — Compare order', () => {
  const plans = savedPlansFromBuildRows([
    buildRow({ build_id: 'n2', title: 'Newer', created_at: '2026-03-01' }),
    buildRow({ build_id: 'n1', title: 'Older', created_at: '2026-01-01' }),
    buildRow({ build_id: 'a', label: 'A', title: null }),
  ]);
  assert.deepEqual(
    plans.map((p) => p.title),
    ['Plan A', 'Older', 'Newer'],
  );
});

test('a malformed JSONB snapshot yields NO picks — so it can never be a casualty', () => {
  const plans = savedPlansFromBuildRows([
    buildRow({ build_id: 'b1', title: 'Corrupt', snapshot: { picks: 'not an array' } }),
    buildRow({ build_id: 'b2', title: 'Null', snapshot: null }),
    buildRow({ build_id: 'b3', title: 'Junk', snapshot: { picks: [null, 3, { label: 'no group' }] } }),
  ]);
  for (const p of plans) assert.deepEqual(p.picks, []);

  // And the consequence that matters: an unreadable plan is un-loadable BEFORE
  // the lock too, so computeLockImpact must not blame this vendor for it.
  const impact = computeLockImpact({
    groupId: 'reception',
    lockedGroupIds: [],
    savedPlans: plans,
  });
  assert.equal(impact.isEmpty, true, 'a snapshot we cannot read is not evidence of a loss');
});

test('a pick without a vendorId is carried through as un-loadable, not dropped silently', () => {
  const [plan] = savedPlansFromBuildRows([
    buildRow({
      build_id: 'b1',
      title: 'Legacy',
      snapshot: { picks: [{ groupId: 'reception', label: 'Reception' }] },
    }),
  ]);
  assert.equal(plan!.picks.length, 1);
  assert.equal(plan!.picks[0]!.vendorId, undefined);
});

// ── lockImpactTeams ─────────────────────────────────────────────────────────

const FREE_BOTH = new Set(['2027-09-11', '2027-09-12']);
const FREE_11 = new Set(['2027-09-11']);
const FREE_12 = new Set(['2027-09-12']);

test('the vendor being locked is never on its own bench', () => {
  const { bench } = lockImpactTeams({
    rows: [vendor({ vendorId: 'target' }), vendor({ vendorId: 'other' })],
    candidateVendorIds: [],
    freeDaysByProfileId: new Map(),
    targetVendorId: 'target',
  });
  assert.deepEqual(bench.map((b) => b.vendorId), ['other']);
});

test('a vendor with no calendar signal is never a team member', () => {
  const { membersBefore, membersAfter } = lockImpactTeams({
    // Locked, but off-platform: it declares no calendar, so it constrains
    // nothing. Same for the target — which is why locking an off-platform
    // vendor can cost plans but never services.
    rows: [
      vendor({ vendorId: 'locked-offplatform', status: 'contracted', profileId: null }),
      vendor({ vendorId: 'target', profileId: null }),
    ],
    candidateVendorIds: [],
    freeDaysByProfileId: new Map(),
    targetVendorId: 'target',
  });
  assert.deepEqual(membersBefore, []);
  assert.deepEqual(membersAfter, []);
});

test('the target is folded in as a member only for the AFTER set', () => {
  const { membersBefore, membersAfter } = lockImpactTeams({
    rows: [
      vendor({ vendorId: 'venue', status: 'contracted', profileId: 'p-venue' }),
      vendor({ vendorId: 'target', status: 'considering', profileId: 'p-target' }),
    ],
    candidateVendorIds: [],
    freeDaysByProfileId: new Map([
      ['p-venue', FREE_BOTH],
      ['p-target', FREE_11],
    ]),
    targetVendorId: 'target',
  });
  assert.deepEqual(membersBefore.map((m) => m.vendorId), ['venue']);
  assert.deepEqual(membersAfter.map((m) => m.vendorId), ['venue', 'target']);
});

test('a target already pinned to the build narrows nothing further', () => {
  // The bench was ALREADY computed against this vendor's calendar, so the lock
  // takes no service away. Reporting one would blame the lock for a narrowing
  // the couple did when they pinned it.
  const { membersBefore, membersAfter } = lockImpactTeams({
    rows: [vendor({ vendorId: 'target', profileId: 'p-target' })],
    candidateVendorIds: ['target'],
    freeDaysByProfileId: new Map([['p-target', FREE_11]]),
    targetVendorId: 'target',
  });
  assert.deepEqual(membersBefore.map((m) => m.vendorId), ['target']);
  assert.deepEqual(
    membersAfter.map((m) => m.vendorId),
    membersBefore.map((m) => m.vendorId),
  );
});

// ── sunkVendors ─────────────────────────────────────────────────────────────

const PROBE = resolveProbeWindow({
  eventDate: null,
  precision: null,
  candidates: ['2027-09-11', '2027-09-12'],
})!;

function bench(rows: ImpactBenchRow[]) {
  return rows;
}

test('a bench vendor with no free day left in the window is sunk', () => {
  const sunk = sunkVendors({
    probe: PROBE,
    members: [{ vendorId: 'target', name: 'Shutter Co', freeDays: FREE_11 }],
    bench: bench([{ vendorId: 'f', name: 'Bloom Co', categoryLabel: 'Flowers', freeDays: FREE_12 }]),
  });
  assert.deepEqual(sunk, [{ vendorName: 'Bloom Co', categoryLabel: 'Flowers' }]);
});

test('a vendor with NO calendar signal is never sunk — fail-open, end to end', () => {
  const sunk = sunkVendors({
    probe: PROBE,
    members: [{ vendorId: 'target', name: 'Shutter Co', freeDays: FREE_11 }],
    bench: bench([{ vendorId: 'f', name: 'Unknown Co', categoryLabel: 'Flowers', freeDays: null }]),
  });
  assert.deepEqual(sunk, [], 'absence of data is never evidence against a vendor');
});

test("a build whose OWN window is empty sinks nobody — that fault isn't a vendor's", () => {
  const sunk = sunkVendors({
    probe: PROBE,
    members: [
      { vendorId: 'a', name: 'A', freeDays: FREE_11 },
      { vendorId: 'b', name: 'B', freeDays: FREE_12 },
    ],
    bench: bench([{ vendorId: 'f', name: 'Bloom Co', categoryLabel: 'Flowers', freeDays: FREE_12 }]),
  });
  assert.deepEqual(sunk, []);
});

test('an ANCHORED window issues no soft verdicts — the couple already has a date', () => {
  const anchored = resolveProbeWindow({
    eventDate: '2027-09-12',
    precision: 'day',
    candidates: null,
  })!;
  const sunk = sunkVendors({
    probe: anchored,
    members: [{ vendorId: 'target', name: 'Shutter Co', freeDays: FREE_12 }],
    bench: bench([{ vendorId: 'f', name: 'Bloom Co', categoryLabel: 'Flowers', freeDays: FREE_11 }]),
  });
  assert.deepEqual(sunk, []);
});

test('no probe window at all → no services half, rather than a guess', () => {
  const sunk = sunkVendors({
    probe: null,
    members: [{ vendorId: 'target', name: 'Shutter Co', freeDays: FREE_11 }],
    bench: bench([{ vendorId: 'f', name: 'Bloom Co', categoryLabel: 'Flowers', freeDays: FREE_12 }]),
  });
  assert.deepEqual(sunk, []);
});

// ── The two halves together, as finalizeVendor assembles them ───────────────

test('the announced services are exactly the DIFF the lock caused', () => {
  const rows: ImpactVendorRow[] = [
    vendor({ vendorId: 'venue', name: 'Hacienda Ilog', status: 'contracted', profileId: 'p-venue' }),
    vendor({ vendorId: 'target', name: 'Shutter Co', category: 'photographer', profileId: 'p-target' }),
    vendor({ vendorId: 'florist', name: 'Bloom Co', category: 'florist', profileId: 'p-florist' }),
    // Already sunk BEFORE this lock (shares no day with the locked venue).
    vendor({ vendorId: 'gone', name: 'Already Gone', category: 'florist', profileId: 'p-gone' }),
  ];
  const { membersBefore, membersAfter, bench: benchRows } = lockImpactTeams({
    rows,
    candidateVendorIds: [],
    freeDaysByProfileId: new Map([
      ['p-venue', FREE_BOTH],
      ['p-target', FREE_11],
      ['p-florist', FREE_12],
      ['p-gone', new Set(['2027-09-20'])],
    ]),
    targetVendorId: 'target',
  });

  const impact = computeLockImpact({
    groupId: 'photography',
    lockedGroupIds: lockedGroupIdsFromVendorRows(rows),
    savedPlans: [],
    sunkBefore: sunkVendors({ probe: PROBE, members: membersBefore, bench: benchRows }),
    sunkAfter: sunkVendors({ probe: PROBE, members: membersAfter, bench: benchRows }),
  });

  assert.deepEqual(
    impact.servicesLost.map((s) => s.vendorName),
    ['Bloom Co'],
    'Already Gone was sunk before this lock and is not its casualty',
  );
  assert.equal(impact.isEmpty, false);
});

test('a lock that narrows nothing announces nothing', () => {
  const rows: ImpactVendorRow[] = [
    vendor({ vendorId: 'target', name: 'Shutter Co', category: 'photographer', profileId: 'p-target' }),
    vendor({ vendorId: 'florist', name: 'Bloom Co', category: 'florist', profileId: 'p-florist' }),
  ];
  const { membersBefore, membersAfter, bench: benchRows } = lockImpactTeams({
    rows,
    candidateVendorIds: [],
    freeDaysByProfileId: new Map([
      ['p-target', FREE_BOTH],
      ['p-florist', FREE_12],
    ]),
    targetVendorId: 'target',
  });
  const impact = computeLockImpact({
    groupId: 'photography',
    lockedGroupIds: [],
    savedPlans: [],
    sunkBefore: sunkVendors({ probe: PROBE, members: membersBefore, bench: benchRows }),
    sunkAfter: sunkVendors({ probe: PROBE, members: membersAfter, bench: benchRows }),
  });
  assert.equal(impact.isEmpty, true);
  assert.equal(lockImpactCopy(impact, 'Shutter Co'), null, 'no modal for a costless lock');
});

test('the assembled announcement never claims a day is held, or a plan deleted', () => {
  // build-date-window.ts rule 3 + the lock-impact rule that a plan row survives.
  // Asserted on the SERVICES sentence specifically, which is the one derived
  // from calendars and therefore the one tempted to overpromise.
  const impact = computeLockImpact({
    groupId: 'photography',
    lockedGroupIds: [],
    savedPlans: savedPlansFromBuildRows([
      buildRow({
        build_id: 'b1',
        title: 'Garden Classic',
        snapshot: { picks: [{ groupId: 'photography', label: 'Photo', vendorId: 'v1' }] },
      }),
    ]),
    sunkAfter: [{ vendorName: 'Bloom Co', categoryLabel: 'Flowers' }],
  });
  const text = lockImpactCopy(impact, 'Shutter Co')!.lines.join(' ');
  assert.ok(
    !/\bheld\b|\breserved\b|\bholds? your date\b/i.test(text),
    'the soft tier promises nothing about reservations',
  );
  assert.ok(!/deleted|cancelled|canceled/i.test(text), 'a lock un-loads a plan; it does not destroy it');
  assert.ok(text.includes('Garden Classic') && text.includes('Bloom Co'));
});
