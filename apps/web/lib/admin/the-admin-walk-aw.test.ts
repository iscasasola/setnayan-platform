/**
 * Admin walk 14 Nov 2026 — AW-4 · AW-5 · AW-7 · AW-9, each measured in prod before it was fixed.
 *
 *  AW-4  order S89O-05E8XMMPF4 was `paid` (logged payment matched, receipt issued) while the bill's own placeholder
 *        row stayed `pending` — Payments said "Pending review" and Work counted it: "2 waiting" over one real item.
 *  AW-5  Liwanag's ₱1,337.50 bill holds ONLY its placeholder (no reference, no screenshot). Fees owed said "Billed —
 *        nothing sent yet" (true); Payments said "Pending review" (false). Both now say the same words.
 *  AW-7  `founder_seats` has two keys to `users`, so `users ( email )` was ambiguous and the WHOLE read was refused.
 *  AW-9  Subscriptions printed the raw "solo · monthly" instead of the plan's catalog name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

import {
  NOTHING_SENT_WORDS,
  hidePlaceholdersBesideLogged,
  isPlaceholderOnPaidOrder,
  paymentStillWaiting,
} from '@/lib/payment-logged';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

const placeholder = { status: 'pending', reference_number: null, screenshot_url: null };
const logged = { status: 'pending', reference_number: 'TEST01', screenshot_url: null };

test('AW-4 · a placeholder on a paid order is not waiting; a logged second transfer still is', () => {
  for (const s of ['paid', 'fulfilled', 'refunded', 'lapsed']) {
    assert.equal(isPlaceholderOnPaidOrder(placeholder, s), true, s);
    assert.equal(paymentStillWaiting(placeholder, s), false, s);
  }
  // An unpaid bill's placeholder IS how an unpaid bill is seen — it stays.
  for (const s of ['submitted', 'awaiting_payment', null, undefined]) {
    assert.equal(paymentStillWaiting(placeholder, s), true, String(s));
  }
  // A real logged transfer on an already-paid order is a double payment: a person must see it.
  assert.equal(paymentStillWaiting(logged, 'paid'), true);
  assert.equal(paymentStillWaiting({ ...placeholder, status: 'matched' }, 'paid'), false);
});

test('AW-4 · the desk list drops the paid order’s placeholder even when its matched sibling is not in the read', () => {
  const rows = [
    { order_id: 'paid-order', ...placeholder, order: { status: 'paid' } },
    { order_id: 'unpaid-bill', ...placeholder, order: { status: 'submitted' } },
  ];
  assert.deepEqual(
    hidePlaceholdersBesideLogged(rows).map((r) => r.order_id),
    ['unpaid-bill'],
  );
});

test('AW-4 · every count and list of waiting payments goes through the one rule', () => {
  const counts = code('lib/admin/queue-counts.ts');
  assert.match(counts, /key: 'payments',[\s\S]{0,400}?digest: countPaymentsWaiting/, 'the payments queue counts through its digest');
  assert.match(counts, /export async function countPaymentsWaiting[\s\S]{0,900}?paymentStillWaiting\(/);
  assert.match(code('lib/admin/green-payments.server.ts'), /paymentStillWaiting\(p, p\.order\?\.status\)/, 'the Work drawer');
  assert.match(code('lib/admin/green-payments.server.ts'), /order:orders!inner\(status,/, 'the drawer reads the order status it judges by (inner join since RW-308a)');
  assert.match(code('app/admin/payments/page.tsx'), /countPaymentsWaiting\(admin/, 'the desk’s “To confirm” number');
});

test('AW-5 · Payments and Fees owed say the same words about a bill with nothing sent', () => {
  assert.equal(NOTHING_SENT_WORDS, 'Billed — nothing sent yet');
  assert.ok(code('app/admin/booking-fees/page.tsx').includes(NOTHING_SENT_WORDS), 'Fees owed');
  const desk = code('app/admin/payments/_components/desk.tsx');
  const uses = desk.match(/!paymentWasLogged\(p\)[\s\S]{0,40}?NOTHING_SENT_WORDS/g) ?? [];
  assert.equal(uses.length, 2, 'the list row AND the opened payment');
});

test('AW-7 · the founder-seat read names its key, and a refused read prints no blank count', () => {
  const page = code('app/admin/founder-seats/page.tsx');
  assert.match(page, /users!founder_seats_user_id_fkey \( email \)/);
  assert.doesNotMatch(page, /users \( email \)/, 'the ambiguous embed refuses the whole read');
  assert.doesNotMatch(page, /\? '—' : formatCount\(openSeats\)/, 'never "— of 10 open"');
});

test('AW-9 · Subscriptions names the plan from the catalog, never the raw tier code', () => {
  const page = code('app/admin/subscriptions/page.tsx');
  assert.match(page, /from\('vendor_billing_catalog'\)\s*\.select\('sku_code, title'\)/);
  assert.doesNotMatch(page, /TIER_LABEL\[p\.tier\] \?\? p\.tier\b/, 'the raw tier code was the fallback');
  assert.doesNotMatch(page, /\{p\.billing_cycle \?\? '—'\}/);
  assert.doesNotMatch(page, /price_php/, 'names only — no price is read here');
});
