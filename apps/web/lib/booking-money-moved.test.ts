/**
 * A recorded deposit is money that moved (AREA-COUPLE, 2026-09-19).
 *
 * The rosa-ben booking — ₱2,000 GCash deposit recorded by the couple and
 * confirmed by the supplier, status still `contracted`, `deposit_paid_php`
 * NULL — was offered "Cancel booking" on the workspace, and the server then
 * refused the cancel. These tests EXECUTE the one shared decision, then pin
 * that both callers use it and that the costing row reads the same "paid so
 * far" figure as the header.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bookingMoneyMoved } from './booking-money-moved';
import { stripComments } from './strip-comments';

const ROSA_BEN = {
  status: 'contracted',
  deposit_paid_php: null,
  deposit_recorded_at: '2026-09-18T12:13:46.403Z',
};

test('a recorded deposit counts, with no deposit_paid_php and status contracted', () => {
  assert.equal(bookingMoneyMoved(ROSA_BEN), true);
});

test('nothing recorded, nothing paid, contracted → a plain cancel is still allowed', () => {
  assert.equal(
    bookingMoneyMoved({ status: 'contracted', deposit_paid_php: null, deposit_recorded_at: null }),
    false,
  );
  assert.equal(
    bookingMoneyMoved({ status: 'contracted', deposit_paid_php: '0.00', deposit_recorded_at: null }),
    false,
  );
});

test('the older two signals still count', () => {
  for (const status of ['deposit_paid', 'delivered', 'complete']) {
    assert.equal(
      bookingMoneyMoved({ status, deposit_paid_php: null, deposit_recorded_at: null }),
      true,
      status,
    );
  }
  assert.equal(
    bookingMoneyMoved({ status: 'contracted', deposit_paid_php: '5000.00', deposit_recorded_at: null }),
    true,
  );
});

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const WORKSPACE = 'app/dashboard/[eventId]/vendors/[vendorId]/workspace/page.tsx';
const ACTIONS = 'app/dashboard/[eventId]/vendors/actions.ts';

function bodyOf(src: string, signature: string): string {
  const at = src.indexOf(signature);
  assert.ok(at >= 0, `missing ${signature}`);
  // Walk braces from the first `{` of the body to its matching `}`.
  const open = src.indexOf('{', src.indexOf(')', at));
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error('unbalanced');
}

test('cancelBookingAsHost gates on the shared helper, reading deposit_recorded_at', () => {
  const body = bodyOf(read(ACTIONS), 'export async function cancelBookingAsHost(');
  const calls = body.match(/bookingMoneyMoved\(/g) ?? [];
  console.log(`cancelBookingAsHost bookingMoneyMoved calls: ${calls.length}`);
  assert.equal(calls.length, 1);
  assert.match(body, /deposit_recorded_at/);
});

test('the workspace picks Cancel vs Dispute with the same helper, BEFORE offering Cancel', () => {
  const src = read(WORKSPACE);
  const helper = src.indexOf('bookingMoneyMoved(ev)');
  const cancel = src.indexOf('<CancelBookingButton');
  console.log(`workspace helper@${helper} cancel@${cancel}`);
  assert.ok(helper > 0 && cancel > helper, 'the money check must come before the cancel button');
  assert.equal((src.match(/bookingMoneyMoved\(ev\)/g) ?? []).length, 1);
});

test('the costing row reads the same "paid so far" figure as the header, not deposit_paid_php', () => {
  const src = read(WORKSPACE);
  const rows = src.match(/Paid so far<\/span>\s*<span[^>]*>\{([^}]*)\}/g) ?? [];
  console.log(`costing paid-so-far rows: ${rows.length}`);
  assert.equal(rows.length, 1);
  assert.match(rows[0], /paidSoFarFormatted/);
  assert.doesNotMatch(src, />Deposit paid</);
});
