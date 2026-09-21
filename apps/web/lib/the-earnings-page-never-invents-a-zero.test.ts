/**
 * the-earnings-page-never-invents-a-zero.test.ts
 *
 * TWO DEFECTS ON ONE QUERY, and the guard that could see neither.
 *
 * The supplier's earnings reader used to match `orders.service_key` against the
 * shop's `vendor_services.category`, reading platform-wide `payments` with the
 * ADMIN client. Measured in prod: the two vocabularies are disjoint
 * (`ONBOARDING_SERVICES` · `PAPIC_GUEST_500` · `SETNAYAN_AI` vs `live_band` ·
 * `host_mc`), so the filter matched NOTHING for any shop — Saysay was paid
 * ₱2,000 and ₱3,350, both confirmed, and Earnings read ₱0. And the filter was
 * not an owner: had a key ever matched, **every shop in that category would
 * have been shown the same money, and the couples' names with it.**
 *
 * `fetchVendorLedgerEarnings` (lib/vendor-earnings.ts, #5680) replaced it and
 * is scoped by `event_vendors.marketplace_vendor_id`. This file EXECUTES the
 * scoping decision the way the leak would have happened — two shops in ONE
 * category, each with confirmed money — because that is the only arrangement in
 * which the old bug and the new rule give different answers.
 *
 * Third: the page's own honesty guard asserted only on a REFUSED payouts read
 * (`payoutsMeasured ?`). The earnings query SUCCEEDS and returns `[]`, so a
 * silent empty walked straight past it. The renderer's decision now lives in a
 * pure module (`lib/vendor-earnings-view.ts`) so a test can run it rather than
 * grep for it: an unread ledger is `null` and `'unreadable'`, never `0` and
 * never `'empty'`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from '@/lib/strip-comments';
import { fetchVendorLedgerEarnings } from '@/lib/vendor-earnings';
import { earningsView, readVendorEarnings } from '@/lib/vendor-earnings-view';
import { formatPhp } from '@/lib/php';

type Row = Record<string, unknown>;

/**
 * A PostgREST-shaped fake that really applies `.eq` / `.in`. STRICT on purpose:
 * a filter on a column the fixture does not carry throws, so a scoping proof
 * can never pass because the fixture forgot the column being scoped on.
 */
function fakeServer(tables: Record<string, Row[]>, opts?: { failAtRequest?: number }) {
  let requests = 0;
  const make = (name: string) => {
    const rows = tables[name] ?? [];
    const filters: ((r: Row) => boolean)[] = [];
    let counted = false;
    let window: [number, number] | null = null;
    const b: Record<string, unknown> = {
      select: (_cols: string, o?: { count?: string }) => {
        if (o?.count === 'exact') counted = true;
        return b;
      },
      eq: (col: string, v: unknown) => {
        filters.push((r) => {
          if (!(col in r)) throw new Error(`fixture row for ${name} has no ${col}`);
          return r[col] === v;
        });
        return b;
      },
      in: (col: string, vals: unknown[]) => {
        const set = new Set(vals);
        filters.push((r) => {
          if (!(col in r)) throw new Error(`fixture row for ${name} has no ${col}`);
          return set.has(r[col]);
        });
        return b;
      },
      order: () => b,
      range: (from: number, to: number) => {
        window = [from, to];
        return b;
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        requests += 1;
        if (opts?.failAtRequest === requests) {
          return Promise.resolve({
            data: null,
            error: { message: 'permission denied for table' },
            count: null,
          }).then(resolve, reject);
        }
        const matched = rows.filter((r) => filters.every((f) => f(r)));
        const from = window ? window[0] : 0;
        const asked = window ? window[1] - window[0] + 1 : Infinity;
        return Promise.resolve({
          data: matched.slice(from, from + Math.min(asked, 1000)),
          error: null,
          count: counted ? matched.length : null,
        }).then(resolve, reject);
      },
    };
    return b;
  };
  return { from: (t: string) => make(t) } as unknown as SupabaseClient;
}

const SHOP_A = 'vp-saysay';
const SHOP_B = 'vp-the-other-band';
/** ONE category. The old reader's whole filter — and a leak if it returns. */
const ONE_CATEGORY = 'band_dj';

function booking(vendorId: string, eventId: string, shop: string): Row {
  return {
    vendor_id: vendorId,
    event_id: eventId,
    category: ONE_CATEGORY,
    marketplace_vendor_id: shop,
    voided_by_fraud: false,
    deposit_declined_at: null,
    deposit_dispute_outcome: null,
  };
}

function payment(over: Partial<Row> & { payment_id: string; vendor_id: string; event_id: string }): Row {
  return {
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

/** Both shops trade in `band_dj`; each has a booking and a confirmed payment. */
function twoShopsInOneCategory() {
  return fakeServer({
    event_vendors: [
      booking('ev-rosa', 'e-rosa', SHOP_A),
      booking('ev-ana', 'e-ana', SHOP_A),
      booking('ev-tina', 'e-tina', SHOP_B),
    ],
    event_vendor_payments: [
      payment({ payment_id: 'pay-rosa', vendor_id: 'ev-rosa', event_id: 'e-rosa' }),
      payment({
        payment_id: 'pay-ana',
        vendor_id: 'ev-ana',
        event_id: 'e-ana',
        amount_php: '3350.00',
        paid_at: '2026-09-20',
        vendor_confirmed_at: '2026-09-20T02:28:15Z',
      }),
      payment({
        payment_id: 'pay-tina',
        vendor_id: 'ev-tina',
        event_id: 'e-tina',
        amount_php: '99999.00',
        paid_at: '2026-09-19',
        vendor_confirmed_at: '2026-09-19T00:00:00Z',
      }),
    ],
    events: [
      { event_id: 'e-rosa', display_name: 'Rosa & Ben' },
      { event_id: 'e-ana', display_name: 'Ana & Miguel' },
      { event_id: 'e-tina', display_name: 'Tina & Paolo' },
    ],
  });
}

const NOW = new Date('2026-09-21T04:00:00Z');

/* ── 1 · THE SCOPING DECISION, EXECUTED ───────────────────────────────── */

test('two shops in ONE category: shop A is never shown shop B’s money or its couple', async () => {
  const rows = await fetchVendorLedgerEarnings(twoShopsInOneCategory(), SHOP_A);
  assert.deepEqual(
    rows.map((r) => r.order_id).sort(),
    ['pay-ana', 'pay-rosa'],
    'the read is scoped by the shared category string, not by the owner',
  );
  assert.equal(
    rows.some((r) => r.payment_amount_php === 99999),
    false,
    'shop B’s ₱99,999 landed in shop A’s ledger',
  );
  assert.equal(
    rows.some((r) => r.event_display_name === 'Tina & Paolo'),
    false,
    'shop B’s couple was named on shop A’s Earnings page',
  );
});

test('…and the leak does not run the other way either', async () => {
  const rows = await fetchVendorLedgerEarnings(twoShopsInOneCategory(), SHOP_B);
  assert.deepEqual(rows.map((r) => r.order_id), ['pay-tina']);
  assert.equal(rows[0]!.event_display_name, 'Tina & Paolo');
});

/* ── 2 · THE OWNER'S CASE — confirmed money APPEARS ───────────────────── */

test('SAYSAY, AS MEASURED IN PROD: two confirmed deposits are ₱5,350 earned, not ₱0', async () => {
  // Both rows read from prod 2026-09-21: ₱2,000 Rosa & Ben (confirmed
  // 2026-09-18) and ₱3,350 Ana & Miguel (confirmed 2026-09-20), neither
  // refused, disputed nor voided.
  const view = earningsView(
    { ok: true, rows: await fetchVendorLedgerEarnings(twoShopsInOneCategory(), SHOP_A) },
    NOW,
  );
  assert.equal(view.measured, true);
  assert.equal(view.ytdPhp, 5350);
  assert.equal(view.paymentCount, 2);
  assert.equal(view.ledger, 'rows');
  assert.equal(formatPhp(view.ytdPhp), '₱5,350');
});

/* ── 3 · A FAILED READ SAYS SO — it is not an empty year ──────────────── */

test('a refused ledger read becomes a VALUE, not a thrown page', async () => {
  const client = twoShopsInOneCategory();
  const read = await readVendorEarnings(() => fetchVendorLedgerEarnings(client, SHOP_A));
  assert.equal(read.ok, true, 'the happy path must still read');

  const refused = await readVendorEarnings(() => {
    throw new Error('permission denied for table event_vendor_payments');
  });
  assert.equal(refused.ok, false);
});

test('an UNREAD ledger is an em-dash and "unreadable" — never ₱0, never "empty"', async () => {
  const view = earningsView(
    await readVendorEarnings(() => Promise.reject(new Error('permission denied'))),
    NOW,
  );
  assert.equal(view.measured, false);
  // The three figures the page prints. `null` is what makes them em-dashes.
  assert.equal(view.ytdPhp, null, '₱0 year-to-date is a claim that nobody paid this shop');
  assert.equal(view.thisMonthPhp, null);
  assert.equal(view.paymentCount, null, '"0 payments confirmed" is the same lie in words');
  assert.equal(view.thisMonthCount, null);
  // The pixels, not the flag: a flag nothing renders changed nothing.
  assert.equal(formatPhp(view.ytdPhp), '—');
  assert.equal(formatPhp(view.thisMonthPhp), '—');
  assert.equal(view.ledger, 'unreadable');
  assert.notEqual(view.ledger, 'empty');
  assert.deepEqual(view.months, [], 'a 12-month table of zeroes is a year that was never read');
});

test('a SHORT read is treated exactly like a refusal', async () => {
  // The bookings read stops before the server's count — `readAllPages` throws,
  // and a smaller year must never reach the page.
  const short = fakeServer(
    {
      event_vendors: [booking('ev-rosa', 'e-rosa', SHOP_A)],
      event_vendor_payments: [],
      events: [],
    },
    { failAtRequest: 1 },
  );
  const view = earningsView(
    await readVendorEarnings(() => fetchVendorLedgerEarnings(short, SHOP_A)),
    NOW,
  );
  assert.equal(view.measured, false);
  assert.equal(view.ytdPhp, null);
  assert.equal(view.ledger, 'unreadable');
});

test('a genuinely empty ledger is DIFFERENT from an unread one', async () => {
  const empty = fakeServer({ event_vendors: [], event_vendor_payments: [], events: [] });
  const view = earningsView(
    await readVendorEarnings(() => fetchVendorLedgerEarnings(empty, SHOP_A)),
    NOW,
  );
  assert.equal(view.measured, true);
  assert.equal(view.ledger, 'empty');
  assert.equal(view.ytdPhp, 0, 'a shop that was read and has nothing IS ₱0');
  assert.equal(view.months.length, 12);
});

/* ── 4 · THE PAGE RENDERS THOSE THREE STATES ──────────────────────────── */

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const surface = () =>
  stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/earnings/surface.tsx'), 'utf8'));

test('the page prints the VIEW’s figures, so a null reaches the screen', () => {
  const src = surface();
  assert.match(src, /value=\{formatPhp\(view\.ytdPhp\)\}/, 'the year-to-date tile no longer reads the view');
  assert.match(src, /value=\{formatPhp\(view\.thisMonthPhp\)\}/);
  // The old shape put the zero straight back.
  assert.doesNotMatch(
    src,
    /formatPhp\((ytdTotal|months\[months\.length - 1\]\?\.total_php \?\? 0)\)/,
    'a raw total bypasses the measured gate and prints ₱0 for an unread ledger',
  );
  assert.doesNotMatch(
    src,
    /fetchVendorLedgerEarnings\([^)]*\)\.catch\(/,
    'catching the reader to a list is how the silent empty comes back',
  );
});

test('every "couldn’t load" branch on this page is mounted, and counted', () => {
  const src = surface();
  // Payouts (was the only one), the money tiles, the 12-month table and the
  // ledger list. A count, because one match cannot say WHICH branch survived.
  assert.equal(
    (src.match(/We couldn&rsquo;t load/g) ?? []).length,
    4,
    'each unread section must say so where it is read: payouts, the money ' +
      'tiles, the monthly totals and the payment ledger',
  );
  assert.match(src, /\{view\.ledger === 'unreadable' \? \(/, 'the ledger list lost its unreadable branch');
  assert.match(src, /\) : view\.ledger === 'empty' \? \(/, 'the empty branch must be reachable only when measured');
  assert.match(src, /\{!view\.measured \? \(/);
});

test('the empty-state no longer describes the reader that could never match', () => {
  const src = surface();
  assert.doesNotMatch(
    src,
    /paid orders posted to\s+those categories will roll up here/,
    'this sentence sent a supplier to add services and wait for money that ' +
      'a category-matched join was never going to find',
  );
  assert.match(src, /logs a payment to you on their booking/);
});
