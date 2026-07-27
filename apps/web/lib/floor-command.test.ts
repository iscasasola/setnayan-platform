/**
 * Floor command (coordinator day-of desk) — the decision tests.
 *
 * `buildFloorCommand()` crosses two facts that already ship separately — open
 * work (`lib/day-requests.ts`) and where the run of show actually is
 * (`lib/run-of-show.ts`). The cross is the whole contribution, so these tests
 * carry it.
 *
 *   1. LATE + UNRESOLVED IS THE ONE STATE THAT SAYS STOP. Running behind is
 *      when pushing is most tempting and most expensive: every open request is
 *      a supplier waiting on an answer. Lateness must RAISE the bar for
 *      advancing, not lower it.
 *   2. STATUS PINGS ARE NOT WORK. A supplier saying "we've arrived" must never
 *      hold the floor. This reuses the shipped `countsAsOpenWork`, and the
 *      tests assert the shipped meaning rather than restating it.
 *   3. EVERY STATE GETS A REAL SENTENCE. No blank headline on any path,
 *      including no timeline at all.
 *   4. THE ADVANCE POINTER IS HONEST. `canAdvanceNow` / `advanceBlockId` track
 *      the live block, never the clock, and are null when there is nothing to
 *      advance.
 *
 * ── NEUTRALISATION CHECKS (2026-07-27) ─────────────────────────────────────
 *
 * Run by editing the source, observing the failure, reverting:
 *
 *   • Dropping the `s.behind && s.openWork > 0` arm from `pickAdvice` (so a
 *     late floor with open work reads `clear_to_advance`) fails exactly 3 of
 *     15 and nothing else: "late AND unresolved", "the behind threshold is a
 *     real boundary", and "the open-work sentence is singular" (which asserts
 *     the headline only that arm produces). 12 pass. That is the proof the
 *     CROSS is what these hold — neither fact alone moves them.
 *
 * The "status pings are not work" pair is pinned differently, and deliberately:
 * it asserts against the SHIPPED `countsAsOpenWork` rather than a local copy,
 * so if `lib/day-requests.ts` ever changes what counts as work, these fail here
 * too. Neutralising that would mean editing a shipped module, which is why it
 * is pinned by reuse rather than by a local switch.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFloorCommand,
  openWorkRows,
  BEHIND_THRESHOLD_MINUTES,
} from './floor-command';
import type { DayRequestRow } from './day-requests';
import type { RunOfShowBlock } from './run-of-show';

const NOW = new Date('2026-07-27T16:00:00Z');

function row(over: Partial<DayRequestRow> & { request_id: string }): DayRequestRow {
  return {
    origin: 'vendor',
    kind: 'issue',
    status: 'open',
    body: 'Something needs a decision',
    preset_key: null,
    author_user_id: null,
    author_vendor_profile_id: null,
    created_at: '2026-07-27T15:00:00Z',
    ...over,
  };
}

function block(over: Partial<RunOfShowBlock> & { block_id: string }): RunOfShowBlock {
  return {
    label: `Block ${over.block_id}`,
    start_at: '2026-07-27T16:00:00Z',
    end_at: null,
    location: null,
    run_state: 'upcoming',
    actual_start_at: null,
    ...over,
  };
}

/** A live block that started `mins` late. */
function liveLate(mins: number, id = 'b1') {
  return block({
    block_id: id,
    label: 'Reception',
    run_state: 'live',
    start_at: '2026-07-27T15:00:00Z',
    actual_start_at: new Date(Date.parse('2026-07-27T15:00:00Z') + mins * 60000).toISOString(),
  });
}

// ── 1 · THE CROSS: late + unresolved says stop ─────────────────────────────

test('late AND unresolved → clear the work before pushing', () => {
  const m = buildFloorCommand({
    rows: [row({ request_id: 'r1' }), row({ request_id: 'r2' })],
    blocks: [liveLate(20)],
    now: NOW,
  });
  assert.equal(m.advice, 'clear_work_first');
  assert.equal(m.behind, true);
  assert.equal(m.openWork, 2);
  assert.match(m.headline, /clear these before you push/);
});

test('late but NOTHING open → clear to advance (lateness alone does not block)', () => {
  const m = buildFloorCommand({ rows: [], blocks: [liveLate(20)], now: NOW });
  assert.equal(m.advice, 'clear_to_advance');
  assert.equal(m.behind, true, 'still reported as behind');
  assert.equal(m.openWork, 0);
});

test('open work but ON TIME → clear to advance (work alone does not block)', () => {
  const m = buildFloorCommand({
    rows: [row({ request_id: 'r1' })],
    blocks: [liveLate(0)],
    now: NOW,
  });
  assert.equal(m.advice, 'clear_to_advance');
  assert.equal(m.behind, false);
  assert.equal(m.openWork, 1);
});

test('the behind threshold is a real boundary, not decoration', () => {
  const under = buildFloorCommand({
    rows: [row({ request_id: 'r1' })],
    blocks: [liveLate(BEHIND_THRESHOLD_MINUTES - 1)],
    now: NOW,
  });
  const at = buildFloorCommand({
    rows: [row({ request_id: 'r1' })],
    blocks: [liveLate(BEHIND_THRESHOLD_MINUTES)],
    now: NOW,
  });
  assert.equal(under.advice, 'clear_to_advance');
  assert.equal(at.advice, 'clear_work_first');
});

// ── 2 · Status pings are not work ──────────────────────────────────────────

test('a status ping is never work, even while unresolved', () => {
  const m = buildFloorCommand({
    rows: [row({ request_id: 's1', kind: 'status_update', status: 'open' })],
    blocks: [liveLate(30)],
    now: NOW,
  });
  assert.equal(m.openWork, 0);
  assert.equal(m.statusUpdates, 1);
});

test('pings alone never block the floor, however late it is', () => {
  const m = buildFloorCommand({
    rows: [
      row({ request_id: 's1', kind: 'status_update' }),
      row({ request_id: 's2', kind: 'status_update' }),
    ],
    blocks: [liveLate(45)],
    now: NOW,
  });
  assert.equal(m.advice, 'clear_to_advance');
});

test('a resolved issue stops counting', () => {
  const m = buildFloorCommand({
    rows: [row({ request_id: 'r1', status: 'resolved' })],
    blocks: [liveLate(20)],
    now: NOW,
  });
  assert.equal(m.openWork, 0);
  assert.equal(m.advice, 'clear_to_advance');
});

test('openWorkRows agrees with the badge count, always', () => {
  const rows = [
    row({ request_id: 'a' }),
    row({ request_id: 'b', status: 'acknowledged' }),
    row({ request_id: 'c', status: 'resolved' }),
    row({ request_id: 'd', kind: 'status_update' }),
  ];
  const m = buildFloorCommand({ rows, blocks: [liveLate(0)], now: NOW });
  assert.equal(openWorkRows(rows).length, m.openWork);
});

// ── 3 · Every state gets a real sentence ───────────────────────────────────

test('phases: no timeline · not started · holding · wrapped', () => {
  assert.equal(buildFloorCommand({ rows: [], blocks: [], now: NOW }).advice, 'no_timeline');

  assert.equal(
    buildFloorCommand({ rows: [], blocks: [block({ block_id: 'x' })], now: NOW }).advice,
    'not_started',
  );

  assert.equal(
    buildFloorCommand({
      rows: [],
      blocks: [block({ block_id: 'x', run_state: 'done' })],
      now: NOW,
    }).advice,
    'wrapped',
  );

  // One done, one upcoming, nothing live → the gap between moments.
  assert.equal(
    buildFloorCommand({
      rows: [],
      blocks: [
        block({ block_id: 'a', run_state: 'done' }),
        block({ block_id: 'b', run_state: 'upcoming', start_at: '2026-07-27T17:00:00Z' }),
      ],
      now: NOW,
    }).advice,
    'holding',
  );
});

test('no advice path returns a blank headline', () => {
  const cases: RunOfShowBlock[][] = [
    [],
    [block({ block_id: 'x' })],
    [block({ block_id: 'x', run_state: 'done' })],
    [liveLate(0)],
    [liveLate(30)],
    [
      block({ block_id: 'a', run_state: 'done' }),
      block({ block_id: 'b', run_state: 'upcoming', start_at: '2026-07-27T17:00:00Z' }),
    ],
  ];
  for (const blocks of cases) {
    for (const rows of [[], [row({ request_id: 'r' })]]) {
      const h = buildFloorCommand({ rows, blocks, now: NOW }).headline;
      assert.equal(typeof h, 'string');
      assert.ok(h.trim().length > 0);
    }
  }
});

test('the open-work sentence is singular for one', () => {
  const m = buildFloorCommand({
    rows: [row({ request_id: 'r1' })],
    blocks: [liveLate(20)],
    now: NOW,
  });
  assert.match(m.headline, /1 thing still open/);
});

// ── 4 · The advance pointer is honest ──────────────────────────────────────

test('advance points at the LIVE block, and is null when nothing is live', () => {
  const live = buildFloorCommand({ rows: [], blocks: [liveLate(0, 'target')], now: NOW });
  assert.equal(live.canAdvanceNow, true);
  assert.equal(live.advanceBlockId, 'target');
  assert.equal(live.advanceMovesOthers, true);

  const idle = buildFloorCommand({ rows: [], blocks: [block({ block_id: 'x' })], now: NOW });
  assert.equal(idle.canAdvanceNow, false);
  assert.equal(idle.advanceBlockId, null);
  assert.equal(idle.advanceMovesOthers, false);
});

test('run-state decides what is live, not the wall clock', () => {
  // Planned for hours later, but advanced — it is live.
  const m = buildFloorCommand({
    rows: [],
    blocks: [block({ block_id: 'late', label: 'Send-off', start_at: '2026-07-27T23:00:00Z', run_state: 'live' })],
    now: NOW,
  });
  assert.equal(m.currentLabel, 'Send-off');
  assert.equal(m.canAdvanceNow, true);

  // Move the clock four hours — the pointer is unchanged, so the model is too.
  const later = buildFloorCommand({
    rows: [],
    blocks: [block({ block_id: 'late', label: 'Send-off', start_at: '2026-07-27T23:00:00Z', run_state: 'live' })],
    now: new Date('2026-07-27T20:00:00Z'),
  });
  assert.equal(later.currentLabel, 'Send-off');
});

test('a wrapped show cannot advance', () => {
  const m = buildFloorCommand({
    rows: [row({ request_id: 'r' })],
    blocks: [block({ block_id: 'x', run_state: 'done' })],
    now: NOW,
  });
  assert.equal(m.canAdvanceNow, false);
  assert.equal(m.advanceBlockId, null);
  assert.equal(m.advice, 'wrapped');
});

test('an unknown origin is counted but never crashes the model', () => {
  const weird = { ...row({ request_id: 'w' }), origin: 'future_lane' } as unknown as DayRequestRow;
  const m = buildFloorCommand({ rows: [weird], blocks: [liveLate(0)], now: NOW });
  assert.equal(m.openWork, 1);
});
