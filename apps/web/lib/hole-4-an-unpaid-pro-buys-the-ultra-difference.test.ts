/**
 * HOLE 4 · AN UNPAID EVENT PRO BUYS THE ULTRA "PAY THE DIFFERENCE" CREDIT — PROVEN OPEN
 * (controller sweep 2026-11-16).
 *
 * TESTS ONLY. Every assertion below PASSES WHILE THE HOLE IS OPEN. The fix PR
 * flips each `HOLE OPEN` assertion to its closed form and renames the file.
 *
 * The walk:
 *   1 · order Event Pro and do not pay — the order sits 'submitted' / 'awaiting_payment';
 *   2 · `readUltraUpgradeCharge` decides `proPaid` with `orderStatusConfersOwnership`
 *       — the BUY-SURFACE rule ("anything not in RELINQUISHED_STATUSES"), which
 *       counts an unpaid order — so the Ultra charge is sealed at Ultra minus Pro;
 *   3 · cancel the unpaid Pro — `cancelOrder` allows it (a pre-payment status),
 *       and nothing re-prices the Ultra order already sealed at the difference.
 * The couple keeps a credit for money they never paid.
 *
 * Prices here are SAMPLE numbers fed to the pure function; real prices are only
 * ever read from `platform_retail_catalog_v2`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { ultraUpgradeCharge } from '@/lib/event-ultra';
import { orderStatusConfersAccess, orderStatusConfersOwnership, RELINQUISHED_STATUSES } from '@/lib/entitlements';
import { CANCELLABLE_ORDER_STATUSES } from '@/lib/event-deletion-gate';
import { stripComments } from '@/lib/strip-comments';

const HERE = import.meta.dirname;
const read = (rel: string) => stripComments(readFileSync(path.join(HERE, '..', rel), 'utf8'));

const SAMPLE = { ultraPhp: 10_000, proPhp: 6_000, plusPhp: 3_000 };
const UNPAID = ['submitted', 'awaiting_payment'] as const;

function ultraReaderBody(): string {
  const src = read('lib/order-charge-authority.ts');
  const at = src.indexOf('export async function readUltraUpgradeCharge');
  assert.ok(at >= 0, 'readUltraUpgradeCharge is gone — re-read the hole before trusting this file');
  return src.slice(at, at + 2500);
}

test('HOLE OPEN · 4a — an unpaid Pro order counts as a paid plan for the Ultra credit', () => {
  for (const s of UNPAID) {
    assert.equal(orderStatusConfersAccess(s), false, `precondition: '${s}' is not paid (the feature gate agrees)`);
    // HOLE OPEN: the credit reader uses the ownership rule, which counts '${s}'. Fix flips to: false.
    assert.equal(orderStatusConfersOwnership(s), true, `'${s}' confers ownership — and so the credit`);
    assert.ok(!RELINQUISHED_STATUSES.has(s));
  }
  const body = ultraReaderBody();
  // HOLE OPEN: `proPaid` / `plusPaid` are decided by the ownership rule. Fix flips to the paid (access) rule.
  assert.match(body, /orderStatusConfersOwnership\(r\.status\)/, 'readUltraUpgradeCharge reads "paid" as "not relinquished"');
  assert.doesNotMatch(body, /orderStatusConfersAccess/, 'readUltraUpgradeCharge does not ask whether the plan was paid');
  // `paidTowardProPhp` comes from the same buy-surface ('owned') rule.
  assert.match(body, /eventHubOwnership\(admin, eventId, 'owned'\)/);

  const charge = ultraUpgradeCharge({
    ...SAMPLE,
    proPaid: orderStatusConfersOwnership('submitted'),
    plusPaid: false,
    paidTowardProPhp: 0,
  });
  assert.deepEqual(
    charge,
    { ok: true, php: 4_000, creditPhp: 6_000, from: 'pro' },
    'Ultra is charged at the difference from a Pro that was never paid',
  );
});

test('HOLE OPEN · 4b — the unpaid Pro can then be cancelled, and nothing takes the sealed credit back', () => {
  for (const s of UNPAID) {
    assert.ok(
      (CANCELLABLE_ORDER_STATUSES as readonly string[]).includes(s),
      `the couple may cancel a '${s}' Pro (cancelOrder's own allow-list)`,
    );
  }
  // The Ultra charge is sealed once, at order time, from the difference.
  assert.match(read('lib/order-charge-authority.ts'), /sealServerResolvedTotal\(upgrade\.charge\.php \* 100, 'event_ultra_upgrade'\)/);

  // HOLE OPEN: the cancel path does not look at Ultra at all. Fix: a cancel (or the Ultra approval) re-checks the credit.
  const cancel = read('app/dashboard/[eventId]/orders/actions.ts');
  const at = cancel.indexOf('export async function cancelOrder');
  const end = cancel.indexOf('export async function', at + 10);
  const cancelBody = cancel.slice(at, end > at ? end : undefined);
  assert.ok(at >= 0, 'cancelOrder is gone — re-read the hole');
  assert.doesNotMatch(cancelBody, /ULTRA|Ultra|readUltraUpgradeCharge|event_ultra_upgrade/);

  // Nothing else in the tree reads the Ultra upgrade outside the charge and the drawer's quote.
  for (const rel of ['lib/sku-activation.ts', 'app/admin/payments/actions.ts']) {
    assert.doesNotMatch(read(rel), /readUltraUpgradeCharge|event_ultra_upgrade/, `${rel} re-checks the Ultra credit`);
  }

  // After the cancel, the same reader would give no credit — proving the credit was only ever the unpaid order.
  assert.equal(orderStatusConfersOwnership('cancelled'), false);
  assert.equal(
    ultraUpgradeCharge({ ...SAMPLE, proPaid: orderStatusConfersOwnership('cancelled'), plusPaid: false, paidTowardProPhp: 0 }),
    null,
  );
});
