/**
 * THE FIT CHECK READS THE EVENT'S CANDIDATE DATES, ITS REGION AND ITS MAIN SPAN.
 *
 * Owner, 13 Nov 2026 — DECISION_LOG rows "ONE MAIN DATE SPAN PER EVENT" and "FIND KEEPS A SUPPLIER FREE ON ANY ONE
 * CANDIDATE DATE":
 *   • before a venue is booked, Find/Discover keep a supplier free on ANY ONE candidate date (or any day of the ≤30-day
 *     window) — before this, both read only `event_date`, so an event with candidates had no date filter at all;
 *   • after the date is set, the main span `event_date → COALESCE(event_end_date, event_date)`: free on any day keeps;
 *   • accommodation: free EVERY night of the span widened by one day each side — one full night hides it;
 *   • place: no venue pin → the Region's curated centroid. `style_preferences.search_areas` and `std_film_venue_city`
 *     are NOT fit inputs.
 *
 * Executes the pure rules, the server read against a fake client (so the accommodation nights really reach the
 * refusal read), and pins the wiring on the two pages.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  ACCOMMODATION_CATEGORY,
  fitDateScope,
  fitDaysToAsk,
  fitOptions,
  betterFit,
  needsEveryDay,
  refusalKey,
  supplierDayFits,
  suppliersWithNoBookingLeft,
  type DayFit,
  type EventFitDates,
} from './bench-bookable-days';
import { readSuppliersWithNoBookingLeft } from './bench-bookable-days.server';
import { keepCardsThatFit } from './discover-shows-what-fits';
import { findNobodyFreeWords, dateUncheckedWords } from './supplier-find-empty';
import { regionPin } from './your-place';
import { REGION_CENTROID, cityByKey } from '@/app/onboarding/wedding/_data/wedding-cities';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SEARCH = 'app/dashboard/[eventId]/vendors/_actions/category-search.ts';
const DISCOVER = 'app/(shell)/explore/_lib/marketplace-view.tsx';

const noDate: EventFitDates = { eventDate: null, precision: null };
/** Who is full, for one supplier with one card `c`, judged by category. */
function full(scope: NonNullable<ReturnType<typeof fitDateScope>>, refusedDays: string[], category: string | null = 'photographer') {
  const refused = new Set(refusedDays.map((d) => refusalKey('c', d)));
  return suppliersWithNoBookingLeft(new Map([['s', ['c']]]), refused, () => ({ options: fitOptions(scope, category), everyDay: needsEveryDay(category) })).has('s');
}

/* ── before a venue is booked: the candidate dates ─────────────────────── */

test('🔑 a supplier free on ANY ONE candidate date stays; full on every candidate leaves', () => {
  const scope = fitDateScope({ ...noDate, candidates: ['2027-02-20', '2027-02-13', '2027-03-06', 'not-a-date'] })!;
  assert.equal(scope.kind, 'dates');
  assert.deepEqual(scope.days, ['2027-02-13', '2027-02-20', '2027-03-06'], 'parsed by resolveProbeWindow: valid, sorted');
  assert.equal(full(scope, ['2027-02-13', '2027-02-20']), false, 'free on one candidate was hidden');
  assert.equal(full(scope, ['2027-02-13', '2027-02-20', '2027-03-06']), true, 'full on every candidate was kept');
  // The same rule through the plain day list Find's server read has always used.
  assert.equal(suppliersWithNoBookingLeft(new Map([['s', ['c']]]), new Set([refusalKey('c', '2027-02-13')]), scope.days).size, 0);
});

test('a candidate list wins over a month-precise date; a day-precise date wins over the candidates', () => {
  assert.equal(fitDateScope({ eventDate: '2027-02-01', precision: 'month', candidates: ['2027-02-13'] })!.kind, 'dates');
  assert.deepEqual(fitDateScope({ eventDate: '2027-02-14', precision: 'day', candidates: ['2027-02-13'] })!.days, ['2027-02-14']);
  assert.equal(fitDateScope({ ...noDate, candidates: [] }), null, 'an empty candidate list judged something');
  assert.equal(fitDateScope({ eventDate: '2027-01-01', precision: 'year' }), null, 'a year judged something');
});

/* ── before a venue is booked: the window ──────────────────────────────── */

test('🔑 the date window: free on ANY day of it stays; full on every day leaves; a window over 31 days is not judged', () => {
  const scope = fitDateScope({ ...noDate, windowStart: '2027-04-01', windowEnd: '2027-04-05' })!;
  assert.equal(scope.kind, 'range');
  assert.deepEqual(scope.days, ['2027-04-01', '2027-04-02', '2027-04-03', '2027-04-04', '2027-04-05']);
  assert.equal(full(scope, ['2027-04-01', '2027-04-02', '2027-04-03', '2027-04-05']), false);
  assert.equal(full(scope, scope.days), true);
  assert.equal(fitDateScope({ ...noDate, windowStart: '2027-04-01', windowEnd: '2027-05-15' }), null);
  assert.equal(fitDateScope({ ...noDate, windowStart: '2027-04-01', windowEnd: '2027-04-30' })!.days.length, 30);
});

/* ── after the date is set: the main span ──────────────────────────────── */

test('🔑 the main span event_date → event_end_date: a normal category free on ANY day of it stays', () => {
  const scope = fitDateScope({ eventDate: '2027-02-13', precision: 'day', endDate: '2027-02-15' })!;
  assert.equal(scope.kind, 'span');
  assert.deepEqual(scope.days, ['2027-02-13', '2027-02-14', '2027-02-15']);
  assert.equal(full(scope, ['2027-02-13', '2027-02-14']), false, 'free on the last day was hidden');
  assert.equal(full(scope, scope.days), true);
  // The span is ONE block (block-ready, owner 2026-11-13): free on SOME of its days keeps, and says how many.
  assert.deepEqual(fitOptions(scope, 'photographer'), [scope.days]);
  // No end date, or one before the start → the single day (COALESCE(event_end_date, event_date)).
  assert.deepEqual(fitDateScope({ eventDate: '2027-02-13', precision: 'day' })!, { kind: 'day', days: ['2027-02-13'] });
  assert.deepEqual(fitDateScope({ eventDate: '2027-02-13', precision: 'day', endDate: '2027-02-10' })!.days, ['2027-02-13']);
  // A set date outranks the options that came before it.
  assert.equal(fitDateScope({ eventDate: '2027-02-13', precision: 'day', windowStart: '2027-01-01', windowEnd: '2027-01-05' })!.kind, 'day');
});

/* ── accommodation: every night ±1 ─────────────────────────────────────── */

test('🔑 accommodation needs EVERY night of the span ±1 — one full night hides it', () => {
  const scope = fitDateScope({ eventDate: '2027-02-13', precision: 'day', endDate: '2027-02-14' })!;
  assert.deepEqual(fitOptions(scope, ACCOMMODATION_CATEGORY), [['2027-02-12', '2027-02-13', '2027-02-14', '2027-02-15']]);
  assert.equal(full(scope, [], ACCOMMODATION_CATEGORY), false);
  for (const night of ['2027-02-12', '2027-02-13', '2027-02-14', '2027-02-15']) {
    assert.equal(full(scope, [night], ACCOMMODATION_CATEGORY), true, `full on ${night} kept the hotel`);
  }
  // …while a normal category with the same one full day stays (quoted per day).
  assert.equal(full(scope, ['2027-02-13']), false);
  // The ±1 nights are asked about only when accommodation is in play; month ends roll over.
  assert.deepEqual(fitDaysToAsk(scope, false), ['2027-02-13', '2027-02-14']);
  assert.deepEqual(fitDaysToAsk(scope, true), ['2027-02-12', '2027-02-13', '2027-02-14', '2027-02-15']);
  const nye = fitDateScope({ eventDate: '2026-12-31', precision: 'day' })!;
  assert.deepEqual(fitOptions(nye, ACCOMMODATION_CATEGORY), [['2026-12-30', '2026-12-31', '2027-01-01']]);
});

test('accommodation before booking: kept when SOME candidate has every night ±1 free', () => {
  const scope = fitDateScope({ ...noDate, candidates: ['2027-02-13', '2027-03-06'] })!;
  assert.deepEqual(fitOptions(scope, ACCOMMODATION_CATEGORY), [
    ['2027-02-12', '2027-02-13', '2027-02-14'],
    ['2027-03-05', '2027-03-06', '2027-03-07'],
  ]);
  assert.equal(full(scope, ['2027-02-12'], ACCOMMODATION_CATEGORY), false, 'the second candidate is wholly free');
  assert.equal(full(scope, ['2027-02-12', '2027-03-07'], ACCOMMODATION_CATEGORY), true, 'no candidate is wholly free');
});

/* ── block-ready: the per-option answer is ALL / SOME / NONE ────────────── */

test('🔑 each supplier\'s best block fit is exposed as { freeDays, totalDays } — free on ALL ranks ahead of SOME', () => {
  const scope = fitDateScope({ eventDate: '2027-02-13', precision: 'day', endDate: '2027-02-15' })!;
  const reader = (card: string) => {
    const category = card.startsWith('hotel') ? ACCOMMODATION_CATEGORY : 'photographer';
    return { options: fitOptions(scope, category), everyDay: needsEveryDay(category) };
  };
  const refused = new Set([
    refusalKey('some', '2027-02-13'),
    refusalKey('none', '2027-02-13'),
    refusalKey('none', '2027-02-14'),
    refusalKey('none', '2027-02-15'),
    refusalKey('hotel-one-night', '2027-02-16'),
  ]);
  const fits = supplierDayFits(
    new Map([
      ['ALL', ['all']],
      ['SOME', ['some']],
      ['NONE', ['none']],
      ['HOTEL', ['hotel-one-night']],
      ['HOTEL_FREE', ['hotel-free']],
      ['NO_CARDS', []],
    ]),
    refused,
    reader,
  );
  assert.deepEqual(fits.get('ALL'), { freeDays: 3, totalDays: 3 });
  assert.deepEqual(fits.get('SOME'), { freeDays: 2, totalDays: 3 }, 'free on some days of the span is kept — "Free 2 of your 3 days"');
  assert.equal(fits.get('NONE'), null);
  assert.equal(fits.get('HOTEL'), null, 'one full night of the span ±1 kept the hotel');
  assert.deepEqual(fits.get('HOTEL_FREE'), { freeDays: 5, totalDays: 5 });
  assert.equal(fits.has('NO_CARDS'), false, 'a supplier with no card in scope was judged');
  // Free on all beats free on more days of a bigger block.
  const all: DayFit = { freeDays: 1, totalDays: 1 };
  const some: DayFit = { freeDays: 2, totalDays: 3 };
  assert.equal(betterFit(some, all), all);
  assert.equal(betterFit(all, some), all);
});

/* ── the server read: the nights reach the refusal read ────────────────── */

type Call = { fn: string; args: unknown[] };
function fakeAdmin(cards: { vendor_service_id: string; vendor_profile_id: string; category: string }[], refusedOn: Record<string, string[]>, failRpc = false) {
  const calls: Call[] = [];
  const builder: Record<string, unknown> = {};
  for (const fn of ['select', 'in', 'eq']) {
    builder[fn] = (...args: unknown[]) => {
      calls.push({ fn, args });
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => void) => resolve({ data: cards, error: null });
  const admin = {
    from: () => builder,
    rpc: async (_name: string, p: { p_service_ids: string[]; p_dates: string[] }) => {
      calls.push({ fn: 'rpc', args: [p] });
      if (failRpc) return { data: null, error: { message: 'boom', code: 'XX000' } };
      const data = p.p_service_ids.flatMap((id) => (refusedOn[id] ?? []).filter((d) => p.p_dates.includes(d)).map((d) => ({ service_id: id, refused_on: d })));
      return { data, error: null };
    },
  };
  return { admin: admin as never, calls };
}

test('🔑 the server read asks about the ±1 nights for a hotel and hides it on one full night; a normal card stays', async () => {
  const dates: EventFitDates = { eventDate: '2027-02-13', precision: 'day', endDate: '2027-02-14' };
  const { admin, calls } = fakeAdmin(
    [
      { vendor_service_id: 'hotel', vendor_profile_id: 'H', category: 'accommodation' },
      { vendor_service_id: 'photo', vendor_profile_id: 'P', category: 'photographer' },
    ],
    { hotel: ['2027-02-15'], photo: ['2027-02-13'] },
  );
  const fitsOut = new Map<string, DayFit | null>();
  const out = await readSuppliersWithNoBookingLeft({ admin, supplierIds: ['H', 'P'], canonicals: null, dates, fitsOut });
  assert.deepEqual(out && [...out], ['H']);
  assert.deepEqual(Object.fromEntries(fitsOut), { H: null, P: { freeDays: 1, totalDays: 2 } }, 'the per-option fit did not reach the caller');
  const asked = (calls.find((c) => c.fn === 'rpc')!.args[0] as { p_dates: string[] }).p_dates;
  assert.deepEqual(asked, ['2027-02-12', '2027-02-13', '2027-02-14', '2027-02-15']);
});

test('the server read judges the candidates when no date is set — and a failed read is "could not check", never "everyone fits"', async () => {
  const dates: EventFitDates = { ...noDate, candidates: ['2027-02-13', '2027-02-20'] };
  const cards = [{ vendor_service_id: 'photo', vendor_profile_id: 'P', category: 'photographer' }];
  const oneFree = await readSuppliersWithNoBookingLeft({ admin: fakeAdmin(cards, { photo: ['2027-02-13'] }).admin, supplierIds: ['P'], canonicals: null, dates });
  assert.equal(oneFree?.size, 0);
  const allFull = await readSuppliersWithNoBookingLeft({ admin: fakeAdmin(cards, { photo: ['2027-02-13', '2027-02-20'] }).admin, supplierIds: ['P'], canonicals: null, dates });
  assert.deepEqual(allFull && [...allFull], ['P']);
  const failed = await readSuppliersWithNoBookingLeft({ admin: fakeAdmin(cards, {}, true).admin, supplierIds: ['P'], canonicals: null, dates });
  assert.equal(failed, null);
});

/* ── Discover's cards ──────────────────────────────────────────────────── */

test('Discover\'s cards read the same scope: any one candidate keeps a card; a hotel needs its nights; a failed read hides nobody', () => {
  const scope = fitDateScope({ eventDate: '2027-02-13', precision: 'day' })!;
  const cards = [
    { s: 'hotel', v: 'H', cat: 'accommodation' },
    { s: 'photo', v: 'P', cat: 'photographer' },
  ];
  const refused = new Set([refusalKey('hotel', '2027-02-14'), refusalKey('photo', '2027-02-14')]);
  const r = keepCardsThatFit(cards, (c) => c.s, (c) => c.v, refused, scope, new Set(), (c) => c.cat);
  assert.deepEqual(r.cards.map((c) => c.s), ['photo']);
  assert.equal(r.checked, true);
  const unread = keepCardsThatFit(cards, (c) => c.s, (c) => c.v, null, scope, new Set(), (c) => c.cat);
  assert.equal(unread.cards.length, 2);
  assert.equal(unread.checked, false);
});

test('the sentences name the shape judged — never one candidate passed off as THE date', () => {
  assert.equal(findNobodyFreeWords(fitDateScope({ ...noDate, candidates: ['2027-02-13', '2027-02-20'] })), 'Nobody is free on any of your dates.');
  assert.equal(
    findNobodyFreeWords(fitDateScope({ eventDate: '2027-02-13', precision: 'day', endDate: '2027-02-14' })),
    'Nobody is free from Sat, Feb 13, 2027 to Sun, Feb 14, 2027.',
  );
  assert.match(findNobodyFreeWords(fitDateScope({ ...noDate, windowStart: '2027-04-01', windowEnd: '2027-04-05' })), /^Nobody is free between .* and .*\.$/);
  assert.match(dateUncheckedWords(fitDateScope({ ...noDate, candidates: ['2027-02-13', '2027-02-20'] })), /^Couldn't check who's free on any of your dates\./);
});

/* ── place: the Region's centroid ──────────────────────────────────────── */

test('🔑 no venue pin → the Region\'s curated centroid (the onboarding\'s own table, not a second list)', () => {
  assert.deepEqual(regionPin('ncr'), { latitude: REGION_CENTROID.ncr![0], longitude: REGION_CENTROID.ncr![1] });
  assert.deepEqual(regionPin('cagayan'), { latitude: REGION_CENTROID['cagayan-valley']![0], longitude: REGION_CENTROID['cagayan-valley']![1] });
  const tagaytay = cityByKey('tagaytay')!;
  assert.deepEqual(regionPin('tagaytay'), { latitude: tagaytay.lat, longitude: tagaytay.lon });
  assert.equal(regionPin(null), null);
  assert.equal(regionPin('somewhere-unknown'), null);

  const search = read(SEARCH);
  assert.match(search, /const regionAnchor = anchors\.reception \? null : regionPin\(\(ev as \{ region\?: string \| null \}\)\.region \?\? null\);/);
  assert.match(search, /const lat = anchors\.reception\?\.latitude \?\? regionAnchor\?\.latitude \?\? null;/);
  assert.match(search, /event_date_precision, event_end_date, date_candidates, date_window_start, date_window_end, region'/);
  const discover = read(DISCOVER);
  assert.match(discover, /\} else \{\s*const rp = regionPin\(/);
});

test('🔑 search_areas and std_film_venue_city are NOT fit inputs', () => {
  for (const rel of [SEARCH, DISCOVER, 'lib/bench-bookable-days.ts', 'lib/bench-bookable-days.server.ts', 'lib/discover-shows-what-fits.ts', 'lib/your-place.ts']) {
    const src = read(rel);
    assert.doesNotMatch(src, /search_areas/, `${rel} reads style_preferences.search_areas`);
    assert.doesNotMatch(src, /std_film_venue_city/, `${rel} reads std_film_venue_city`);
  }
});

/* ── wiring: both pages pass the event's dates, not the date alone ─────── */

test('Find and Discover hand the hide the event\'s whole date picture', () => {
  const search = read(SEARCH);
  assert.match(search, /const fitScope = fitDateScope\(fitDates\);/);
  assert.match(search, /findSuppliersWithNoBookingLeft\(\{\s*admin,\s*supplierIds: ids,\s*canonicals,\s*dates: fitDates,\s*\}\)/);
  assert.match(search, /candidates: \(ev as \{ date_candidates\?: unknown \}\)\.date_candidates \?\? null,/);
  // The calendar-block down-rank reads the same days, one call per day.
  assert.match(search, /days\.map\(\(day\) =>\s*supabase\.rpc\('vendors_blocked_on_date', \{\s*p_vendor_ids: ids,\s*p_event_date: day,/);
  const discover = read(DISCOVER);
  assert.match(discover, /event_date_precision, event_end_date, date_candidates, date_window_start, date_window_end, region'/);
  assert.match(discover, /dates: coupleFitDates \?\? \{ eventDate: coupleEventDate, precision: coupleEventDatePrecision \},/);
  assert.match(discover, /dateHideScope,\s*known,\s*\(c\) => c\.row\.category,/);
});
