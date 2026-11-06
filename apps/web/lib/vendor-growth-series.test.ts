/**
 * The lanes' readers (lib/vendor-growth-series.ts): a refused read is null (never a flat zero lane), a busy shop is
 * paged past PostgREST's 1,000-row cap, and every bucket is Manila time.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchInquiriesSeries, fetchUpcomingBookedDays, fetchViewsSeries, type SeriesClient } from './vendor-growth-series';

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

test('views per day and per month, from one paged read, in Manila buckets', async () => {
  const { client, calls } = fakeClient(() => ({
    data: [{ viewed_at: '2026-11-05T23:30:00Z' }, { viewed_at: '2026-11-01T01:00:00Z' }, { viewed_at: '2026-01-15T00:00:00Z' }],
    error: null,
  }));
  const s = await fetchViewsSeries(client, 'v1', NOW);
  assert.ok(s);
  assert.equal(s.day.length, 30);
  assert.equal(s.month.length, 12);
  assert.equal(s.day[29]!.count, 1, '23:30 UTC 5 Nov is 6 Nov in Manila');
  assert.equal(s.day.reduce((a, b) => a + b.count, 0), 2);
  assert.equal(s.month[11]!.count, 2);
  assert.equal(s.month.find((m) => m.key === '2026-01-01')!.count, 1);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.table, 'vendor_profile_views');
  assert.ok(calls[0]!.filters.includes('eq:vendor_profile_id=v1'));
  // the year read starts at the first of the month eleven months back, Manila midnight
  assert.ok(calls[0]!.filters.includes('gte:viewed_at=2025-11-30T16:00:00.000Z'));
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
    const n = c.range![0] === 0 || c.range![0] === 1000 ? 1000 : 3;
    return { data: Array.from({ length: n }, () => ({ created_at: '2026-11-06T01:00:00Z' })), error: null };
  });
  const s = await fetchInquiriesSeries(client, 'v1', NOW);
  assert.equal(calls.length, 3);
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
