/**
 * deposit-acknowledged-effects.test.ts — every outcome of the acknowledge
 * moment is judged, and every wrong one carries its reason.
 *
 * The 2026-09-18 miss was a `{status:'skipped', reason}` whose reason was read
 * for one value and thrown away for all the others — and then, one door over,
 * not even attempted. This exercises the judge over the WHOLE outcome space so
 * neither can happen quietly again: the expected shapes are OK, everything
 * else is `attention`, and the summary must contain the reason text itself.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FEE_SETTLED_STATUSES,
  POOL_SETTLED_STATUSES,
  judgeDepositEffects,
  type DepositEffectsOutcome,
} from './deposit-acknowledged-effects';

const base = (over: Partial<DepositEffectsOutcome> = {}): DepositEffectsOutcome => ({
  door: 'payment_card',
  eventVendorId: 'ev-1',
  eventId: 'event-1',
  acknowledged: true,
  anchorId: 'ev-1',
  feeEnabled: true,
  fee: { status: 'free', chargeId: 'c-1', bookingOrdinal: 1 },
  pool: { status: 'ok' },
  thrown: null,
  ...over,
});

test('the expected shapes are OK — a waived first booking is the rule working, not a fault', () => {
  let cases = 0;
  for (const fee of FEE_SETTLED_STATUSES) {
    for (const pool of POOL_SETTLED_STATUSES) {
      const v = judgeDepositEffects(base({ fee: { status: fee, chargeId: 'c' }, pool: { status: pool } }));
      assert.equal(v.level, 'ok', `${fee} × ${pool} should be OK: ${v.summary}`);
      assert.match(v.summary, / — OK$/);
      assert.ok(v.summary.includes(`fee=${fee}`), v.summary);
      assert.ok(v.summary.includes(`pool=${pool}`), v.summary);
      cases++;
    }
  }
  assert.ok(cases >= 12, `only ${cases} settled combinations judged — the sets shrank`);
});

test('with the fee flag OFF, no fee attempt is fine and the line says "off"', () => {
  const v = judgeDepositEffects(base({ feeEnabled: false, fee: null }));
  assert.equal(v.level, 'ok', v.summary);
  assert.ok(v.summary.includes('fee=off'), v.summary);
});

test('a skipped fee is ATTENTION and the summary carries the collector\'s reason verbatim', () => {
  const reasons = [
    'not_contracted',
    'not_verified_vendor',
    'covered_row_no_fee',
    'rpc_null',
    'order_insert_failed',
    'permission denied for function booking_fee_open_lock_charge',
  ];
  for (const reason of reasons) {
    const v = judgeDepositEffects(base({ fee: { status: 'skipped', reason } }));
    assert.equal(v.level, 'attention', v.summary);
    assert.ok(v.summary.includes(reason), `reason "${reason}" missing from: ${v.summary}`);
    assert.ok(v.summary.includes('ATTENTION'), v.summary);
  }
  // A skip with NO reason still says so — "skipped" alone is the bug this exists to end.
  const bare = judgeDepositEffects(base({ fee: { status: 'skipped' } }));
  assert.equal(bare.level, 'attention');
  assert.ok(bare.summary.includes('no reason given'), bare.summary);
});

test('the other non-settled fee shapes are ATTENTION with a named cause', () => {
  const noPayer = judgeDepositEffects(base({ fee: { status: 'no_payer', chargeId: 'c-9' } }));
  assert.equal(noPayer.level, 'attention');
  assert.ok(noPayer.summary.includes('no payer') && noPayer.summary.includes('c-9'), noPayer.summary);

  const disabledWhileOn = judgeDepositEffects(base({ fee: { status: 'disabled' } }));
  assert.equal(disabledWhileOn.level, 'attention');
  assert.ok(disabledWhileOn.summary.includes('disabled while the flag is on'), disabledWhileOn.summary);

  const neverAttempted = judgeDepositEffects(base({ fee: null }));
  assert.equal(neverAttempted.level, 'attention');
  assert.ok(neverAttempted.summary.includes('fee never attempted'), neverAttempted.summary);

  const unknown = judgeDepositEffects(base({ fee: { status: 'something_new' } }));
  assert.equal(unknown.level, 'attention');
  assert.ok(unknown.summary.includes('something_new'), unknown.summary);
});

test('a pool that did not settle is ATTENTION, naming the status, label and message', () => {
  for (const status of ['full', 'blocked', 'locked', 'whitelist', 'not_authorized', 'error']) {
    const v = judgeDepositEffects(
      base({ pool: { status, poolLabel: 'Band · Saturday', message: status === 'error' ? 'boom' : undefined } }),
    );
    assert.equal(v.level, 'attention', v.summary);
    assert.ok(v.summary.includes(`schedule pool ${status}`), v.summary);
    assert.ok(v.summary.includes('Band · Saturday'), v.summary);
    if (status === 'error') assert.ok(v.summary.includes('boom'), v.summary);
  }
  const never = judgeDepositEffects(base({ pool: null }));
  assert.equal(never.level, 'attention');
  assert.ok(never.summary.includes('schedule pool never attempted'), never.summary);
});

test('a throw, a missing row, an unacknowledged row and a missing money row are each ATTENTION with their own words', () => {
  const thrown = judgeDepositEffects(base({ thrown: 'SUPABASE_SERVICE_ROLE_KEY is required' }));
  assert.equal(thrown.level, 'attention');
  assert.ok(thrown.summary.includes('threw: SUPABASE_SERVICE_ROLE_KEY is required'), thrown.summary);

  const noRow = judgeDepositEffects(base({ eventId: null, acknowledged: false, anchorId: null, fee: null, pool: null }));
  assert.equal(noRow.level, 'attention');
  assert.ok(noRow.summary.includes('booking row not found'), noRow.summary);

  const early = judgeDepositEffects(base({ acknowledged: false, anchorId: null, fee: null, pool: null }));
  assert.equal(early.level, 'attention');
  assert.ok(early.summary.includes('before the acknowledgement landed'), early.summary);

  const noAnchor = judgeDepositEffects(base({ anchorId: null, fee: null, pool: null }));
  assert.equal(noAnchor.level, 'attention');
  assert.ok(noAnchor.summary.includes('no money row resolved'), noAnchor.summary);
});

test('two problems at once are BOTH in the sentence — the first must not hide the second', () => {
  const v = judgeDepositEffects(
    base({ fee: { status: 'skipped', reason: 'rpc_null' }, pool: { status: 'full', poolLabel: 'Host' } }),
  );
  assert.equal(v.level, 'attention');
  assert.ok(v.summary.includes('rpc_null'), v.summary);
  assert.ok(v.summary.includes('schedule pool full'), v.summary);
});

test('the head of every line names the door and the row, so a log search finds one booking', () => {
  const v = judgeDepositEffects(base({ door: 'catch_up', eventVendorId: 'f03c8386', anchorId: 'f03c8386' }));
  assert.ok(v.summary.startsWith('[deposit-acknowledged-effects] door=catch_up event_vendor=f03c8386'), v.summary);
  assert.ok(v.summary.includes('anchor=f03c8386'), v.summary);
});
