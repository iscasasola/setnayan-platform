/**
 * The lanes' readers (lib/vendor-growth-series.ts): a refused read is null (never a flat zero lane), a busy shop is
 * paged past PostgREST's 1,000-row cap, and every bucket is Manila time.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchBookedSeries, fetchInquiriesSeries, fetchUpcomingBookedDays, fetchViewsSeries, type SeriesClient } from './vendor-growth-series';
import { BOOKED_EVENT_VENDOR_STATUSES } from './vendor-funnel';

type Call = { table: string; cols: string; filters: string[]; range?: [number, number] };

function fakeClient(rowsFor: (call: Call) => { data: unknown[] | null; error: { message: string } | null }) {
  const calls: Call[] = [];
  const client: SeriesClient = {
    from: (table) => ({
      select: (cols) => {
        const call: Call = { table, cols, filters: [] };
        calls.push(call);
        const q: any = {
          eq: (c: string, v: string) => (call.filters.push(`eq:${c}=${v}`), q),
          gte: (c: string, v: string) => (call.filters.push(`gte:${c}=${v}`), q),
          lt: (c: string, v: string) => (call.filters.push(`lt:${c}=${v}`), q),
          in: (c: string, v: readonly string[]) => (call.filters.push(`in:${c}=${v.join(',')}`), q),
          is: (c: string) => (call.filters.push(`is:${c}`), q),
          order: () => q,
          range: (a: number, b: number) => ((call.range = [a, b]), q),
          then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(rowsFor(call)).then(res, rej),
        };
        return q;
      },
    }),
  };
  return { client, calls };
}

const NOW = Date.parse('2026-11-06T02:00:00Z');

/** Rows answer only the span a call asked for (`gte` · `lt` on the instant column) — the read is cut in three spans. */
function inSpan(call: Call, col: string, rows: Record<string, string>[]) {
  const gte = call.filters.find((f) => f.startsWith(`gte:${col}=`))?.split('=')[1];
  const lt = call.filters.find((f) => f.startsWith(`lt:${col}=`))?.split('=')[1];
  return rows.filter((r) => (!gte || Date.parse(r[col]!) >= Date.parse(gte)) && (!lt || Date.parse(r[col]!) < Date.parse(lt)));
}

test('views per day and per month, from one read in three side-by-side spans, in Manila buckets', async () => {
  const VIEWS = [
    { viewed_at: '2026-11-05T23:30:00Z', viewer_hash: 'a' },
    { viewed_at: '2026-11-01T01:00:00Z', viewer_hash: 'a' },
    { viewed_at: '2026-01-15T00:00:00Z', viewer_hash: 'b' },
    { viewed_at: '2025-10-20T00:00:00Z', viewer_hash: 'c' },
  ];
  const { client, calls } = fakeClient((c) => ({ data: inSpan(c, 'viewed_at', VIEWS), error: null }));
  const s = await fetchViewsSeries(client, 'v1', NOW);
  assert.ok(s);
  assert.equal(s.day.length, 30);
  assert.equal(s.month.length, 12);
  assert.equal(s.day[29]!.count, 1, '23:30 UTC 5 Nov is 6 Nov in Manila');
  assert.equal(s.day.reduce((a, b) => a + b.count, 0), 2);
  assert.equal(s.month[11]!.count, 2);
  assert.equal(s.month.find((m) => m.key === '2026-01-01')!.count, 1);
  assert.equal(calls.length, 3, 'three spans, read side by side');
  assert.equal(calls[0]!.table, 'vendor_profile_views');
  assert.equal(calls[0]!.cols, 'viewed_at, viewer_hash', 'who opened — so last year totals couples, as the card does');
  assert.ok(calls[0]!.filters.includes('eq:vendor_profile_id=v1'));
  // the read starts at the oldest season's 1 December (season 2026 → 1 Dec 2023), Manila midnight
  assert.ok(calls[0]!.filters.includes('gte:viewed_at=2023-11-30T16:00:00.000Z'));
  assert.ok(!calls[2]!.filters.some((f) => f.startsWith('lt:')), 'the last span runs to now');
  // last year: the same 30 days 52 weeks back (c, 20 Oct 2025); the three seasons
  assert.equal(s.lastYear!.total['30'], 1);
  assert.deepEqual(
    s.years!.map((y) => y.label),
    ['2024', '2025', '2026'],
  );
  assert.equal(s.years![2]!.total, 2, 'this season: couples a and b — a opened twice');
});

test('a refused read is null — never a flat lane of zeros', async () => {
  const { client } = fakeClient(() => ({ data: null, error: { message: 'permission denied' } }));
  assert.equal(await fetchViewsSeries(client, 'v1', NOW), null);
  assert.equal(await fetchInquiriesSeries(client, 'v1', NOW), null);
  assert.equal(await fetchUpcomingBookedDays(client, 'v1', NOW), null);
});

test('a busy shop is paged past the 1,000-row cap, and a refusal mid-way is still null', async () => {
  let page = 0;
  const { client, calls } = fakeClient((c) => {
    page += 1;
    // only the newest span holds rows: two full pages, then three
    if (c.filters.some((f) => f.startsWith('lt:'))) return { data: [], error: null };
    const n = c.range![0] === 0 || c.range![0] === 1000 ? 1000 : 3;
    return { data: Array.from({ length: n }, () => ({ created_at: '2026-11-06T01:00:00Z' })), error: null };
  });
  const s = await fetchInquiriesSeries(client, 'v1', NOW);
  assert.equal(calls.length, 2 + 3, 'two empty spans, then three pages of the newest');
  assert.equal(s!.day[29]!.count, 2003);
  assert.equal(calls[0]!.table, 'chat_threads');

  let n = 0;
  const failing = fakeClient(() => (++n === 2 ? { data: null, error: { message: 'timeout' } } : { data: Array(1000).fill({ created_at: '2026-11-06T01:00:00Z' }), error: null }));
  assert.equal(await fetchInquiriesSeries(failing.client, 'v1', NOW), null, 'a half-read year is not a year');
  assert.ok(page > 0);
});

test('upcoming booked days: live rows from today, 13 weeks, counted per date', async () => {
  const { client, calls } = fakeClient(() => ({
    data: [{ booked_date: '2026-11-15' }, { booked_date: '2026-11-29' }, { booked_date: '2026-11-29' }],
    error: null,
  }));
  assert.deepEqual(await fetchUpcomingBookedDays(client, 'v1', NOW), [
    { date: '2026-11-15', bookings: 1 },
    { date: '2026-11-29', bookings: 2 },
  ]);
  const f = calls[0]!.filters;
  assert.ok(f.includes('is:released_at'));
  assert.ok(f.includes('gte:booked_date=2026-11-06'));
  assert.ok(f.includes('lt:booked_date=2027-02-05'));
});

test('bookings: the funnel’s Booked stage — booked statuses, by created_at, on the shop’s own id', async () => {
  const ROWS = [{ created_at: '2026-11-05T01:00:00Z' }, { created_at: '2025-11-06T01:00:00Z' }];
  const { client, calls } = fakeClient((c) => ({ data: inSpan(c, 'created_at', ROWS), error: null }));
  const s = await fetchBookedSeries(client, 'v1', NOW);
  assert.ok(s);
  assert.equal(calls[0]!.table, 'event_vendors');
  assert.ok(calls[0]!.filters.includes('eq:marketplace_vendor_id=v1'));
  assert.ok(calls[0]!.filters.includes(`in:status=${BOOKED_EVENT_VENDOR_STATUSES.join(',')}`));
  assert.equal(s.day[28]!.count, 1, '5 Nov, the day before today');
  assert.equal(s.lastYear!.day.reduce((a, b) => a + b.count, 0), 1, '6 Nov 2025 sits 52 weeks back');
  const refused = fakeClient(() => ({ data: null, error: { message: 'denied' } }));
  assert.equal(await fetchBookedSeries(refused.client, 'v1', NOW), null);
});
