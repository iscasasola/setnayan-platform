/**
 * 🕵️ BOOKING-FEE DISPUTES — the words and the wiring (DECISION_LOG 2026-07-27 grace-first ladder; owner 2026-11-05
 * "build dispute"). The database half is walked in `tests/db/a-supplier-can-dispute-a-booking-fee.db.test.ts`.
 *
 *   1 · only a clean answer from `booking_fee_open_dispute` is read as one; anything else is `error`, never success;
 *   2 · the first-dispute reminder carries the owner's wording and the count when there is one;
 *   3 · every state line says "event"-plain words and never promises a refund;
 *   4 · both notices are IN-APP ONLY — neither type is on the email list;
 *   5 · the supplier's action reads the bill on their own session before the service-role step; the admin's action
 *       is admin-gated; the page offers the form only on an open bill with no dispute.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  disputeAnsweredNotice,
  disputeOnUsLine,
  disputeOpenedAdminNotice,
  disputeStateLine,
  foundReceiptLine,
  readOpenDisputeAnswer,
} from './booking-fee-dispute';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('1 · only a clean answer is read as one', () => {
  assert.deepEqual(readOpenDisputeAnswer({ result: 'auto_accepted', view_count: 4, first_found_at: '2026-07-12T00:00:00Z' }), {
    kind: 'auto_accepted',
    viewCount: 4,
    firstFoundAt: '2026-07-12T00:00:00Z',
  });
  assert.deepEqual(readOpenDisputeAnswer({ result: 'auto_accepted', view_count: null }), {
    kind: 'auto_accepted',
    viewCount: null,
    firstFoundAt: null,
  });
  assert.deepEqual(readOpenDisputeAnswer({ result: 'under_review' }), { kind: 'under_review' });
  assert.deepEqual(readOpenDisputeAnswer({ result: 'already', status: 'rejected' }), { kind: 'already', status: 'rejected' });
  for (const raw of [null, 'auto_accepted', {}, { result: 'nope' }, { result: 'already', status: 'weird' }, { result: 'not_yours' }]) {
    assert.deepEqual(readOpenDisputeAnswer(raw), { kind: 'error' }, JSON.stringify(raw));
  }
});

test('2 · the first-dispute reminder is the owner\'s wording, with the count when there is one', () => {
  const withCount = disputeOnUsLine(5);
  assert.match(withCount, /^This one's on us\./);
  assert.match(withCount, /viewed your page 5 times before booking/);
  assert.match(withCount, /That's the power and reach of a Setnayan presence: couples find you easier and faster here\./);
  assert.match(withCount, /Future disputes are reviewed by our team\.$/);
  assert.match(disputeOnUsLine(1), /viewed your page once/);
  assert.match(disputeOnUsLine(null), /they found you here before booking/);
});

test('3 · the state lines are plain and promise no refund', () => {
  const lines = [
    disputeStateLine('auto_accepted', 2, null),
    disputeStateLine('under_review', null, null),
    disputeStateLine('accepted', null, 'Checked'),
    disputeStateLine('rejected', null, 'The chat started on Explore'),
    disputeAnsweredNotice({ accepted: true, orderPath: '/x' }).body,
    disputeAnsweredNotice({ accepted: false, orderPath: '/x' }).body,
    disputeOpenedAdminNotice('Lola Catering').body,
    foundReceiptLine('2026-07-11T23:30:00Z', 3),
  ];
  for (const l of lines) {
    assert.doesNotMatch(l, /refund|celebration/i, l);
  }
  assert.match(disputeStateLine('accepted', null, 'Checked'), /waived/);
  assert.match(disputeStateLine('rejected', null, null), /stands/);
  assert.match(foundReceiptLine('2026-07-11T23:30:00Z', 3), /July 12, 2026, 3 times/);
  assert.equal(disputeOpenedAdminNotice(null).title, 'A supplier disputed a booking fee');
});

test('4 · both notices are in-app only', () => {
  const emit = read('lib/notification-emit.ts');
  const start = emit.indexOf('const EMAIL_ENABLED_TYPES');
  assert.ok(start >= 0, 'EMAIL_ENABLED_TYPES moved — re-anchor this test');
  const allow = emit.slice(start, emit.indexOf(']);', start));
  assert.doesNotMatch(allow, /fee_dispute_opened|fee_dispute_answered/, 'no new emails (owner)');
});

test('5 · the wiring: own-session read first, admin-gated decision, the form only on an open undisputed bill', () => {
  const act = read('app/vendor-dashboard/booking-fees/[orderId]/actions.ts');
  const ownRead = act.indexOf('fetchOrderById(supabase, orderId)');
  const step = act.indexOf("rpc('booking_fee_open_dispute'");
  assert.ok(ownRead > 0 && step > ownRead, "the bill is read on the supplier's own session before the step");
  assert.match(act, /order\.user_id !== user\.id/);
  assert.match(act, /type: 'fee_dispute_opened'/);

  const admin = read('app/admin/disputes/actions.ts');
  const fn = admin.slice(admin.indexOf('export async function decideBookingFeeDispute'));
  assert.match(fn, /await requireAdmin\(\)/);
  assert.match(fn, /rpc\('booking_fee_decide_dispute'/);
  assert.match(fn, /type: 'fee_dispute_answered'/);

  const page = read('app/vendor-dashboard/booking-fees/[orderId]/page.tsx');
  assert.match(page, /const canDispute = payable && Boolean\(chargeId\) && dispute === null;/);
  assert.match(page, /\{canDispute \? \(/);
  assert.match(read('app/admin/disputes/page.tsx'), /<BookingFeeDisputesSection /);
});
