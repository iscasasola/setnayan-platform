/**
 * a-promote-has-a-precondition.test.ts — CTRL-B1 build 2.
 *
 * ── THE DEFECT, measured 2026-09-22 against origin/main ─────────────────────
 * `approvePayment` promoted with `.update({status:'paid'}).eq('order_id', …)` and
 * NO condition on the status it was leaving; the order was read without `status`
 * in the SELECT, so it could not have checked. The customer-side submit selected
 * `order_id, event_id` only. A payment could therefore be logged and approved
 * against a `cancelled`, `refunded` or already-`paid` order — re-running
 * `activateOrderSku`, which re-activates the SKU, re-schedules payouts and (since
 * 2026-09-11) re-grants Papic credits and the couple's gift.
 *
 * ── WHY MOST OF THIS FILE EXECUTES RATHER THAN GREPS ────────────────────────
 * Both doors are `'use server'`, so a test cannot import them. The DECISION was
 * therefore split into `lib/order-promotion-rule.ts`, which is pure — and these
 * tests run it over every value of the live enum instead of asserting that a
 * string appears in a file. Only the two WIRING facts are source-read, and each
 * is counted so a deletion cannot pass as an absence.
 *
 * 🛡 Mutation-checked: every rule below was broken on purpose and confirmed RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ORDER_STATUSES,
  PROMOTABLE_ORDER_STATUSES,
  PAYABLE_ORDER_STATUSES,
  canPromoteOrderToPaid,
  canLogPaymentAgainstOrder,
  promotionRefusedReason,
} from '@/lib/order-promotion-rule';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) ?? []).length;

// SABOTAGE: add 'cancelled' to PROMOTABLE_ORDER_STATUSES → RED.
test('the three states money can still settle from are promotable, and nothing else is', () => {
  for (const s of ['draft', 'submitted', 'awaiting_payment']) {
    assert.equal(canPromoteOrderToPaid(s), true, `${s} must be promotable`);
  }
  for (const s of ['paid', 'fulfilled', 'cancelled', 'refunded', 'lapsed']) {
    assert.equal(
      canPromoteOrderToPaid(s),
      false,
      `${s} must NOT be promotable — promotion re-runs activation and re-grants what it already gave`,
    );
  }
});

// SABOTAGE: make canPromoteOrderToPaid return true for an unknown string → RED.
test('the rule fails CLOSED — unknown, null and empty are all refused', () => {
  for (const s of [null, undefined, '', 'PAID', 'Paid', 'partially_refunded', 'some_future_state']) {
    assert.equal(
      canPromoteOrderToPaid(s as string | null | undefined),
      false,
      `${JSON.stringify(s)} must be refused — an allowlist is the whole point; a denylist makes every new enum value promotable by default`,
    );
    assert.equal(canLogPaymentAgainstOrder(s as string | null | undefined), false);
  }
});

// SABOTAGE: drop 'paid' from PAYABLE_ORDER_STATUSES → RED.
test('a customer may still pay a balance on a paid order, but never on a closed one', () => {
  assert.equal(
    canLogPaymentAgainstOrder('paid'),
    true,
    'settling a balance on an order already marked paid is ordinary — resolveEventMoney reconciles an overpayment rather than discarding it',
  );
  for (const s of ['cancelled', 'refunded', 'lapsed']) {
    assert.equal(
      canLogPaymentAgainstOrder(s),
      false,
      `${s} must refuse a payment — nothing downstream reads a closed order again, so the money does not bounce, it disappears`,
    );
  }
});

// SABOTAGE: add a status to PROMOTABLE that is not in ORDER_STATUSES → RED.
test('every listed status is a real one, and promotable is a subset of payable', () => {
  for (const s of PROMOTABLE_ORDER_STATUSES) {
    assert.ok(
      (ORDER_STATUSES as readonly string[]).includes(s),
      `${s} is not in the live order_status enum — a rule written against a vocabulary that does not exist refuses everything`,
    );
    assert.ok(
      (PAYABLE_ORDER_STATUSES as readonly string[]).includes(s),
      `${s} can be promoted but not paid into — an order you cannot pay cannot reach paid honestly`,
    );
  }
  assert.ok(
    PROMOTABLE_ORDER_STATUSES.length < PAYABLE_ORDER_STATUSES.length,
    'the two sets must differ — if they are the same, one of them is wrong',
  );
});

// SABOTAGE: return 'could not promote' with no status → RED.
test('a refusal names the status that caused it', () => {
  const msg = promotionRefusedReason('cancelled');
  assert.match(msg, /cancelled/, 'the refusal must name the status — "could not promote" sends someone to the database');
  assert.match(msg, /still recorded/i, 'it must say the payment survived, or an admin will log it again');
  assert.match(promotionRefusedReason(null), /unknown/, 'a null status still gets a sentence');
});

// ── THE WIRING — the only two source reads in this file ─────────────────────

// SABOTAGE: remove `.in('status', PROMOTABLE_ORDER_STATUSES)` → RED.
// SABOTAGE: remove `.select('order_id')` → RED (a zero-row update is success-shaped).
test('the admin door carries the rule in BOTH the guard and the WHERE clause', () => {
  const src = read('app/admin/payments/actions.ts');
  assert.equal(
    count(src, /canPromoteOrderToPaid\(order\?\.status\)/),
    1,
    'the approve door must refuse before the write, so the admin is told which status stopped it',
  );
  assert.equal(
    count(src, /\.in\('status', PROMOTABLE_ORDER_STATUSES\)/),
    1,
    'the database must be the arbiter too — two admins approving the same payment would otherwise promote twice',
  );
  assert.match(
    src,
    /\.in\('status', PROMOTABLE_ORDER_STATUSES\)[\s\S]{0,60}\.select\(/,
    'the promote must return its rows — a zero-row UPDATE is success-shaped, and without the count this reports "paid" for a promote that changed nothing',
  );
  assert.match(
    src,
    /\.select\('[^']*\bstatus\b[^']*'\)[\s\S]{0,200}\.eq\('order_id', payment\.order_id\)/,
    'the order read must fetch `status` — the guard cannot check what was never selected',
  );
});

// SABOTAGE: delete the canLogPaymentAgainstOrder call → RED.
test('the customer door refuses a payment against a closed order', () => {
  const src = read('app/dashboard/[eventId]/orders/actions.ts');
  assert.equal(
    count(src, /canLogPaymentAgainstOrder\(/),
    1,
    'money arrives at the customer door FIRST — a precondition on the admin door alone is not a precondition',
  );
  assert.match(
    src,
    /\.select\('order_id, event_id, status'\)/,
    'the ownership read must fetch `status` too',
  );
});
