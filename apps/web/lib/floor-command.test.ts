/**
 * Floor command — decision-logic tests.
 *
 * The claims worth pinning: the advance button predicts what
 * `advance_schedule_block` will really do, a delay is validated before it can
 * throw inside the retime math, and a scan's five outcomes stay distinct —
 * "wrong event" and "no seat yet" send the coordinator to different people.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  FLOOR_REQUESTABLE_AREAS,
  RETIME_PRESETS,
  buildFloorCommand,
  checkRetime,
  classifyScan,
  grantLevelFor,
  normalizeRequestedAreas,
  nextAdvanceAction,
  remainingBlockCount,
  resolveSeatScan,
  summarizeDecisions,
  type FloorGrants,
  type ScanKind,
} from './floor-command';
import { MAX_RETIME_MINUTES } from './schedule-ros';
import type { RunOfShowBlock } from './run-of-show';
import type { DelegateArea } from './event-moderators';

// ─── fixtures ──────────────────────────────────────────────────────────────

function block(over: Partial<RunOfShowBlock> & { block_id: string }): RunOfShowBlock {
  return {
    label: `Block ${over.block_id}`,
    start_at: '2026-07-27T10:00:00Z',
    end_at: null,
    location: null,
    run_state: 'upcoming',
    actual_start_at: null,
    ...over,
  };
}

const NOW = new Date('2026-07-27T10:30:00Z');

// ─── 1. Advancing ──────────────────────────────────────────────────────────

test('with nothing live, one tap STARTS the earliest upcoming block', () => {
  const blocks = [
    block({ block_id: 'a', label: 'Ceremony', start_at: '2026-07-27T10:00:00Z' }),
    block({ block_id: 'b', label: 'Reception', start_at: '2026-07-27T12:00:00Z' }),
  ];
  const action = nextAdvanceAction(blocks, NOW);
  assert.equal(action.kind, 'start');
  assert.equal(action.kind === 'start' && action.blockId, 'a');
  assert.equal(action.kind === 'start' && action.label, 'Ceremony');
});

test('with one live, one tap FINISHES it and names what lights up next', () => {
  const blocks = [
    block({
      block_id: 'a', label: 'Ceremony', run_state: 'live',
      actual_start_at: '2026-07-27T10:05:00Z',
    }),
    block({ block_id: 'b', label: 'Reception', start_at: '2026-07-27T12:00:00Z' }),
  ];
  const action = nextAdvanceAction(blocks, NOW);
  assert.equal(action.kind, 'finish');
  assert.equal(action.kind === 'finish' && action.blockId, 'a');
  assert.equal(action.kind === 'finish' && action.nextLabel, 'Reception',
    'the coordinator needs to know what they are about to call');
});

test('finishing the LAST block reports no next — the button must not promise one', () => {
  const blocks = [
    block({ block_id: 'a', run_state: 'done' }),
    block({
      block_id: 'b', label: 'Send-off', run_state: 'live',
      actual_start_at: '2026-07-27T10:05:00Z',
    }),
  ];
  const action = nextAdvanceAction(blocks, NOW);
  assert.equal(action.kind === 'finish' && action.nextLabel, null);
});

test('when every block has run there is nothing to advance', () => {
  const blocks = [block({ block_id: 'a', run_state: 'done' }), block({ block_id: 'b', run_state: 'done' })];
  assert.equal(nextAdvanceAction(blocks, NOW).kind, 'all_done');
});

test('no schedule is "empty", not "all done" — the couple never built one', () => {
  assert.equal(nextAdvanceAction([], NOW).kind, 'empty');
});

test('a finished block never resurfaces as the thing to start', () => {
  // advance_schedule_block never rewinds; the button must not imply it can.
  const blocks = [
    block({ block_id: 'a', label: 'Ceremony', run_state: 'done' }),
    block({ block_id: 'b', label: 'Reception', start_at: '2026-07-27T12:00:00Z' }),
  ];
  const action = nextAdvanceAction(blocks, NOW);
  assert.equal(action.kind === 'start' && action.blockId, 'b');
});

test('remainingBlockCount counts everything not yet done', () => {
  const blocks = [
    block({ block_id: 'a', run_state: 'done' }),
    block({ block_id: 'b', run_state: 'live' }),
    block({ block_id: 'c', run_state: 'upcoming' }),
  ];
  assert.equal(remainingBlockCount(blocks), 2);
  assert.equal(remainingBlockCount([]), 0);
});

// ─── 2. Pushing the schedule ───────────────────────────────────────────────

test('checkRetime accepts the presets the floor actually uses', () => {
  for (const m of RETIME_PRESETS) {
    assert.equal(checkRetime(m).ok, true, `+${m} should be allowed`);
    assert.equal(checkRetime(-m).ok, true, `−${m} should be allowed`);
  }
});

test('checkRetime refuses what computeRetimePatches would THROW on', () => {
  // The pure retime math throws on each of these; catching them here keeps a
  // fat-fingered entry from becoming a 500.
  assert.deepEqual(checkRetime(0), { ok: false, reason: 'zero' });
  assert.deepEqual(checkRetime(1.5), { ok: false, reason: 'not_an_integer' });
  assert.deepEqual(checkRetime(MAX_RETIME_MINUTES + 1), { ok: false, reason: 'too_large' });
  assert.deepEqual(checkRetime(-(MAX_RETIME_MINUTES + 1)), { ok: false, reason: 'too_large' });
  assert.deepEqual(checkRetime('30' as unknown), { ok: false, reason: 'not_an_integer' });
  assert.deepEqual(checkRetime(NaN), { ok: false, reason: 'not_an_integer' });
  assert.deepEqual(checkRetime(undefined), { ok: false, reason: 'not_an_integer' });
});

test('checkRetime allows exactly the boundary, not past it', () => {
  assert.equal(checkRetime(MAX_RETIME_MINUTES).ok, true);
  assert.equal(checkRetime(-MAX_RETIME_MINUTES).ok, true);
});

// ─── 3. Scanning ───────────────────────────────────────────────────────────

test('a guest card, a table sign and noise classify differently', () => {
  const guest = classifyScan('a'.repeat(32));
  assert.equal(guest.kind, 'guest');
  assert.equal(guest.kind === 'guest' && guest.token, 'a'.repeat(32));

  assert.equal(classifyScan('S89T-ABCDEFGHJK').kind, 'table');
  assert.equal(classifyScan('https://example.com/nope').kind, 'unreadable');
  assert.equal(classifyScan('').kind, 'unreadable');
  assert.equal(classifyScan(null).kind, 'unreadable');
  assert.equal(classifyScan(undefined).kind, 'unreadable');
});

test('scanning a TABLE sign says so — it is not a failed guest scan', () => {
  const out = resolveSeatScan({ kind: 'table', ref: 'S89T-ABCDEFGHJK' }, null);
  assert.equal(out.kind, 'table_sign',
    'otherwise the coordinator goes hunting for a camera problem that does not exist');
});

test('a guest who is seated resolves to their table', () => {
  const scan: ScanKind = { kind: 'guest', token: 'x'.repeat(32) };
  const out = resolveSeatScan(scan, { found: true, tableLabel: 'Table 4' });
  assert.deepEqual(out, { kind: 'seated', tableLabel: 'Table 4' });
});

test('"no seat yet" and "wrong event" stay distinct — they need different people', () => {
  const scan: ScanKind = { kind: 'guest', token: 'x'.repeat(32) };
  // On the list, no seat on the published plan → the seating plan fixes it.
  assert.equal(resolveSeatScan(scan, { found: true, tableLabel: null }).kind, 'unseated');
  assert.equal(resolveSeatScan(scan, { found: true, tableLabel: '   ' }).kind, 'unseated',
    'a blank label is no label');
  // Not on this event's list at all → the couple fixes it.
  assert.equal(resolveSeatScan(scan, { found: false }).kind, 'not_this_event');
  assert.equal(resolveSeatScan(scan, null).kind, 'not_this_event',
    'a failed lookup must never read as "seated"');
});

test('an unreadable scan never reaches a lookup verdict', () => {
  assert.equal(resolveSeatScan({ kind: 'unreadable' }, { found: true, tableLabel: 'T1' }).kind,
    'unreadable');
});

// ─── 4. The surface model ──────────────────────────────────────────────────

/** Everything the host can share, shared. */
const ALL_SHARED: FloorGrants = { seatPlan: 'edit', schedule: 'edit' };
/** Booked, but the host has handed over nothing yet. */
const NONE_SHARED: FloorGrants = { seatPlan: null, schedule: null };

test('BEING BOOKED GRANTS NOTHING — the host must share each area first', () => {
  // Owner ruling 2026-07-27. This is the load-bearing test on this surface: a
  // coordinator with a booking and no host grant gets no floor powers at all.
  const m = buildFloorCommand({
    blocks: [block({ block_id: 'a' })],
    grants: NONE_SHARED,
    seatingPublished: true,
    requestsActive: true,
    now: NOW,
  });
  assert.equal(m.schedule.state, 'unavailable');
  assert.equal(m.schedule.reason, 'not_shared');
  assert.equal(m.seatFinder.state, 'unavailable');
  assert.equal(m.seatFinder.reason, 'not_shared');
  assert.equal(m.qrKit.state, 'unavailable');
  assert.equal(m.needsHostAccess, true, 'so the surface can offer "ask the host"');
});

test('the host can share ONE area without opening the others', () => {
  const m = buildFloorCommand({
    blocks: [block({ block_id: 'a' })],
    grants: { seatPlan: 'view', schedule: null },
    seatingPublished: true,
    requestsActive: true,
    now: NOW,
  });
  assert.equal(m.seatFinder.state, 'ready', 'view is enough to look a seat up');
  assert.equal(m.schedule.state, 'unavailable');
  assert.equal(m.schedule.reason, 'not_shared');
  assert.equal(m.needsHostAccess, true, 'still one area short');
});

test('VIEW on the schedule is not enough to ACT on it', () => {
  const m = buildFloorCommand({
    blocks: [block({ block_id: 'a' })],
    grants: { seatPlan: null, schedule: 'view' },
    seatingPublished: true,
    requestsActive: true,
    now: NOW,
  });
  assert.equal(m.schedule.state, 'unavailable',
    'advancing and retiming are writes — read-only access must not offer them');
  assert.equal(m.schedule.reason, 'not_shared');
});

test('with everything shared and nothing missing, no access errand is offered', () => {
  const m = buildFloorCommand({
    blocks: [block({ block_id: 'a' })],
    grants: ALL_SHARED,
    seatingPublished: true,
    requestsActive: true,
    now: NOW,
  });
  assert.equal(m.needsHostAccess, false);
  assert.equal(m.schedule.state, 'ready');
  assert.equal(m.seatFinder.state, 'ready');
});

test('a missing host grant is reported BEFORE an unpublished plan', () => {
  // Both are true here. The coordinator can do something about the first and
  // nothing about the second, so the first is the one worth telling them.
  const m = buildFloorCommand({
    blocks: [], grants: NONE_SHARED, seatingPublished: false, requestsActive: true, now: NOW,
  });
  assert.equal(m.seatFinder.reason, 'not_shared',
    '"the plan isn’t published" would send them to the wrong person');
});

test('an unpublished seat plan closes BOTH seat panels, with a named reason', () => {
  const m = buildFloorCommand({
    blocks: [], grants: ALL_SHARED, seatingPublished: false, requestsActive: true, now: NOW,
  });
  assert.equal(m.seatFinder.state, 'unavailable');
  assert.equal(m.seatFinder.reason, 'not_published');
  assert.equal(m.qrKit.state, 'unavailable');
  assert.equal(m.qrKit.reason, 'not_published');
});

test('the dark requests control closes only the inbox', () => {
  const m = buildFloorCommand({
    blocks: [block({ block_id: 'a' })],
    grants: ALL_SHARED,
    seatingPublished: true,
    requestsActive: false,
    now: NOW,
  });
  assert.equal(m.requests.state, 'unavailable', 'one control, one panel — it must not close the others');
  assert.equal(m.requests.reason, 'control_off');
  assert.equal(m.seatFinder.state, 'ready');
  assert.equal(m.schedule.state, 'ready');
});

test('an empty schedule closes the schedule panel rather than showing a dead button', () => {
  const m = buildFloorCommand({
    blocks: [], grants: ALL_SHARED, seatingPublished: true, requestsActive: true, now: NOW,
  });
  assert.equal(m.schedule.state, 'unavailable');
  assert.equal(m.schedule.reason, 'no_schedule');
  assert.equal(m.schedule.action.kind, 'empty');
  assert.equal(m.schedule.remaining, 0);
});

// ─── 5. Asking the host for access ─────────────────────────────────────────

test('the floor can only ask for floor areas — never the budget', () => {
  // Asking wide is a privacy cost with no operational benefit; a day-of ask
  // must not put the couple's budget in front of a host to hand over.
  assert.deepEqual([...FLOOR_REQUESTABLE_AREAS], ['seat_plan', 'schedule', 'guest_list', 'vendors']);
  assert.deepEqual(normalizeRequestedAreas(['budget', 'mood_board']), [],
    'neither is a floor tool');
});

test('an ask drops what the coordinator already holds', () => {
  const out = normalizeRequestedAreas(['seat_plan', 'schedule'], { seat_plan: 'view' });
  assert.deepEqual(out, ['schedule'], 'asking for what you have wastes the host’s attention');
});

test('an ask is deduped and comes back in catalogue order', () => {
  const out = normalizeRequestedAreas(['schedule', 'seat_plan', 'schedule', 'nonsense']);
  assert.deepEqual(out, ['seat_plan', 'schedule'], 'two identical asks must look identical');
});

test('an empty or junk ask normalizes to nothing rather than everything', () => {
  assert.deepEqual(normalizeRequestedAreas([]), []);
  assert.deepEqual(normalizeRequestedAreas(null), []);
  assert.deepEqual(normalizeRequestedAreas(undefined), []);
  assert.deepEqual(normalizeRequestedAreas(['../etc/passwd']), []);
});

test('only the schedule is granted EDIT — everything else is read-only', () => {
  assert.equal(grantLevelFor('schedule'), 'edit', 'advance and retime are writes');
  assert.equal(grantLevelFor('seat_plan'), 'view');
  assert.equal(grantLevelFor('guest_list'), 'view');
  assert.equal(grantLevelFor('vendors'), 'view');
});

test('a partial yes is reported as partial, never as a full yes', () => {
  const asked: DelegateArea[] = ['seat_plan', 'schedule'];
  assert.equal(summarizeDecisions(asked, { seat_plan: 'granted', schedule: 'granted' }), 'all_granted');
  assert.equal(summarizeDecisions(asked, { seat_plan: 'granted', schedule: 'declined' }), 'partly_granted');
  assert.equal(summarizeDecisions(asked, { seat_plan: 'declined', schedule: 'declined' }), 'all_declined');
  assert.equal(summarizeDecisions(asked, { seat_plan: 'granted' }), 'partly_granted',
    'one line still open is not "you have everything"');
});

test('an unanswered ask is unanswered, not declined', () => {
  const asked: DelegateArea[] = ['seat_plan'];
  assert.equal(summarizeDecisions(asked, {}), 'unanswered');
  assert.equal(summarizeDecisions(asked, null), 'unanswered');
  assert.equal(summarizeDecisions([], { seat_plan: 'granted' }), 'unanswered');
});

test('the model surfaces running-late drift from the live block', () => {
  const m = buildFloorCommand({
    blocks: [
      block({
        block_id: 'a', run_state: 'live',
        // 10 AM at the VENUE is 02:00Z. `start_at` is the wall clock; the
        // stamp written when someone presses Start is a real instant. Twelve
        // minutes late is 02:12Z, not 10:12Z — writing 10:12Z here is exactly
        // the mix-up that reported every on-time wedding as 8 hours behind.
        start_at: '2026-07-27T10:00:00Z',
        actual_start_at: '2026-07-27T02:12:00Z',
      }),
    ],
    grants: ALL_SHARED,
    seatingPublished: true,
    requestsActive: true,
    now: NOW,
  });
  assert.equal(m.schedule.driftMinutes, 12, 'started 12 minutes late');
  assert.equal(m.schedule.remaining, 1);
});
