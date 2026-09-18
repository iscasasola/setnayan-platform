/**
 * A SUPPLIER'S EARNINGS ARE THE MONEY COUPLES PAID THAT SUPPLIER — AREA-VENDOR.
 *
 * 🔴 The supplier Saysay confirmed a ₱2,000 deposit on 2026-09-18 and his
 * "Earned · this year" tile and Earnings ledger read ₱0 / "No bookings logged
 * yet". The reader matched Setnayan's OWN platform orders by
 * `orders.service_key == supplier category`; prod's service keys are SKUs
 * (`ONBOARDING_SERVICES`, `SETNAYAN_AI`), so it could never match — and a
 * category is not an owner, so a match would have shown one shop's orders to
 * every shop in that category.
 *
 * Three sections, each able to fail on its own:
 *   1. the RULE (pure) — what counts as earned, and that the scope is the
 *      shop's own booking rows;
 *   2. the READ — the fetcher asks for THIS shop's rows and throws rather than
 *      return ₱0 when a read is refused (a fake client records every filter);
 *   3. the WIRING — both screens that print the figure call the ledger reader
 *      and nothing in them reads platform `orders` for it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  computeMonthlySubtotals,
  fetchVendorLedgerEarnings,
  ledgerEarningRows,
  type LedgerBooking,
  type LedgerPayment,
} from '@/lib/vendor-earnings';

const SHOP_ROW: LedgerBooking = { vendor_id: 'ev-rosa', event_id: 'e-rosa', category: 'band_dj' };

function pay(over: Partial<LedgerPayment>): LedgerPayment {
  return {
    payment_id: 'p1',
    vendor_id: 'ev-rosa',
    event_id: 'e-rosa',
    amount_php: '2000.00',
    paid_at: '2026-09-18',
    method: 'GCash',
    is_deposit_record: true,
    vendor_confirmed_at: '2026-09-18T13:51:44Z',
    payment_refused_at: null,
    payment_dispute_outcome: null,
    ...over,
  };
}

/* ── 1 · the rule ─────────────────────────────────────────────────────── */

test('THE OWNER’S CASE — a confirmed ₱2,000 deposit is ₱2,000 earned this year', () => {
  const rows = ledgerEarningRows([SHOP_ROW], [pay({})], new Map([['e-rosa', 'Rosa & Ben']]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.payment_amount_php, 2000);
  assert.equal(rows[0]!.event_display_name, 'Rosa & Ben');
  assert.equal(rows[0]!.description, 'Deposit · GCash');
  const { ytdTotal } = computeMonthlySubtotals(rows, new Date('2026-09-19T04:00:00Z'));
  assert.equal(ytdTotal, 2000);
});

test('money not yet confirmed, or refused, is not earned — a ruling that it stands is', () => {
  const rows = ledgerEarningRows(
    [SHOP_ROW],
    [
      pay({ payment_id: 'unconfirmed', vendor_confirmed_at: null }),
      pay({ payment_id: 'refused', vendor_confirmed_at: null, payment_refused_at: '2026-09-18T00:00:00Z', is_deposit_record: false }),
      pay({ payment_id: 'ruled', vendor_confirmed_at: null, payment_refused_at: '2026-09-18T00:00:00Z', payment_dispute_outcome: 'payment_stands', is_deposit_record: false, amount_php: 500 }),
    ],
    new Map(),
  );
  assert.deepEqual(rows.map((r) => r.order_id), ['ruled']);
});

test('a payment on somebody else’s booking row is never counted', () => {
  const rows = ledgerEarningRows([SHOP_ROW], [pay({ vendor_id: 'ev-someone-else' })], new Map());
  assert.equal(rows.length, 0);
});

/* ── 2 · the read ─────────────────────────────────────────────────────── */

type Call = { table: string; filters: Array<[string, string, unknown]> };

function fakeAdmin(tables: Record<string, { data?: unknown[]; error?: { message: string } }>) {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      const call: Call = { table, filters: [] };
      calls.push(call);
      const result = tables[table] ?? { data: [] };
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (col: string, v: unknown) => (call.filters.push(['eq', col, v]), q),
        in: (col: string, v: unknown) => (call.filters.push(['in', col, v]), q),
        limit: () => q,
        then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
          Promise.resolve({ data: result.error ? null : result.data ?? [], error: result.error ?? null }).then(res, rej),
      };
      return q;
    },
  };
  return { client: client as never, calls };
}

test('the read asks for THIS shop’s booking rows, then only their payments', async () => {
  const { client, calls } = fakeAdmin({
    event_vendors: { data: [SHOP_ROW] },
    event_vendor_payments: { data: [pay({})] },
    events: { data: [{ event_id: 'e-rosa', display_name: 'Rosa & Ben' }] },
  });
  const rows = await fetchVendorLedgerEarnings(client, 'shop-saysay');
  assert.equal(rows.length, 1);
  const ev = calls.find((c) => c.table === 'event_vendors');
  assert.ok(ev, 'the shop’s booking rows were never read');
  assert.deepEqual(
    ev.filters.find(([, col]) => col === 'marketplace_vendor_id'),
    ['eq', 'marketplace_vendor_id', 'shop-saysay'],
    'the booking read is not scoped to this shop',
  );
  const pays = calls.find((c) => c.table === 'event_vendor_payments');
  assert.deepEqual(pays?.filters.find(([, col]) => col === 'vendor_id'), ['in', 'vendor_id', ['ev-rosa']]);
  assert.equal(calls.some((c) => c.table === 'orders' || c.table === 'payments'), false, 'read platform orders');
});

test('a refused read throws — it is never shown as ₱0', async () => {
  const { client } = fakeAdmin({ event_vendor_payments: { error: { message: 'permission denied' } }, event_vendors: { data: [SHOP_ROW] } });
  await assert.rejects(() => fetchVendorLedgerEarnings(client, 'shop-saysay'), /permission denied/);
});

/* ── 3 · the wiring ───────────────────────────────────────────────────── */

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

for (const rel of ['app/vendor-dashboard/earnings/surface.tsx', 'lib/vendor-overview.ts']) {
  test(`${rel} prints the supplier’s earnings from the ledger`, () => {
    const code = src(rel);
    assert.match(code, /fetchVendorLedgerEarnings\(/, `${rel} does not call the ledger reader`);
    assert.doesNotMatch(code, /fetchVendorEarnings\(/, `${rel} still calls the platform-orders reader`);
  });
}
