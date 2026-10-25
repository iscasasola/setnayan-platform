/**
 * billing-read-is-honest.test.ts — Billing & receipts never says "No purchases yet" to somebody whose read failed.
 *
 * The defect this fences is the one `lib/guests-read-is-honest.test.ts` closed for the guest list: PostgREST
 * RESOLVES a refusal (RLS, an expired session, a timeout, a renamed column) with `error` set and `data: null`.
 * Turned into `[]`, the account page would tell a person who paid last week "No purchases yet" — byte-identical
 * to a new account. The rules, the same three:
 *   1. the read reports whether it MEASURED (`fetchMyPurchasesMeasured` → `measured`, `receiptsMeasured`);
 *   2. the measurement reaches the RENDER — `BillingList` branches on `measured` BEFORE it can draw the empty state;
 *   3. the scope is the payer: `.eq('user_id', …)` — `orders_owner_read` lets an admin read every order, so without
 *      it the owner's own Billing page would list the whole platform's purchases as his.
 *
 * Behaviour is tested against a stubbed client; the source anchors are counted so a deletion is seen.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchMyPurchasesMeasured, purchaseHref } from '@/lib/billing';
import { stripComments } from '@/lib/strip-comments';

type Result = { data: unknown; error: unknown };

/** One thenable builder per table; records every filter it is given. */
function stubClient(byTable: Record<string, Result>, calls: string[] = []): SupabaseClient {
  return {
    from(table: string) {
      const b: Record<string, unknown> = {};
      for (const m of ['select', 'eq', 'neq', 'in', 'is', 'order', 'limit']) {
        b[m] = (...args: unknown[]) => {
          calls.push(`${table}.${m}(${args.map((a) => JSON.stringify(a)).join(',')})`);
          return b;
        };
      }
      b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(byTable[table] ?? { data: [], error: null }).then(resolve);
      return b;
    },
  } as unknown as SupabaseClient;
}

const ORDER = {
  order_id: 'o1',
  public_id: 'S89O-AAAAAAAAAA',
  event_id: 'e1',
  service_key: 'PAPIC_ADDON_THANK_YOU',
  description: 'Papic — Thank-you add-on',
  requested_total_php: '2500',
  confirmed_total_php: null,
  status: 'paid',
  reference_code: 'STN-1',
  created_at: '2026-10-23T09:12:00Z',
};
const SUPPLIER_ORDER = { ...ORDER, order_id: 'o2', service_key: 'vendor_plan__x', status: 'awaiting_payment', requested_total_php: 999 };
const RECEIPT = { receipt_id: 'r1', order_id: 'o1', or_serial: 41, gross_total_php: '2500.00', issued_at: '2026-10-23T10:00:00Z' };

test('a REFUSED orders read reports measured:false — not an empty history', async () => {
  const got = await fetchMyPurchasesMeasured(
    stubClient({ orders: { data: null, error: { message: 'permission denied for table orders', code: '42501' } } }),
    'u1',
  );
  assert.equal(got.measured, false, 'a refusal must be reported, not swallowed');
  assert.deepEqual(got.rows, []);
});

test('a SUCCESSFUL empty read reports measured:true — genuinely no purchases', async () => {
  const got = await fetchMyPurchasesMeasured(stubClient({ orders: { data: [], error: null }, receipts: { data: [], error: null } }), 'u1');
  assert.equal(got.measured, true);
  assert.equal(got.receiptsMeasured, true);
  assert.deepEqual(got.rows, []);
});

test('a refused RECEIPTS read keeps the rows but says receipts are unknown', async () => {
  const got = await fetchMyPurchasesMeasured(
    stubClient({ orders: { data: [ORDER], error: null }, receipts: { data: null, error: { message: 'timeout', code: '57014' } } }),
    'u1',
  );
  assert.equal(got.measured, true);
  assert.equal(got.receiptsMeasured, false, '"no receipt" on a row would otherwise be a guess stated as fact');
  assert.equal(got.rows[0]?.receiptId, null);
});

test('rows join their receipt, open it, and a supplier bill never opens the couple’s order page', async () => {
  const got = await fetchMyPurchasesMeasured(
    stubClient({ orders: { data: [ORDER, SUPPLIER_ORDER], error: null }, receipts: { data: [RECEIPT], error: null } }),
    'u1',
  );
  const [paid, bill] = got.rows;
  assert.equal(paid?.receiptId, 'r1');
  assert.equal(paid?.receiptNumber, 'TXN-2026-000041');
  assert.equal(paid?.grossPhp, 2500, 'a receipted row shows what was PAID (the receipt gross)');
  assert.equal(purchaseHref(paid!, false), '/receipts/r1');
  assert.equal(bill?.isSupplierBilling, true);
  assert.equal(bill?.grossPhp, 999, 'a vendor_ price is already gross — no VAT built on top');
  assert.equal(purchaseHref(bill!, false), null, 'the couple’s event is not the supplier’s to open');
  assert.equal(purchaseHref({ ...paid!, receiptId: null }, false), '/dashboard/e1/orders/o1', 'unpaid → where it is paid');
  assert.equal(purchaseHref({ ...paid!, receiptId: null }, true), null, 'the store shell refuses the order page');
});

test('the read is scoped to THIS payer, drops drafts, and is newest first', async () => {
  const calls: string[] = [];
  await fetchMyPurchasesMeasured(stubClient({}, calls), 'u1');
  assert.ok(calls.includes('orders.eq("user_id","u1")'), 'orders must be filtered to the payer — an admin can read every order');
  assert.ok(calls.includes('receipts.eq("user_id","u1")'), 'receipts must be filtered to the payer');
  assert.ok(calls.includes('orders.neq("status","draft")'), 'a draft is a cart nobody sent, not a purchase');
  assert.ok(calls.includes('orders.order("created_at",{"ascending":false})'), 'newest first');
});

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the measurement reaches the RENDER — the refused state comes before the empty one', () => {
  const list = read('app/dashboard/(account)/billing/_components/billing-list.tsx');
  const refused = list.indexOf('if (!read.measured)');
  const empty = list.indexOf('No purchases yet');
  assert.equal([...list.matchAll(/if \(!read\.measured\)/g)].length, 1, 'one refused branch');
  assert.equal([...list.matchAll(/No purchases yet/g)].length, 1, 'one empty state');
  assert.ok(refused > -1 && empty > refused, 'the empty state must be unreachable for a refused read');
  assert.match(list.slice(refused, empty), /didn&rsquo;t load/, 'a refusal says so in words');
  assert.match(list, /read\.receiptsMeasured \? null :/, 'a refused receipts read is said, not hidden');

  const page = read('app/dashboard/(account)/billing/page.tsx');
  assert.match(page, /fetchMyPurchasesMeasured\(supabase, user\.id, vatRatePct\)/, 'the page reads through the measured read');
  assert.match(page, /<BillingList read=\{read\}/, 'and hands the whole measurement to the list');
  assert.doesNotMatch(page, /createAdminClient|service_role/, 'reads on the person’s own client, under RLS');
});
