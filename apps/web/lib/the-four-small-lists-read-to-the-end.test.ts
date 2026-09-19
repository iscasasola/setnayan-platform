/**
 * the-four-small-lists-read-to-the-end.test.ts — the four supplier reads #5720
 * named and left as one capped request, EXECUTED past 1,000 rows.
 *
 * Owner 2026-09-20: "fix the 4 smaller lists too."
 *
 *   1. `vendor_payday_installments()` — Payday, the "Ongoing payments" tile,
 *      each roster money note, one customer's money (`readVendorPaydayInstallments`).
 *   2. the calendar blocks (`fetchVendorBlocksDetailed`).
 *   3. the unread notifications behind Bookings' "Unread" dot
 *      (`readUnreadChatThreadIds`).
 *   4. the booking read inside the booked-events lookup
 *      (`readRoomBookingCandidates` + `readClaimedQrEventVendorIds` +
 *      `readRoomEventFacts`, all behind `fetchVendorRoomEvents`).
 *
 * The fake server below behaves like PostgREST: one response never carries
 * more than 1,000 rows, whatever range was asked for, and `count: 'exact'`
 * reports the true total. A reader that makes ONE request gets 1,000 rows and
 * no error — exactly the silent shortfall this file exists to catch.
 *
 * The second half holds the SCREENS to the reads: a read that did not finish
 * must be said on screen, never rendered as a smaller total.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { stripComments } from './strip-comments';
import { readVendorPaydayInstallments } from './vendor-payday-read';
import { fetchVendorBlocksDetailed } from './vendor-schedule';
import { readUnreadChatThreadIds } from './vendor-unread-threads';
import { computeMonthlySubtotals, fetchVendorLedgerEarnings } from './vendor-earnings';
import {
  readDeclinedDepositIds,
  readDeletionRequests,
  readDepositsAwaitingAcknowledgement,
  readLockAgreementRequests,
} from './vendor-overview-desk-reads';
import { readOpenPaymentAsks } from './vendor-payment-asks-read';
import { readBookedEventIdsForGigs, readOpenGigsForEvents } from './vendor-manpower-reads';
import { readVendorDisputes } from './vendor-disputes-read';
import { paginate } from './paginate';
import {
  readClaimedQrEventVendorIds,
  readRoomBookingCandidates,
  readRoomEventFacts,
} from './vendor-room-reads';

type Row = Record<string, unknown>;

const SERVER_CAP = 1000;
/** Measured against prod 2026-09-20: 600 ids pass, 700 are refused 400. */
const GATEWAY_MAX_IN_IDS = 600;

/**
 * A PostgREST-shaped fake. `tables` maps a table (or RPC) name to its rows.
 * `.eq(col, v)` filters when the row carries `col`; `.in(col, ids)` filters and
 * is REFUSED past `GATEWAY_MAX_IN_IDS`; `.range()` is honoured but never past
 * the server cap; `failAtRequest` refuses the Nth request.
 */
function fakeServer(tables: Record<string, Row[]>, opts?: { failAtRequest?: number }) {
  let requests = 0;
  const make = (name: string) => {
    const rows = tables[name] ?? [];
    const filters: ((r: Row) => boolean)[] = [];
    let window: [number, number] | null = null;
    let inTooLong = false;
    let counted = false;
    const b: Record<string, unknown> = {
      select: (_cols: string, o?: { count?: string }) => {
        if (o?.count === 'exact') counted = true;
        return b;
      },
      eq: (col: string, v: unknown) => {
        filters.push((r) => !(col in r) || r[col] === v);
        return b;
      },
      in: (col: string, vals: unknown[]) => {
        if (vals.length > GATEWAY_MAX_IN_IDS) inTooLong = true;
        const set = new Set(vals);
        filters.push((r) => !(col in r) || set.has(r[col]));
        return b;
      },
      is: () => b,
      not: () => b,
      or: () => b,
      order: () => b,
      range: (from: number, to: number) => {
        window = [from, to];
        return b;
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
        requests += 1;
        if (opts?.failAtRequest === requests || inTooLong) {
          return Promise.resolve({
            data: null,
            error: { message: inTooLong ? '400 Bad Request' : 'refused' },
            count: null,
          }).then(resolve, reject);
        }
        const matched = rows.filter((r) => filters.every((f) => f(r)));
        const from = window ? window[0] : 0;
        const asked = window ? window[1] - window[0] + 1 : Infinity;
        const n = Math.min(asked, SERVER_CAP);
        return Promise.resolve({
          data: matched.slice(from, from + n),
          error: null,
          count: counted ? matched.length : null,
        }).then(resolve, reject);
      },
    };
    return b;
  };
  const client = {
    from: (t: string) => make(t),
    rpc: (fn: string, _args?: unknown, o?: { count?: string }) => {
      const b = make(fn) as { select: (c: string, o?: { count?: string }) => unknown };
      b.select('*', o);
      return b;
    },
  } as unknown as SupabaseClient;
  return { client, requests: () => requests };
}

const uuid = (prefix: string, i: number) =>
  `${prefix}-${String(i).padStart(8, '0')}`;

// ─── 1 · PAYDAY (money) ─────────────────────────────────────────────────────

const PAYDAY_ROWS = 2_437;
const paydayRows: Row[] = Array.from({ length: PAYDAY_ROWS }, (_, i) => ({
  event_vendor_id: uuid('ev', Math.floor(i / 3)),
  event_id: uuid('event', Math.floor(i / 3)),
  event_name: `Event ${i}`,
  event_date: '2027-01-01',
  seq: i % 3,
  label: 'Payment',
  amount_php: 1_000,
  due_date: '2027-01-01',
  confirmed: i % 2 === 0,
}));

test('payday: 2,437 installment rows read in full — the total is every peso, not the first 1,000 rows', async () => {
  const { client, requests } = fakeServer({ vendor_payday_installments: paydayRows });
  const read = await readVendorPaydayInstallments(client);
  assert.equal(read.error, null);
  assert.equal(read.complete, true);
  assert.equal(read.rows.length, PAYDAY_ROWS);
  const expected = read.rows.reduce((s, r) => s + (r.amount_php ?? 0), 0);
  assert.equal(expected, PAYDAY_ROWS * 1_000);
  assert.ok(requests() >= 3, `paged in 1,000s: ${requests()} requests`);
});

test('payday: a page refused mid-read comes back incomplete, never as a smaller total', async () => {
  const { client } = fakeServer({ vendor_payday_installments: paydayRows }, { failAtRequest: 2 });
  const read = await readVendorPaydayInstallments(client);
  assert.equal(read.complete, false);
  assert.equal(read.error, 'refused');
});

test('payday: one customer page narrows to its event and still reads to the end', async () => {
  const one = Array.from({ length: 1_203 }, (_, i) => ({ ...paydayRows[0], event_id: 'E1', seq: i }));
  const { client } = fakeServer({ vendor_payday_installments: [...one, ...paydayRows] });
  const read = await readVendorPaydayInstallments(client, { eventId: 'E1' });
  assert.equal(read.complete, true);
  assert.equal(read.rows.length, 1_203);
  assert.ok(read.rows.every((r) => r.event_id === 'E1'));
});

// ─── 2 · CALENDAR BLOCKS ───────────────────────────────────────────────────

test('blocks: 1,512 calendar blocks read in full', async () => {
  const blocks: Row[] = Array.from({ length: 1_512 }, (_, i) => ({
    block_id: uuid('blk', i),
    vendor_profile_id: 'V1',
    pool_id: null,
    block_source: 'manual',
    block_label: `Block ${i}`,
    client_name: null,
    client_contact: null,
    client_note: null,
    blocked_at: '2027-02-01T00:00:00+08:00',
    blocked_until: '2027-02-01T23:59:59+08:00',
  }));
  const { client } = fakeServer({ vendor_calendar_blocks: blocks });
  const read = await fetchVendorBlocksDetailed(client, 'V1');
  assert.equal(read.complete, true);
  assert.equal(read.blocks.length, 1_512);
  assert.equal(new Set(read.blocks.map((b) => b.blockId)).size, 1_512);
});

test('blocks: a refused read is incomplete, not "no blocks"', async () => {
  const { client } = fakeServer({ vendor_calendar_blocks: [] }, { failAtRequest: 1 });
  const read = await fetchVendorBlocksDetailed(client, 'V1');
  assert.equal(read.complete, false);
});

// ─── 3 · UNREAD NOTIFICATIONS ──────────────────────────────────────────────

test('unread: 1,850 unread chat notifications keep every thread\'s dot', async () => {
  const notes: Row[] = Array.from({ length: 1_850 }, (_, i) => ({
    notification_id: uuid('n', i),
    user_id: 'U1',
    type: 'chat_message',
    related_url: `/vendor-dashboard/messages/${uuid('thread', i)}`,
  }));
  const { client } = fakeServer({ notifications: notes });
  const read = await readUnreadChatThreadIds(client, 'U1');
  assert.equal(read.complete, true);
  assert.equal(read.threadIds.size, 1_850);
  assert.ok(read.threadIds.has(uuid('thread', 1_849)));
});

// ─── 4 · THE BOOKED-EVENTS LOOKUP ──────────────────────────────────────────

const CANDIDATES = 1_310;
const candidates: Row[] = Array.from({ length: CANDIDATES }, (_, i) => ({
  vendor_id: uuid('ev', i),
  event_id: uuid('event', i),
  lock_request_state: 'agreed',
}));

test('room: 1,310 booked event_vendors rows read in full', async () => {
  const { client } = fakeServer({ event_vendors: candidates });
  const read = await readRoomBookingCandidates(client, 'V1');
  assert.equal(read.error, null);
  assert.equal(read.complete, true);
  assert.equal(read.rows.length, CANDIDATES);
});

test('room: 1,120 claimed Locked QRs read in full', async () => {
  const tokens: Row[] = Array.from({ length: 1_120 }, (_, i) => ({
    id: i,
    claimed_event_vendor_id: uuid('ev', i),
  }));
  const { client } = fakeServer({ vendor_locked_qr_tokens: tokens });
  const read = await readClaimedQrEventVendorIds(client, 'V1');
  assert.equal(read.complete, true);
  assert.equal(read.ids.size, 1_120);
});

test('room: the event lookup for 1,310 ids is chunked under the gateway\'s 700-id refusal', async () => {
  const events: Row[] = candidates.map((c) => ({
    event_id: c.event_id,
    display_name: 'x',
    event_date: '2027-03-03',
    event_date_precision: 'day',
  }));
  const threads: Row[] = candidates.map((c, i) => ({ thread_id: uuid('t', i), event_id: c.event_id }));
  const { client } = fakeServer({ events, chat_threads: threads });
  const read = await readRoomEventFacts(
    client,
    'V1',
    candidates.map((c) => c.event_id as string),
  );
  assert.equal(read.eventError, null);
  assert.equal(read.events.length, CANDIDATES);
  assert.equal(read.threads.length, CANDIDATES);
});

// ─── SWEEP · THE EARNINGS LEDGER (money) ───────────────────────────────────

test('earnings: 1,250 bookings and 2,500 confirmed payments — the year is every payment', async () => {
  const bookings: Row[] = Array.from({ length: 1_250 }, (_, i) => ({
    vendor_id: uuid('ev', i),
    event_id: uuid('event', i),
    category: 'photographer',
    marketplace_vendor_id: 'V1',
  }));
  const payments: Row[] = Array.from({ length: 2_500 }, (_, i) => ({
    payment_id: uuid('p', i),
    vendor_id: uuid('ev', i % 1_250),
    event_id: uuid('event', i % 1_250),
    amount_php: 100,
    paid_at: '2026-03-01',
    method: 'GCash',
    is_deposit_record: false,
    vendor_confirmed_at: '2026-03-01T00:00:00Z',
    payment_refused_at: null,
    payment_dispute_outcome: null,
  }));
  const { client } = fakeServer({ event_vendors: bookings, event_vendor_payments: payments, events: [] });
  const rows = await fetchVendorLedgerEarnings(client, 'V1');
  assert.equal(rows.length, 2_500);
  const { ytdTotal } = computeMonthlySubtotals(rows, new Date('2026-09-20T04:00:00Z'));
  assert.equal(ytdTotal, 250_000);
});

test('earnings: a short read throws (the tile says "couldn\'t load"), never a smaller year', async () => {
  const bookings: Row[] = [{ vendor_id: 'ev-1', event_id: 'e-1', category: 'photographer' }];
  const { client } = fakeServer({ event_vendors: bookings, event_vendor_payments: [] }, { failAtRequest: 2 });
  await assert.rejects(() => fetchVendorLedgerEarnings(client, 'V1'));
});

// ─── THE SCREENS SAY IT ────────────────────────────────────────────────────

const read = (rel: string) =>
  stripComments(readFileSync(path.join(__dirname, '..', rel), 'utf8'));

test('screens: every money reader of the payday RPC goes through the paged read', () => {
  for (const rel of [
    'app/vendor-dashboard/payday/surface.tsx',
    'app/vendor-dashboard/customers/page.tsx',
    'app/vendor-dashboard/clients/[eventId]/page.tsx',
    'lib/vendor-overview.ts',
  ]) {
    const src = read(rel);
    assert.equal(
      (src.match(/rpc\(\s*'vendor_payday_installments'/g) ?? []).length,
      0,
      `${rel} calls the RPC as one capped request`,
    );
    assert.ok(src.includes('readVendorPaydayInstallments('), `${rel} lost the paged read`);
  }
});

test('screens: an unfinished payday read is said, and its rows are never summed', () => {
  const payday = read('app/vendor-dashboard/payday/surface.tsx');
  assert.match(payday, /const rows = paydayIncomplete \? \[\] : paydayRead\.rows;/);
  assert.match(payday, /\{paydayIncomplete \? \(\s*<p role="status"/);

  const customers = read('app/vendor-dashboard/customers/page.tsx');
  assert.match(customers, /const paydayRows = paydayIncomplete \? \[\] : paydayRes\.rows;/);
  assert.match(customers, /\{paydayIncomplete \? \(\s*<p role="status"[^>]*>\s*Some payments couldn&rsquo;t load/);

  const client = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.equal((client.match(/<LedgerUnreadableNote \/>/g) ?? []).length, 2, 'Quote + Payments tabs');
});

test('screens: blocks, unread and booked each say so when their read comes up short', () => {
  const cal = read('app/vendor-dashboard/calendar/surface.tsx');
  assert.match(cal, /\{blocksIncomplete \? \(\s*<p role="status"/);
  const customers = read('app/vendor-dashboard/customers/page.tsx');
  assert.match(customers, /\{blocksIncomplete \? \(\s*<p role="status"/);

  const bookings = read('app/vendor-dashboard/bookings/surface.tsx');
  assert.match(bookings, /let factsIncomplete = !unreadRead\.complete;/);
  assert.match(bookings, /if \(!roomEvents\.complete\) factsIncomplete = true;/);
  assert.match(bookings, /\{factsIncomplete \? \(\s*<p\s+role="status"/);

  const clients = read('app/vendor-dashboard/clients/surface.tsx');
  assert.match(clients, /incomplete=\{!threadsRead\.complete \|\| !roomRead\.complete\}/);
  assert.match(clients, /incomplete=\{!blocksRead\.complete\}/);
});

test('screens: the Earned tile and the payouts totals never print a short or unread total', () => {
  const lib = read('lib/vendor-overview.ts');
  assert.equal((lib.match(/fetchVendorLedgerEarnings\(admin, vendorProfileId\)\.catch\(\(\) => \[\]\)/g) ?? []).length, 0);
  assert.match(lib, /earningsMeasured: earnings !== null/);
  const tiles = read('app/vendor-dashboard/_components/overview-sections.tsx');
  assert.match(tiles, /measured=\{earnings\.earningsMeasured\}/);
  assert.match(tiles, /if \(!measured\) \{\s*return \(/);

  const earn = read('app/vendor-dashboard/earnings/surface.tsx');
  assert.doesNotMatch(earn, /\.from\('vendor_payouts'\)[\s\S]{0,900}?\.limit\(/);
  assert.match(earn, /const payoutRows = payoutRead\.complete \? payoutRead\.rows : null;/);
});

// ═══ WHAT THE #5724 SWEEP LEFT ════════════════════════════════════════════
// Four more supplier reads, driven past their old cap on the same fake server.

// ─── 5 · THE OVERVIEW'S ANSWERS DESK (money + 7-day fuses) ─────────────────

const deskRows = (n: number, extra: (i: number) => Row): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    vendor_id: uuid('ev', i),
    event_id: uuid('event', i),
    marketplace_vendor_id: 'V1',
    ...extra(i),
  }));

const DEPOSIT_COLS = 'vendor_id, event_id, deposit_recorded_at';

test('desk: 1,340 deposits awaiting acknowledgement read in full — the 1,001st deposit gets its card', async () => {
  const rows = deskRows(1_340, (i) => ({
    vendor_name: 'Shop',
    deposit_recorded_at: `2027-01-01T00:00:${String(i % 60).padStart(2, '0')}Z`,
    deposit_acknowledged_at: null,
    deposit_proof_url: null,
  }));
  const { client, requests } = fakeServer({ event_vendors: rows });
  const read = await readDepositsAwaitingAcknowledgement(client, 'V1', DEPOSIT_COLS);
  assert.equal(read.error, null);
  assert.equal(read.complete, true);
  assert.equal(read.rows.length, 1_340);
  assert.equal(new Set(read.rows.map((r) => r.vendor_id)).size, 1_340);
  assert.ok(requests() >= 2, `paged: ${requests()} requests`);
});

test('desk: a refused deposit read is incomplete, never "no deposits waiting"', async () => {
  const { client } = fakeServer({ event_vendors: [] }, { failAtRequest: 1 });
  const read = await readDepositsAwaitingAcknowledgement(client, 'V1', DEPOSIT_COLS);
  assert.equal(read.complete, false);
  assert.equal(read.error, 'refused');
});

test('desk: 1,100 declined deposits read in full — an answered claim stays off the desk', async () => {
  const rows = deskRows(1_100, () => ({ deposit_declined_at: '2027-01-02T00:00:00Z' }));
  const { client } = fakeServer({ event_vendors: rows });
  const read = await readDeclinedDepositIds(client, 'V1');
  assert.equal(read.complete, true);
  assert.equal(read.ids.size, 1_100);
  assert.ok(read.ids.has(uuid('ev', 1_099)));
});

test('desk: 1,450 booking asks read in full — the oldest asks past row 1,000 are not dropped', async () => {
  const rows = deskRows(1_450, () => ({
    lock_request_state: 'pending',
    lock_requested_at: '2027-01-01T00:00:00Z',
    lock_request_expires_at: '2027-01-08T00:00:00Z',
  }));
  const { client } = fakeServer({ event_vendors: rows });
  const read = await readLockAgreementRequests(client, 'V1');
  assert.equal(read.complete, true);
  assert.equal(read.rows.length, 1_450);
});

test('desk: a refused booking-ask read REPORTS its error (it used to be discarded)', async () => {
  const { client } = fakeServer({ event_vendors: [] }, { failAtRequest: 1 });
  const read = await readLockAgreementRequests(client, 'V1');
  assert.equal(read.complete, false);
  assert.equal(read.error, 'refused');
});

test('desk: 1,050 deletion asks read in full', async () => {
  const rows = deskRows(1_050, () => ({
    delete_request_state: 'pending',
    delete_requested_at: '2027-01-01T00:00:00Z',
  }));
  const { client } = fakeServer({ event_vendors: rows });
  const read = await readDeletionRequests(client, 'V1');
  assert.equal(read.complete, true);
  assert.equal(read.rows.length, 1_050);
});

// ─── 6 · OPEN PAYMENT ASKS ON ONE BOOKING (money) ──────────────────────────

const asks = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    ask_id: uuid('ask', i),
    event_vendor_id: 'EV1',
    amount_php: '5000',
    note: null,
    due_date: null,
    status: 'open',
    created_at: '2027-01-01T00:00:00Z',
  }));

test('asks: 21 open asks — the 21st is shown (the read stopped at 20)', async () => {
  const { client } = fakeServer({ vendor_payment_asks: asks(21) });
  const read = await readOpenPaymentAsks(client, 'EV1');
  assert.equal(read.complete, true);
  assert.equal(read.rows.length, 21);
  assert.ok(read.rows.some((r) => r.ask_id === uuid('ask', 20)));
});

test('asks: 1,205 open asks read in full past the server cap', async () => {
  const { client } = fakeServer({ vendor_payment_asks: asks(1_205) });
  const read = await readOpenPaymentAsks(client, 'EV1');
  assert.equal(read.complete, true);
  assert.equal(read.rows.length, 1_205);
});

test('asks: a refused read keeps the raw error, so the panel says it could not load', async () => {
  const { client } = fakeServer({ vendor_payment_asks: asks(3) }, { failAtRequest: 1 });
  const read = await readOpenPaymentAsks(client, 'EV1');
  assert.equal(read.complete, false);
  assert.equal(read.error?.message, 'refused');
});

// ─── 7 · MANPOWER: WHICH GIG OFFERS APPEAR ─────────────────────────────────

test('manpower: 1,300 booked events read in full, and their open gigs are chunked under the 700-id refusal', async () => {
  const booked = deskRows(1_300, () => ({ status: 'contracted' }));
  const gigs: Row[] = booked.map((b, i) => ({
    gig_id: uuid('gig', i),
    event_id: b.event_id,
    status: 'pending',
    posted_at: `2027-01-01T00:${String(Math.floor(i / 60) % 60).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`,
  }));
  const { client } = fakeServer({ event_vendors: booked, manpower_gigs: gigs });
  const bookedRead = await readBookedEventIdsForGigs(client, 'V1');
  assert.equal(bookedRead.complete, true);
  assert.equal(bookedRead.ids.length, 1_300);
  const open = await readOpenGigsForEvents<{ gig_id: string; posted_at: string }>(client, bookedRead.ids);
  assert.equal(open.error, null);
  assert.equal(open.rows.length, 1_300, 'a gig on the 1,001st booked event is offered');
  for (let i = 1; i < open.rows.length; i += 1) {
    assert.ok(open.rows[i - 1]!.posted_at >= open.rows[i]!.posted_at, 'merged newest-first');
  }
});

test('manpower: a refused booked read is incomplete, never "no hosts are offering"', async () => {
  const { client } = fakeServer({ event_vendors: [] }, { failAtRequest: 1 });
  const read = await readBookedEventIdsForGigs(client, 'V1');
  assert.equal(read.complete, false);
});

// ─── 8 · DISPUTES: EVERY ONE REACHABLE ─────────────────────────────────────

test('disputes: 1,234 disputes read in full, and the pager reaches the last one', async () => {
  const rows: Row[] = Array.from({ length: 1_234 }, (_, i) => ({
    dispute_id: uuid('d', i),
    vendor_profile_id: 'V1',
    status: i % 5 === 0 ? 'open' : 'withdrawn',
    created_at: '2027-01-01T00:00:00Z',
  }));
  const { client } = fakeServer({ vendor_disputes: rows });
  const read = await readVendorDisputes<{ dispute_id: string; status: string }>(client, 'V1');
  assert.equal(read.complete, true);
  assert.equal(read.rows.length, 1_234, 'the 201st dispute is read');
  assert.equal(read.rows.filter((r) => r.status === 'open').length, 247, 'the open count is of all of them');
  const last = paginate(read.rows, '62');
  assert.equal(last.page, 62);
  assert.equal(last.items.at(-1)?.dispute_id, uuid('d', 1_233));
});

// ─── THE SCREENS SAY IT (the sweep-left surfaces) ──────────────────────────

test('screens: the Overview desk reads through the paged helpers and reports a short read', () => {
  const lib = read('lib/vendor-overview.ts');
  assert.equal((lib.match(/\.from\('event_vendors'\)/g) ?? []).length, 0, 'no un-paged event_vendors read left on the desk');
  for (const fn of [
    'readDepositsAwaitingAcknowledgement(',
    'readDeclinedDepositIds(',
    'readLockAgreementRequests(',
    'readDeletionRequests(',
  ]) {
    assert.ok(lib.includes(fn), `vendor-overview.ts lost ${fn}`);
  }
  assert.match(
    lib,
    /const deskIncomplete =\s*!lockRead\.complete \|\|\s*!lockAgreementRead\.complete \|\|\s*!deletionRead\.complete \|\|\s*!declinedRead\.complete;/,
  );
  assert.match(lib, /return \{ whatsNew, ongoing, upcoming, deskIncomplete \};/);
  const page = read('app/vendor-dashboard/page.tsx');
  assert.match(page, /<WhatsNewFeed\s+cards=\{whatsNew\}\s+incomplete=\{deskIncomplete\}/);
});

test('screens: the client page reads every open ask, and a short read is "could not load"', () => {
  const src = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  assert.doesNotMatch(src, /\.from\('vendor_payment_asks'\)/);
  assert.ok(src.includes('readOpenPaymentAsks(supabase, eventVendorId)'));
  assert.match(src, /const asksMeasured = asksAbsent \|\| \(!askRowsError && askRead\.complete\);/);
});

test('screens: manpower pages the booked read and says when offers could not load', () => {
  const src = read('app/vendor-dashboard/manpower/surface.tsx');
  assert.doesNotMatch(src, /\.from\('event_vendors'\)/);
  assert.ok(src.includes('readBookedEventIdsForGigs(createAdminClient(), vendor.vendor_profile_id)'));
  assert.match(src, /const eligibleMeasured = bookedRead\.complete;/);
  assert.match(src, /readOpenGigsForEvents<ManpowerGigRow>\(supabase, eligibleEventIds\)/);
  assert.match(src, /!openGigsMeasured\s*\?\s*'We couldn’t read the open gigs/);
  assert.match(src, /!openGigsMeasured && openGigs\.length > 0\s*\?\s*'Some open gigs couldn’t load/);
  assert.match(src, /\{note \? \(\s*<p role="status"/);
});

test('screens: disputes page every dispute through the shared pager', () => {
  const src = read('app/vendor-dashboard/disputes/page.tsx');
  assert.doesNotMatch(src, /\.limit\(/);
  assert.match(src, /const disputesPage = paginate\(rows, search\.dpage\);/);
  assert.match(src, /\{disputesPage\.items\.map\(/);
  assert.match(src, /<ListPager\s+paged=\{disputesPage\}\s+param="dpage"/);
  assert.match(src, /\{incomplete \? \(\s*<ShopNotice[^>]*>\s*\{rows\.length === 0\s*\?\s*'Your disputes couldn\\u2019t load/);
  assert.match(src, /\{rows\.length === 0 && !incomplete \? \(/);
});
