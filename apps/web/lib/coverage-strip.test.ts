/**
 * Unit suite for the Coverage Strip engine (Explore Replan PR-B).
 *
 * Covers the three pure pieces the strip and the folder pills depend on:
 * the tile→plan-group bridge (MANY-to-one, never a bijection), state
 * derivation + badges, and the urgency ordering with covered sinking right.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  COVERAGE_GLYPH,
  coverageBadgeOf,
  coverageStateOf,
  coverageSummary,
  folderSummaryOf,
  leadDaysForTile,
  orderCoverageTiles,
  planGroupsForTile,
  timelineStatusForTile,
  type CoverageTile,
} from './coverage-strip';
import { categoryHintForTile, coverageTileLabel } from './explore-info-copy';
import { WEDDING_TILE_ICON } from './taxonomy-icons';
import { WEDDING_TILE_ORDER } from './taxonomy';

function tile(p: Partial<CoverageTile> & { tile: string }): CoverageTile {
  return {
    folder: 'venue',
    slug: 'venue',
    label: p.tile,
    vendorCount: 0,
    lockedCount: 0,
    buildCount: 0,
    covered: false,
    order: 0,
    ...p,
  };
}

// ── the bridge ─────────────────────────────────────────────────────────────

test('planGroupsForTile is MANY-to-one — ceremony_venue is claimed by 2+ groups', () => {
  const groups = planGroupsForTile('ceremony_venue');
  assert.ok(
    groups.length >= 2,
    `expected ceremony_venue to be claimed by several plan groups, got ${JSON.stringify(groups)}`,
  );
  assert.ok(groups.includes('ceremony_venue'));
  assert.ok(groups.includes('officiant'));
});

test('planGroupsForTile returns [] for a tile finer than the plan-group set', () => {
  assert.deepEqual(planGroupsForTile('perfume_bar'), []);
  assert.deepEqual(planGroupsForTile('not_a_real_tile'), []);
});

test('leadDaysForTile takes the LONGEST lead among the tile groups (0 when none)', () => {
  // ceremony_venue (270) vs officiant (200) → the earlier floor wins.
  assert.equal(leadDaysForTile('ceremony_venue'), 270);
  assert.equal(leadDaysForTile('perfume_bar'), 0);
});

// ── state + badges ─────────────────────────────────────────────────────────

test('coverageStateOf precedence: covered > locked > picked > exploring > empty', () => {
  assert.equal(coverageStateOf({ vendorCount: 3, lockedCount: 1, buildCount: 2, covered: true }), 'covered');
  assert.equal(coverageStateOf({ vendorCount: 3, lockedCount: 1, buildCount: 2, covered: false }), 'locked');
  assert.equal(coverageStateOf({ vendorCount: 3, lockedCount: 0, buildCount: 2, covered: false }), 'picked');
  assert.equal(coverageStateOf({ vendorCount: 3, lockedCount: 0, buildCount: 0, covered: false }), 'exploring');
  assert.equal(coverageStateOf({ vendorCount: 0, lockedCount: 0, buildCount: 0, covered: false }), 'empty');
});

test('every state has a legend glyph', () => {
  assert.deepEqual(Object.keys(COVERAGE_GLYPH).sort(), [
    'asked',
    'covered',
    'empty',
    'exploring',
    'locked',
    'picked',
  ]);
});

test('coverageBadgeOf: ✓ for covered, locked count over build count, null when nothing committed', () => {
  assert.deepEqual(coverageBadgeOf(tile({ tile: 'cake', covered: true, lockedCount: 2 })), {
    kind: 'covered',
    text: '✓',
  });
  assert.deepEqual(coverageBadgeOf(tile({ tile: 'cake', lockedCount: 2, buildCount: 3 })), {
    kind: 'locked',
    text: '2',
  });
  assert.deepEqual(coverageBadgeOf(tile({ tile: 'cake', buildCount: 3 })), {
    kind: 'build',
    text: '3',
  });
  assert.equal(coverageBadgeOf(tile({ tile: 'cake', vendorCount: 4 })), null);
});

// ── the planning clock ─────────────────────────────────────────────────────

test('timelineStatusForTile takes the MOST urgent group and settles on locked/covered', () => {
  // 210 days out: ceremony_venue floor 270 → overdue; officiant floor 200 → due_soon.
  assert.equal(timelineStatusForTile('ceremony_venue', 210, 'empty'), 'overdue');
  // Settled slots leave the clock entirely.
  assert.equal(timelineStatusForTile('ceremony_venue', 210, 'locked'), 'locked');
  assert.equal(timelineStatusForTile('ceremony_venue', 210, 'covered'), 'locked');
  // No date set → nothing to warn about.
  assert.equal(timelineStatusForTile('ceremony_venue', null, 'empty'), 'upcoming');
  // No plan group → quiet, never a fabricated warning.
  assert.equal(timelineStatusForTile('perfume_bar', 1, 'empty'), 'upcoming');
});

// ── ordering ───────────────────────────────────────────────────────────────

test('orderCoverageTiles sinks covered tiles to the right', () => {
  const out = orderCoverageTiles(
    [
      tile({ tile: 'reception', covered: true, order: 0 }),
      tile({ tile: 'cake', order: 1 }),
      tile({ tile: 'catering', covered: true, order: 2 }),
      tile({ tile: 'coordinator', order: 3 }),
    ],
    300,
  );
  assert.deepEqual(
    out.map((t) => t.covered),
    [false, false, true, true],
  );
});

test('orderCoverageTiles puts the most urgent uncovered category first', () => {
  // 200 days out: reception floor 270 → overdue; cake floor 75 → upcoming.
  const out = orderCoverageTiles([tile({ tile: 'cake', order: 0 }), tile({ tile: 'reception', order: 1 })], 200);
  assert.deepEqual(out.map((t) => t.tile), ['reception', 'cake']);
});

test('at equal status, the EARLIER lock-by floor (longer lead) sorts first', () => {
  // No date → both 'upcoming'; reception (270) outranks cake (75).
  const out = orderCoverageTiles([tile({ tile: 'cake', order: 0 }), tile({ tile: 'reception', order: 1 })], null);
  assert.deepEqual(out.map((t) => t.tile), ['reception', 'cake']);
});

test('ordering is stable and total — taxonomy order breaks a full tie', () => {
  const rows = [tile({ tile: 'perfume_bar', order: 5 }), tile({ tile: 'mocktail', order: 2 })];
  assert.deepEqual(orderCoverageTiles(rows, null).map((t) => t.tile), ['mocktail', 'perfume_bar']);
  // Pure: the input array is untouched.
  assert.deepEqual(rows.map((t) => t.tile), ['perfume_bar', 'mocktail']);
});

// ── header numbers + NEXT ──────────────────────────────────────────────────

test('coverageSummary counts, fractions and flags the first uncovered tile as NEXT', () => {
  const ordered = orderCoverageTiles(
    [
      tile({ tile: 'reception', order: 0 }),
      tile({ tile: 'cake', covered: true, order: 1 }),
      tile({ tile: 'coordinator', order: 2 }),
    ],
    null,
  );
  const s = coverageSummary(ordered);
  assert.equal(s.total, 3);
  assert.equal(s.covered, 1);
  assert.ok(Math.abs(s.fraction - 1 / 3) < 1e-9);
  assert.equal(s.nextTile, 'reception');
});

test('coverageSummary on an all-covered plan has no NEXT and a full ring', () => {
  const s = coverageSummary([tile({ tile: 'cake', covered: true })]);
  assert.equal(s.nextTile, null);
  assert.equal(s.fraction, 1);
});

test('coverageSummary on an empty plan never divides by zero', () => {
  assert.deepEqual(coverageSummary([]), { covered: 0, total: 0, fraction: 0, nextTile: null });
});

// ── folder pills ───────────────────────────────────────────────────────────

test('folderSummaryOf counts locks everywhere, decisions among PLANNED tiles, and the add-pool', () => {
  const tiles = [
    tile({ tile: 'reception', lockedCount: 1 }),
    tile({ tile: 'ceremony_venue', vendorCount: 2 }),
    tile({ tile: 'date_specialist', lockedCount: 2 }), // not planned — locks still count
  ];
  const s = folderSummaryOf(tiles, new Set(['reception', 'ceremony_venue']));
  assert.equal(s.locked, 3);
  assert.equal(s.toDecide, 1); // ceremony_venue — reception already holds a lock
  assert.equal(s.more, 1); // date_specialist is not in the plan
  assert.equal(s.allCovered, false);
});

test('folderSummaryOf reports allCovered only when the folder HAS planned tiles', () => {
  assert.equal(folderSummaryOf([tile({ tile: 'cake' })], new Set()).allCovered, false);
  assert.equal(
    folderSummaryOf([tile({ tile: 'cake', covered: true })], new Set(['cake'])).allCovered,
    true,
  );
});

// ── ⓘ copy contract (spec §11.3 — no copy in JSX) ──────────────────────────

test('categoryHintForTile resolves the plan-group hint deterministically', () => {
  const hint = categoryHintForTile('ceremony_venue');
  assert.ok(hint && hint.length > 0);
  // Deterministic across calls despite the many-to-one bridge.
  assert.equal(categoryHintForTile('ceremony_venue'), hint);
  // Finer than the plan-group set → null, so the caller hides the ⓘ.
  assert.equal(categoryHintForTile('perfume_bar'), null);
});

test('coverageTileLabel names the state and the NEXT flag for screen readers', () => {
  assert.equal(
    coverageTileLabel({ label: 'Catering', state: 'exploring', vendorCount: 2, lockedCount: 0, buildCount: 0, isNext: true }),
    'Catering — 2 shortlisted, next to decide',
  );
  assert.equal(
    coverageTileLabel({ label: 'Cake', state: 'covered', vendorCount: 0, lockedCount: 0, buildCount: 0, isNext: false }),
    'Cake — covered',
  );
});

// ── icons ──────────────────────────────────────────────────────────────────

test('every wedding tile has a Lucide icon (no blank circles on the strip)', () => {
  for (const t of WEDDING_TILE_ORDER) {
    assert.ok(WEDDING_TILE_ICON[t], `no icon for tile ${t}`);
  }
});
