/**
 * help-me-choose.test.ts — PR5's Help me choose (owner 2026-10-10 answer 8: "every price picked") and the sheets' pure
 * words: only days EVERY PRICED pick can take are offered; a calendar not set never removes a day; the date the
 * Suppliers page plans on is the draft's until Apply (answer 7).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { daysFreeForPricedPicks, helpMonthOf, noDayWords } from './help-me-choose';
import { buildScheduleMatrix, type MatrixDate } from './schedule-matrix';
import { dateLadder, draftedEventDate, placeLadder, savedDateNote } from './suppliers-fact-sheets';
import type { SupabaseClient } from '@supabase/supabase-js';

const day = (dateKey: string, vendors: Array<[string, 'open' | 'booked' | 'unknown']>): MatrixDate => ({
  dateKey,
  label: dateKey,
  dow: 'Sat',
  categories: [
    {
      category: 'c',
      label: 'C',
      vendors: vendors.map(([key, state], i) => ({ key, name: key, isTopPick: i === 0, state, confirmed: false })),
      covered: true,
      topPickKept: true,
    },
  ],
  coveredCount: 1,
  totalCategories: 1,
  topPicksKept: 1,
  isBest: false,
});

test('a day one PRICED pick cannot take is not offered; an unpriced pick taken does not remove it', () => {
  const dates = [
    day('2026-12-05', [['bituin', 'booked']]),
    day('2026-12-12', [['bituin', 'open'], ['hiraya', 'booked']]),
    day('2026-12-19', [['bituin', 'unknown']]),
  ];
  const kept = daysFreeForPricedPicks(dates, new Set(['bituin'])).map((d) => d.dateKey);
  assert.deepEqual(kept, ['2026-12-12', '2026-12-19'], 'Hiraya is not priced; a calendar not set is not "not available"');
  assert.deepEqual(daysFreeForPricedPicks(dates, new Set()).map((d) => d.dateKey), dates.map((d) => d.dateKey));
});

test('the month compared: the one asked, else the date’s own, never a guess for a year', () => {
  assert.equal(helpMonthOf('2027-01', '2026-12-12', 'day'), '2027-01');
  assert.equal(helpMonthOf(null, '2026-12-12', 'day'), '2026-12');
  assert.equal(helpMonthOf(null, '2026-12-01', 'month'), '2026-12');
  assert.equal(helpMonthOf(null, '2026-01-01', 'year'), null);
  assert.equal(helpMonthOf('2027-13', null, null), null);
  assert.match(noDayWords(2), /every supplier you priced/);
});

test('the matrix reads the calendar truth when given it: refused → booked, no calendar → unknown (never open)', async () => {
  const noAdmin = {} as SupabaseClient; // the truth reader is asked instead — the blocks read must not run
  const m = await buildScheduleMatrix(
    {
      admin: noAdmin,
      eventDate: '2026-12-01',
      precision: 'month',
      picks: [
        { key: 'a', category: 'catering', name: 'A', marketplaceVendorId: 'pa', rank: 1, confirmed: false },
        { key: 'b', category: 'photographer', name: 'B', marketplaceVendorId: 'pb', rank: 1, confirmed: false },
      ],
    },
    {
      truth: async (days) => {
        assert.ok(days.includes('2026-12-05'), 'asked about the month’s Saturdays');
        return new Map([
          ['pa', { set: true, refused: new Set(['2026-12-05']) }],
          ['pb', { set: false, refused: new Set<string>() }],
        ]);
      },
    },
  );
  const dec5 = m.dates.find((d) => d.dateKey === '2026-12-05')!;
  const state = (k: string) => dec5.categories.flatMap((c) => c.vendors).find((v) => v.key === k)!.state;
  assert.equal(state('a'), 'booked');
  assert.equal(state('b'), 'unknown');
  // A blocks read that WOULD answer "no blocks" (every day open) — so only the rule can make an unread truth fail.
  const chain: unknown = new Proxy(function () {}, {
    get: (_t, k) => (k === 'then' ? (ok: (v: unknown) => void) => ok({ data: [], error: null }) : chain),
    apply: () => chain,
  });
  const openBlocks = { from: () => chain, rpc: () => chain } as unknown as SupabaseClient;
  await assert.rejects(
    buildScheduleMatrix(
      { admin: openBlocks, eventDate: '2026-12-01', precision: 'month', picks: [{ key: 'a', category: 'c', name: 'A', marketplaceVendorId: 'pa', rank: 1, confirmed: false }] },
      { truth: async () => null },
    ),
    'an unread calendar is said, never ranked as free',
  );
});

test('the date the page plans on is the draft’s — only when it differs from what guests see', () => {
  const live = { event_date: '2026-12-12', event_date_precision: 'day' };
  assert.equal(draftedEventDate(live, null), null);
  assert.equal(draftedEventDate(live, { events: {} }), null);
  assert.equal(draftedEventDate(live, { events: { event_date: '2026-12-12', event_date_precision: 'day' } }), null);
  assert.deepEqual(draftedEventDate(live, { events: { event_date: '2026-12-19', event_date_precision: 'day' } }), { date: '2026-12-19', precision: 'day' });
  assert.deepEqual(draftedEventDate(live, { events: { event_date: '2027-01-01', event_date_precision: 'month' } }), { date: '2027-01-01', precision: 'month' });
});

test('the ladders say what is known, and a typed place says it is for guests', () => {
  const rungs = dateLadder({ date: '2026-12-12', precision: 'day', ceremonyTime: '15:00', bookedNames: ['Seda Vertis North'], bookedDay: '2026-12-12' });
  assert.deepEqual(rungs.map((r) => r.on), [true, true, true, true]);
  assert.match(rungs[2]!.note ?? '', /held by Seda Vertis North/);
  // A DRAFTED day that is not the booking's day is not "held by" it (batch-5 walk W2: Seda holds Dec 12, the draft says Dec 19).
  const drafted = dateLadder({ date: '2026-12-19', precision: 'day', ceremonyTime: '15:00', bookedNames: ['Seda Vertis North'], bookedDay: '2026-12-12' });
  assert.equal(drafted[2]!.note ?? null, null, 'a drafted day is said to be held by a booking that holds another day');
  // No known booked day → never claimed.
  assert.equal(dateLadder({ date: '2026-12-12', precision: 'day', ceremonyTime: null, bookedNames: ['Seda Vertis North'], bookedDay: null })[2]!.note ?? null, null);
  assert.match(rungs[3]!.value, /3:00 PM ceremony/);
  const month = dateLadder({ date: '2026-12-01', precision: 'month', ceremonyTime: null, bookedNames: [], bookedDay: null });
  assert.deepEqual(month.map((r) => r.on), [true, true, false, false]);
  const place = placeLadder({
    city: 'Quezon City',
    slots: [
      {
        slot: 'reception',
        label: 'Reception',
        booked: null,
        choice: {},
        typed: 'Casa Hiraya',
        address: '',
        pin: null,
        columns: { name: 'n', address: 'a', lat: 'la', lng: 'ln' },
      },
    ],
  });
  assert.equal(place[0]!.value, 'Quezon City');
  assert.match(place[1]!.note ?? '', /for guests/);
  assert.match(savedDateNote(0), /when you Apply your Event Hub/);
  assert.match(savedDateNote(1), /told when you Apply/);
});
