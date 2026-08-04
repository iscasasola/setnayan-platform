/**
 * The emcee's activity catalogue — the decision tests.
 *
 * `planPicksOntoTimeline` is the whole point of the feature: it is what turns
 * "the couple picked six things" into "the day is drafted", and it is the only
 * part that can silently damage someone's hand-built timeline. So these tests
 * carry it.
 *
 *   1. NOTHING EXISTING EVER MOVES. Picked activities APPEND after the whole
 *      timeline. A tool that reflows a couple's authored day is one they stop
 *      trusting — the same reasoning that makes `loadScheduleTemplate` refuse a
 *      non-empty schedule outright.
 *   2. IT IS IDEMPOTENT. A pick already carrying a `scheduled_block_id` is
 *      never planned twice, so running it again after one more pick plans only
 *      the new one. Without this, "add one activity" duplicates the other five.
 *   3. SKIPS ARE NAMED, NEVER SILENT. A deleted or retired activity comes back
 *      in `unavailable` — a pick that vanishes with no explanation is worse
 *      than one that fails loudly.
 *   4. NO INVALID TIMESTAMP CAN REACH THE SCHEDULE. A malformed fallback must
 *      produce zero blocks rather than rows whose `start_at` is "Invalid Date".
 *
 * ── NEUTRALISATION CHECKS (2026-07-27) ─────────────────────────────────────
 *
 * Run by editing the source, observing the failure, reverting:
 *
 *   • Removing the `pick.scheduled_block_id` early-continue (so placed picks
 *     replan) fails exactly the two idempotency tests, and nothing else.
 *   • Starting the cursor at the timeline's EARLIEST start instead of its tail
 *     fails "appends after everything" and "no planned block overlaps an
 *     existing one" — the two that protect the couple's authored day.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  offeredCatalogue,
  planPicksOntoTimeline,
  totalMinutes,
  type ActivityPick,
  type TimelineBlock,
  type VendorActivity,
} from './vendor-activities';

const VENDOR = 'v1';
const EVENT = 'e1';

function activity(over: Partial<VendorActivity> & { activity_id: string }): VendorActivity {
  return {
    vendor_profile_id: VENDOR,
    label: `Activity ${over.activity_id}`,
    blurb: null,
    duration_minutes: 15,
    block_type: 'program',
    is_offered: true,
    display_order: 0,
    ...over,
  };
}

function pick(activity_id: string, scheduled_block_id: string | null = null): ActivityPick {
  return { event_id: EVENT, activity_id, scheduled_block_id };
}

function block(over: Partial<TimelineBlock> & { block_id: string }): TimelineBlock {
  return { start_at: '2026-07-27T10:00:00Z', end_at: '2026-07-27T11:00:00Z', sort_order: 10, ...over };
}

const FALLBACK = '2026-07-27T14:00:00Z';

// ── 1 · Nothing existing ever moves ────────────────────────────────────────

test('appends after everything already on the timeline', () => {
  const plan = planPicksOntoTimeline({
    picks: [pick('a')],
    catalogue: [activity({ activity_id: 'a', duration_minutes: 30, label: 'Shoe game' })],
    timeline: [
      block({ block_id: 'b1', start_at: '2026-07-27T10:00:00Z', end_at: '2026-07-27T11:00:00Z' }),
      block({ block_id: 'b2', start_at: '2026-07-27T12:00:00Z', end_at: '2026-07-27T13:30:00Z' }),
    ],
    fallbackStart: FALLBACK,
  });
  assert.equal(plan.blocks.length, 1);
  // Starts at the LATEST end (13:30), not the earliest start.
  assert.equal(plan.blocks[0]!.start_at, '2026-07-27T13:30:00.000Z');
  assert.equal(plan.blocks[0]!.end_at, '2026-07-27T14:00:00.000Z');
});

test('no planned block overlaps an existing one', () => {
  const timeline = [
    block({ block_id: 'b1', start_at: '2026-07-27T10:00:00Z', end_at: '2026-07-27T11:00:00Z' }),
    block({ block_id: 'b2', start_at: '2026-07-27T11:00:00Z', end_at: '2026-07-27T15:00:00Z' }),
  ];
  const plan = planPicksOntoTimeline({
    picks: [pick('a'), pick('b')],
    catalogue: [
      activity({ activity_id: 'a', display_order: 0 }),
      activity({ activity_id: 'b', display_order: 1 }),
    ],
    timeline,
    fallbackStart: FALLBACK,
  });
  const latestExisting = Math.max(...timeline.map((b) => Date.parse(b.end_at!)));
  for (const p of plan.blocks) {
    assert.ok(Date.parse(p.start_at) >= latestExisting, `${p.label} starts before the timeline ends`);
  }
});

test('planned blocks run back-to-back in catalogue order', () => {
  const plan = planPicksOntoTimeline({
    picks: [pick('second'), pick('first')], // deliberately out of order
    catalogue: [
      activity({ activity_id: 'first', label: 'Roll call', display_order: 0, duration_minutes: 20 }),
      activity({ activity_id: 'second', label: 'Money dance', display_order: 1, duration_minutes: 10 }),
    ],
    timeline: [],
    fallbackStart: '2026-07-27T18:00:00Z',
  });
  assert.deepEqual(plan.blocks.map((b) => b.label), ['Roll call', 'Money dance']);
  assert.equal(plan.blocks[0]!.start_at, '2026-07-27T18:00:00.000Z');
  assert.equal(plan.blocks[0]!.end_at, '2026-07-27T18:20:00.000Z');
  // The next begins exactly where the previous ended.
  assert.equal(plan.blocks[1]!.start_at, plan.blocks[0]!.end_at);
  assert.equal(plan.blocks[1]!.end_at, '2026-07-27T18:30:00.000Z');
});

test('sort_order continues past the timeline, in gap-10 steps', () => {
  const plan = planPicksOntoTimeline({
    picks: [pick('a'), pick('b')],
    catalogue: [
      activity({ activity_id: 'a', display_order: 0 }),
      activity({ activity_id: 'b', display_order: 1 }),
    ],
    timeline: [block({ block_id: 'b1', sort_order: 40 })],
    fallbackStart: FALLBACK,
  });
  assert.deepEqual(plan.blocks.map((b) => b.sort_order), [50, 60]);
});

test('an empty timeline falls back to the given start', () => {
  const plan = planPicksOntoTimeline({
    picks: [pick('a')],
    catalogue: [activity({ activity_id: 'a', duration_minutes: 45 })],
    timeline: [],
    fallbackStart: '2026-07-27T16:00:00Z',
  });
  assert.equal(plan.blocks[0]!.start_at, '2026-07-27T16:00:00.000Z');
  assert.equal(plan.blocks[0]!.end_at, '2026-07-27T16:45:00.000Z');
});

// ── 2 · Idempotent ─────────────────────────────────────────────────────────

test('a pick already on the timeline is never planned twice', () => {
  const plan = planPicksOntoTimeline({
    picks: [pick('a', 'block-123')],
    catalogue: [activity({ activity_id: 'a' })],
    timeline: [block({ block_id: 'block-123' })],
    fallbackStart: FALLBACK,
  });
  assert.deepEqual(plan.blocks, []);
  assert.deepEqual(plan.alreadyPlaced, ['a']);
});

test('re-running after one more pick plans only the new one', () => {
  const catalogue = [
    activity({ activity_id: 'a', label: 'Roll call', display_order: 0 }),
    activity({ activity_id: 'b', label: 'Shoe game', display_order: 1 }),
  ];
  const plan = planPicksOntoTimeline({
    picks: [pick('a', 'already'), pick('b')],
    catalogue,
    timeline: [block({ block_id: 'already' })],
    fallbackStart: FALLBACK,
  });
  assert.equal(plan.blocks.length, 1);
  assert.equal(plan.blocks[0]!.label, 'Shoe game');
  assert.deepEqual(plan.alreadyPlaced, ['a']);
});

// ── 3 · Skips are named, never silent ──────────────────────────────────────

test('a retired activity is skipped and NAMED', () => {
  const plan = planPicksOntoTimeline({
    picks: [pick('gone')],
    catalogue: [activity({ activity_id: 'gone', is_offered: false })],
    timeline: [],
    fallbackStart: FALLBACK,
  });
  assert.deepEqual(plan.blocks, []);
  assert.deepEqual(plan.unavailable, ['gone']);
});

test('a deleted activity is skipped and NAMED', () => {
  const plan = planPicksOntoTimeline({
    picks: [pick('missing')],
    catalogue: [],
    timeline: [],
    fallbackStart: FALLBACK,
  });
  assert.deepEqual(plan.unavailable, ['missing']);
});

test('one bad pick never stops the good ones', () => {
  const plan = planPicksOntoTimeline({
    picks: [pick('missing'), pick('good')],
    catalogue: [activity({ activity_id: 'good', label: 'Toasts' })],
    timeline: [],
    fallbackStart: FALLBACK,
  });
  assert.deepEqual(plan.blocks.map((b) => b.label), ['Toasts']);
  assert.deepEqual(plan.unavailable, ['missing']);
});

// ── 4 · No invalid timestamp can reach the schedule ────────────────────────

test('a malformed fallback plans NOTHING rather than Invalid Date rows', () => {
  const plan = planPicksOntoTimeline({
    picks: [pick('a')],
    catalogue: [activity({ activity_id: 'a' })],
    timeline: [],
    fallbackStart: 'not-a-date',
  });
  assert.deepEqual(plan.blocks, []);
});

test('every planned timestamp parses', () => {
  const plan = planPicksOntoTimeline({
    picks: [pick('a'), pick('b'), pick('c')],
    catalogue: [
      activity({ activity_id: 'a', display_order: 0 }),
      activity({ activity_id: 'b', display_order: 1 }),
      activity({ activity_id: 'c', display_order: 2 }),
    ],
    timeline: [],
    fallbackStart: FALLBACK,
  });
  assert.equal(plan.blocks.length, 3);
  for (const b of plan.blocks) {
    assert.ok(!Number.isNaN(Date.parse(b.start_at)));
    assert.ok(!Number.isNaN(Date.parse(b.end_at)));
    assert.ok(Date.parse(b.end_at) > Date.parse(b.start_at), 'a block must have length');
  }
});

test('an unknown block_type degrades to program rather than corrupting the enum', () => {
  const plan = planPicksOntoTimeline({
    picks: [pick('a')],
    catalogue: [activity({ activity_id: 'a', block_type: 'something_new' })],
    timeline: [],
    fallbackStart: FALLBACK,
  });
  assert.equal(plan.blocks[0]!.block_type, 'program');
});

test('a known block_type is preserved', () => {
  const plan = planPicksOntoTimeline({
    picks: [pick('a')],
    catalogue: [activity({ activity_id: 'a', block_type: 'dancing' })],
    timeline: [],
    fallbackStart: FALLBACK,
  });
  assert.equal(plan.blocks[0]!.block_type, 'dancing');
});

// ── 5 · The menu the couple sees ───────────────────────────────────────────

test('the menu hides retired activities but keeps the emcee’s order', () => {
  const menu = offeredCatalogue([
    activity({ activity_id: 'c', display_order: 2, label: 'Third' }),
    activity({ activity_id: 'x', display_order: 1, label: 'Retired', is_offered: false }),
    activity({ activity_id: 'a', display_order: 0, label: 'First' }),
  ]);
  assert.deepEqual(menu.map((a) => a.label), ['First', 'Third']);
});

test('total running time is what the couple is committing to', () => {
  assert.equal(
    totalMinutes([
      activity({ activity_id: 'a', duration_minutes: 20 }),
      activity({ activity_id: 'b', duration_minutes: 10 }),
    ]),
    30,
  );
});
