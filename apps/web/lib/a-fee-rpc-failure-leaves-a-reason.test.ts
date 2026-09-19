/**
 * a-fee-rpc-failure-leaves-a-reason.test.ts — when a booking-fee RPC fails,
 * the reason is recorded, never dropped.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * S26's both-ends guard flagged three `result-dropped-silently` sites in
 * lib/booking-fee-charge.ts: each read `error` only as a condition and returned
 * a bare null/false. The worst was settle: an RPC failure returned `false`, and
 * the approval hook wrote `settled: false` into the order ledger — the exact
 * value an idempotent no-op on an already-settled charge writes. "The fee is
 * still open on our books" and "nothing to do" were the same row.
 *
 * The contracts are unchanged (open fails OPEN on null, cleared fails CLOSED on
 * false). What changed is that each failure branch now says why, and settle's
 * reason reaches the ledger.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** The body of `export async function <name>(` up to the next top-level export. */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} not found`);
  const next = src.indexOf('\nexport ', start + 1);
  return src.slice(start, next === -1 ? undefined : next);
}

const RPCS = [
  ['openBookingFeeCharge', 'booking_fee_open_charge'],
  ['settleBookingFeeCharge', 'booking_fee_settle_charge'],
  ['isProposalFeeCleared', 'booking_fee_proposal_cleared'],
] as const;

for (const [fn, rpc] of RPCS) {
  test(`${fn}: the ${rpc} error branch records error.message`, () => {
    const body = fnBody(read('lib/booking-fee-charge.ts'), fn);
    assert.match(body, new RegExp(`rpc\\('${rpc}'`), `${fn} no longer calls ${rpc}`);
    const branch = /if \(error\) \{([\s\S]*?)\n  \}/.exec(body)?.[1] ?? '';
    assert.ok(branch.length > 0, `${fn}: no braced \`if (error) {…}\` branch — a one-line return drops the reason`);
    assert.match(branch, /console\.error\(/, `${fn}: the error branch logs nothing`);
    assert.match(branch, /error\.message/, `${fn}: the error branch does not record error.message`);
  });
}

test('settle returns the reason, and the approval hook writes it into the ledger', () => {
  const settle = fnBody(read('lib/booking-fee-charge.ts'), 'settleBookingFeeCharge');
  assert.match(settle, /Promise<SettleChargeResult>/);
  assert.match(settle, /return \{ settled: false, error: /);

  const act = read('lib/sku-activation.ts');
  const at = act.indexOf("settleBookingFeeCharge(ctx.admin, chargeId, 'manual', ctx.orderId)");
  assert.ok(at > 0, 'the booking-fee hook call moved — re-anchor');
  const ledger = act.slice(at, act.indexOf('appendLedger', at) + 600);
  assert.match(ledger, /error: settleError/, 'the hook discards the settle reason');
  assert.match(ledger, /settle_error: settleError/, 'the settle reason never reaches the ledger row');
});
