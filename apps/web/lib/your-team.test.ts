/**
 * Unit suite for the "Your team" PURE core (`your-team.ts`) — the right rail of
 * the Explore replan (Explore_Replan_BUILD_SPEC_2026-07-27 §3 PR-E).
 *
 * Load-bearing invariants:
 *   • Buffer is money the couple will act on — the centavos→PHP fold must be
 *     done exactly once, and "no budget" must NOT read as "₱0 buffer".
 *   • "Still needs your decision" never lists a locked (or covered) category,
 *     is urgency-ordered, and is deterministic.
 *   • The doorway tile comes from the real `catalogTile` bridge — never guessed.
 *
 * Run via the repo's `test:unit` script (`tsx --test`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bufferTile,
  deepLinkTileForGroup,
  stillNeedsDecision,
  teamMoney,
  type TeamDecisionInput,
} from './your-team';

const row = (over: Partial<TeamDecisionInput> & { groupId: string }): TeamDecisionInput => ({
  label: over.groupId,
  folderSlug: 'folder',
  optionCount: 0,
  buildCount: 0,
  timelineStatus: 'upcoming',
  daysLeft: null,
  covered: false,
  order: 0,
  ...over,
});

// ── teamMoney ──────────────────────────────────────────────────────────────

test('teamMoney folds centavos→PHP once and subtracts both layers', () => {
  const m = teamMoney({
    lockedCentavos: 25_000_00,
    candidateCostsPhp: [40_000, 12_500, null],
    budgetPhp: 300_000,
  });
  assert.equal(m.lockedPhp, 25_000);
  assert.equal(m.inBuildPhp, 52_500);
  assert.equal(m.bufferPhp, 300_000 - 25_000 - 52_500);
});

test('teamMoney: no budget set → buffer is null, NOT zero', () => {
  const m = teamMoney({ lockedCentavos: 10_000_00, candidateCostsPhp: [5_000], budgetPhp: null });
  assert.equal(m.budgetPhp, null);
  assert.equal(m.bufferPhp, null);
  assert.equal(m.lockedPhp, 10_000);
  assert.equal(m.inBuildPhp, 5_000);
});

test('teamMoney: overspending yields a NEGATIVE buffer (never clamped)', () => {
  const m = teamMoney({ lockedCentavos: 200_000_00, candidateCostsPhp: [150_000], budgetPhp: 300_000 });
  assert.equal(m.bufferPhp, -50_000);
});

test('teamMoney: empty candidate list totals zero', () => {
  const m = teamMoney({ lockedCentavos: 0, candidateCostsPhp: [], budgetPhp: 100_000 });
  assert.equal(m.inBuildPhp, 0);
  assert.equal(m.bufferPhp, 100_000);
});

// ── bufferTile ─────────────────────────────────────────────────────────────

test('bufferTile speaks "to spare" / "over" / "No budget set"', () => {
  assert.deepEqual(bufferTile(12_500), { text: '₱12,500 to spare', tone: 'good' });
  assert.deepEqual(bufferTile(-8_000), { text: '₱8,000 over', tone: 'over' });
  assert.deepEqual(bufferTile(0), { text: '₱0 to spare', tone: 'good' });
  assert.deepEqual(bufferTile(null), { text: 'No budget set', tone: 'none' });
});

// ── deepLinkTileForGroup ───────────────────────────────────────────────────

test('deepLinkTileForGroup resolves a real catalogTile and null for unknown groups', () => {
  assert.equal(deepLinkTileForGroup('catering'), 'catering');
  assert.equal(deepLinkTileForGroup('reception_venue'), 'reception');
  assert.equal(deepLinkTileForGroup('not_a_group'), null);
});

// ── stillNeedsDecision ─────────────────────────────────────────────────────

test('a locked category is never listed', () => {
  const { rows } = stillNeedsDecision({
    rows: [row({ groupId: 'catering', optionCount: 3 }), row({ groupId: 'hmua', optionCount: 1 })],
    lockedGroupIds: ['catering'],
  });
  assert.deepEqual(
    rows.map((r) => r.groupId),
    ['hmua'],
  );
});

test('a covered category (someone else’s package) is never listed', () => {
  const { rows } = stillNeedsDecision({
    rows: [row({ groupId: 'hmua', optionCount: 2, covered: true })],
    lockedGroupIds: [],
  });
  assert.equal(rows.length, 0);
});

test('untouched + not-yet-actionable categories stay quiet', () => {
  const { rows } = stillNeedsDecision({
    rows: [row({ groupId: 'hmua', timelineStatus: 'upcoming' })],
    lockedGroupIds: [],
  });
  assert.equal(rows.length, 0);
});

test('an untouched category IN its action window is listed', () => {
  const { rows } = stillNeedsDecision({
    rows: [row({ groupId: 'hmua', timelineStatus: 'due_soon', daysLeft: 9 })],
    lockedGroupIds: [],
  });
  assert.deepEqual(
    rows.map((r) => r.groupId),
    ['hmua'],
  );
});

test('order: urgency, then the sooner lock-by floor, then model order', () => {
  const { rows } = stillNeedsDecision({
    rows: [
      row({ groupId: 'a', optionCount: 1, timelineStatus: 'due_soon', daysLeft: 20, order: 0 }),
      row({ groupId: 'b', optionCount: 1, timelineStatus: 'overdue', daysLeft: -3, order: 1 }),
      row({ groupId: 'c', optionCount: 1, timelineStatus: 'due_soon', daysLeft: 4, order: 2 }),
      row({ groupId: 'd', optionCount: 1, timelineStatus: 'start_now', daysLeft: 90, order: 3 }),
      row({ groupId: 'e', optionCount: 1, timelineStatus: 'due_soon', daysLeft: 4, order: 4 }),
    ],
    lockedGroupIds: [],
  });
  assert.deepEqual(
    rows.map((r) => r.groupId),
    ['b', 'c', 'e', 'a', 'd'],
  );
});

test('a null daysLeft sorts after every dated row at the same urgency', () => {
  const { rows } = stillNeedsDecision({
    rows: [
      row({ groupId: 'nodate', optionCount: 1, timelineStatus: 'start_now', daysLeft: null, order: 0 }),
      row({ groupId: 'dated', optionCount: 1, timelineStatus: 'start_now', daysLeft: 300, order: 1 }),
    ],
    lockedGroupIds: [],
  });
  assert.deepEqual(
    rows.map((r) => r.groupId),
    ['dated', 'nodate'],
  );
});

test('limit caps the rows and reports the remainder', () => {
  const many = Array.from({ length: 7 }, (_, i) =>
    row({ groupId: `g${i}`, optionCount: 1, timelineStatus: 'due_soon', daysLeft: i, order: i }),
  );
  const { rows, hiddenCount } = stillNeedsDecision({ rows: many, lockedGroupIds: [], limit: 4 });
  assert.equal(rows.length, 4);
  assert.equal(hiddenCount, 3);
  const all = stillNeedsDecision({ rows: many, lockedGroupIds: [], limit: 0 });
  assert.equal(all.rows.length, 7);
  assert.equal(all.hiddenCount, 0);
});

test('build candidates alone make a category an open decision', () => {
  const { rows } = stillNeedsDecision({
    rows: [row({ groupId: 'hmua', optionCount: 0, buildCount: 1, timelineStatus: 'upcoming' })],
    lockedGroupIds: [],
  });
  assert.equal(rows.length, 1);
});

test('rows carry their deep-link tile (or null) and never mutate the input', () => {
  const input = [row({ groupId: 'catering', optionCount: 1, timelineStatus: 'due_soon', daysLeft: 5 })];
  const frozen = JSON.stringify(input);
  const { rows } = stillNeedsDecision({ rows: input, lockedGroupIds: [] });
  assert.equal(rows[0]?.tile, 'catering');
  assert.equal(JSON.stringify(input), frozen);
});
