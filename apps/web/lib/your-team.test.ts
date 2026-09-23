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
  subtotalLabel,
  unpricedNote,
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
    candidateCostsPhp: [40_000, 12_500],
    budgetPhp: 300_000,
  });
  assert.equal(m.lockedPhp, 25_000);
  assert.equal(m.inBuildPhp, 52_500);
  assert.equal(m.inBuildUnpriced, 0);
  assert.equal(m.lockedUnpriced, 0);
  assert.equal(m.bufferPhp, 300_000 - 25_000 - 52_500);
});

/* ═══════════════════════════════════════════════════════════════════════════
   A NULL PRICE IS NOT ₱0 — and this test file used to say it was
   ═══════════════════════════════════════════════════════════════════════════

   🪤 THE DEFECT WAS PINNED BY A PASSING TEST. The case above was written
   `candidateCostsPhp: [40_000, 12_500, null]` asserting
   `bufferPhp === 300_000 - 25_000 - 52_500` — i.e. it asserted that a candidate
   whose price nobody has recorded contributes **zero**, and it was green. The
   `null` has been removed from that case (it is now about the arithmetic it was
   named for) and the behaviour it accidentally blessed is the subject of the
   tests below.

   🔑 A guard can hold a defect in place as firmly as it holds a fix. Before
   changing a derivation, read what its own tests already promise.

   Measured on production 2026-09-22, event 044f7e64 (a live wedding): both
   locked suppliers and both candidates carry `total_cost_php = NULL`, so the
   section printed **LOCKED ₱0** and **₱2,250,000 to spare** beside
   **₱26,499 paid**. The numbers below are that event. */

test('🪤 an unpriced candidate is COUNTED, never added as ₱0', () => {
  const m = teamMoney({
    lockedCentavos: 40_000_00,
    candidateCostsPhp: [12_500, null, null],
    budgetPhp: 300_000,
  });
  assert.equal(m.inBuildPhp, 12_500, 'only the price that exists is summed');
  assert.equal(m.inBuildUnpriced, 2, 'the two unknowns are reported, not absorbed');
  assert.equal(
    m.bufferPhp,
    null,
    'a buffer cannot be computed from a sum that is missing rows — null, not 247,500',
  );
});

test('🪤 the live production shape: everything unpriced, nothing claimed', () => {
  // 2 locked suppliers and 2 candidates, all with total_cost_php = NULL,
  // against the couple's real ₱2,250,000 budget.
  const m = teamMoney({
    lockedCentavos: 0,
    lockedUnpricedCount: 2,
    candidateCostsPhp: [null, null],
    budgetPhp: 2_250_000,
  });
  assert.equal(m.lockedUnpriced, 2);
  assert.equal(m.inBuildUnpriced, 2);
  assert.equal(m.inBuildPhp, 0, 'zero KNOWN prices sum to zero — that part is honest');
  assert.equal(m.bufferPhp, null, 'the screen said "₱2,250,000 to spare". It did not know that.');
  // And the words the couple actually reads:
  assert.deepEqual(bufferTile(m.bufferPhp, m.lockedUnpriced + m.inBuildUnpriced), {
    text: 'Not knowable',
    tone: 'none',
  });
  assert.equal(unpricedNote(m.lockedUnpriced + m.inBuildUnpriced), '4 suppliers have no price recorded');
  assert.equal(subtotalLabel(m.inBuildPhp, m.inBuildUnpriced), 'No prices recorded yet');
});

test('🪤 an unpriced LOCKED supplier makes the buffer refuse too', () => {
  // Every candidate is priced; the doubt is entirely on the locked side.
  const m = teamMoney({
    lockedCentavos: 10_170_00,
    lockedUnpricedCount: 1,
    candidateCostsPhp: [40_000],
    budgetPhp: 300_000,
  });
  assert.equal(m.lockedPhp, 10_170, 'the locked FIGURE does not move — it is summed upstream');
  assert.equal(m.lockedUnpriced, 1);
  assert.equal(m.bufferPhp, null);
  assert.equal(unpricedNote(m.lockedUnpriced), '1 supplier has no price recorded');
});

test('a fully priced team still gets its buffer — the refusal is not a blanket', () => {
  // The regression that would make this fix useless: refusing always.
  const m = teamMoney({
    lockedCentavos: 30_000_00,
    lockedUnpricedCount: 0,
    candidateCostsPhp: [48_000, 40_000],
    budgetPhp: 200_000,
  });
  assert.equal(m.bufferPhp, 82_000);
  assert.deepEqual(bufferTile(m.bufferPhp, m.lockedUnpriced + m.inBuildUnpriced), {
    text: '₱82,000 to spare',
    tone: 'good',
  });
  assert.equal(unpricedNote(0), null, 'no doubt → no note at all');
  assert.equal(subtotalLabel(m.inBuildPhp, 0), '₱88,000');
});

test('unpricedNote refuses to announce a doubt it does not have', () => {
  // 🔑 The same mechanism as hiddenMoreLabel in lib/capped-rows.ts: with no
  // string there is no note, so "0 suppliers have no price recorded" is
  // unrepresentable rather than merely discouraged.
  for (const n of [0, -1, -4, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(unpricedNote(n), null, `unpricedNote(${String(n)}) must be null`);
  }
  assert.equal(unpricedNote(1), '1 supplier has no price recorded', 'singular');
  assert.equal(unpricedNote(2), '2 suppliers have no price recorded', 'plural');
  assert.equal(unpricedNote(2.9), '2 suppliers have no price recorded', 'floors, never "2.9 suppliers"');
});

test('subtotalLabel never renders ₱0 for "we do not know"', () => {
  assert.equal(subtotalLabel(52_500, 0), '₱52,500');
  assert.equal(subtotalLabel(52_500, 2), '₱52,500 + 2 with no price recorded');
  // 🪤 The live case. "₱0" is a claim about their build that nobody made.
  assert.equal(subtotalLabel(0, 2), 'No prices recorded yet');
  // A genuinely empty build is still ₱0 — there is nothing unknown about it.
  assert.equal(subtotalLabel(0, 0), '₱0');
});

test('"Not knowable" outranks "No budget set" when both are true', () => {
  // A couple who HAS set a budget and sees "No budget set" would reasonably
  // think their budget was lost. The doubt about prices is the nearer fact.
  const m = teamMoney({ lockedCentavos: 0, candidateCostsPhp: [null], budgetPhp: null });
  assert.equal(m.bufferPhp, null);
  assert.equal(bufferTile(m.bufferPhp, m.inBuildUnpriced).text, 'Not knowable');
  assert.equal(bufferTile(null, 0).text, 'No budget set', 'and with no doubt, the old words stand');
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

test('teamMoney: empty candidate list totals zero — and doubts nothing', () => {
  const m = teamMoney({ lockedCentavos: 0, candidateCostsPhp: [], budgetPhp: 100_000 });
  assert.equal(m.inBuildPhp, 0);
  assert.equal(m.inBuildUnpriced, 0, 'no rows means no unknowns — an empty build is knowable');
  assert.equal(m.bufferPhp, 100_000, 'so the buffer must still compute');
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
