/**
 * HOLE 4 · AN UNPAID EVENT PRO CANNOT BUY THE ULTRA "PAY THE DIFFERENCE" CREDIT — CLOSED (controller sweep 2026-11-16;
 * the proof was #7841's `hole-4-an-unpaid-pro-buys-the-ultra-difference.test.ts`, each HOLE OPEN assertion flipped).
 *
 * Owner, specs DECISION_LOG 2026-11-13 "EVENT ULTRA UPGRADE — PAY THE DIFFERENCE": "An event that already PAID Event
 * Plus or Event Pro pays Ultra price MINUS what it already paid".
 *
 * The walk that was open: order Event Pro and do not pay ('submitted' / 'awaiting_payment') → `readUltraUpgradeCharge`
 * counted it with the BUY-SURFACE rule (`orderStatusConfersOwnership`) → Ultra sealed at Ultra minus Pro → cancel the
 * unpaid Pro → a credit for money never paid.
 *
 * The fix (lib/order-charge-authority.ts): `readUltraUpgradeCharge` counts a Plus / Pro order only in a PAID status
 * (`orderStatusConfersAccess`), and reads what was paid toward Pro in the feature-gate mode
 * (`eventHubOwnership(…, 'active')`). An unpaid Pro earns no credit, so Ultra is sealed at its own row price and a
 * later cancel of the Pro takes nothing back — there is nothing to take.
 *
 * Prices here are SAMPLE numbers fed to the pure function; real prices are only ever read from
 * `platform_retail_catalog_v2`. Limit (unchanged from #7841): the reader's catalogue read builds its own service-role
 * client, so this is shown from the pure pieces and a source scan, not an end-to-end call.
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

test('CLOSED · 4a — an unpaid Pro order does not count as a paid plan for the Ultra credit', () => {
  for (const s of UNPAID) {
    assert.equal(orderStatusConfersAccess(s), false, `precondition: '${s}' is not paid (the feature gate agrees)`);
    // The buy-surface rule still counts '${s}' (so nobody is asked to pay twice mid-review) — but the credit no longer
    // reads that rule.
    assert.equal(orderStatusConfersOwnership(s), true);
    assert.ok(!RELINQUISHED_STATUSES.has(s));
  }
  const body = ultraReaderBody();
  // CLOSED (was HOLE OPEN): `proPaid` / `plusPaid` are decided by the PAID (access) rule.
  assert.match(body, /orderStatusConfersAccess\(r\.status\)/, 'readUltraUpgradeCharge asks whether the plan was paid');
  assert.doesNotMatch(body, /orderStatusConfersOwnership\(r\.status\)/, 'readUltraUpgradeCharge reads "paid" as "not relinquished"');
  // CLOSED: `paidTowardProPhp` comes from the feature-gate ('active') mode, not the buy surface ('owned').
  assert.match(body, /eventHubOwnership\(admin, eventId, 'active'\)/);
  assert.doesNotMatch(body, /eventHubOwnership\(admin, eventId, 'owned'\)/);

  for (const s of UNPAID) {
    // What the reader now hands the pure function for an unpaid Pro: no credit at all → Ultra's row price applies.
    assert.equal(
      ultraUpgradeCharge({ ...SAMPLE, proPaid: orderStatusConfersAccess(s), plusPaid: false, paidTowardProPhp: 0 }),
      null,
      `an unpaid ('${s}') Pro gives no Ultra credit`,
    );
  }
  // Control: a PAID Pro still gets the owner's difference.
  assert.deepEqual(
    ultraUpgradeCharge({ ...SAMPLE, proPaid: orderStatusConfersAccess('paid'), plusPaid: false, paidTowardProPhp: 0 }),
    { ok: true, php: 4_000, creditPhp: 6_000, from: 'pro' },
    'a paid Pro still pays only the difference',
  );
});

test('CLOSED · 4b — cancelling an unpaid Pro takes nothing back, because no credit was ever sealed from it', () => {
  for (const s of UNPAID) {
    assert.ok(
      (CANCELLABLE_ORDER_STATUSES as readonly string[]).includes(s),
      `the couple may cancel a '${s}' Pro (cancelOrder's own allow-list)`,
    );
  }
  // The Ultra charge is sealed once, at order time, from the difference.
  assert.match(read('lib/order-charge-authority.ts'), /sealServerResolvedTotal\(upgrade\.charge\.php \* 100, 'event_ultra_upgrade'\)/);

  // CLOSED by the seal, not the cancel: the cancel path still does not look at Ultra (asserted below, unchanged), and it
  // need not — only a PAID Pro or Plus can reach the difference seal, and a paid order is not in the couple's
  // cancellable list (asserted next).
  for (const s of ['paid', 'fulfilled']) {
    assert.ok(!(CANCELLABLE_ORDER_STATUSES as readonly string[]).includes(s), `a '${s}' order cannot be cancelled by the couple`);
    assert.equal(orderStatusConfersAccess(s), true);
  }
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
