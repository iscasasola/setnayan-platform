/**
 * calendar-truth.test.ts — P5 "calendar truth" (owner 2026-10-10: *"Not set", never "Free"*): ONE rule decides what a
 * couple is told about a supplier's day, it agrees with the lock, and an unset calendar is never called free.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { CALENDAR_NOT_SET, DATE_FIT_WORDS, dateFitOf, refusedDaysBySupplier } from './calendar-truth';
import { buildFitOf, type BuildLine } from './suppliers-build';
import { sheetFits } from './supplier-sheet';

const DAY = '2026-12-12';
const src = (...p: string[]) => stripComments(readFileSync(join(process.cwd(), ...p), 'utf8'));

test('a supplier with no calendar is "Not set" — never "Free" (row 30)', () => {
  assert.equal(dateFitOf({ set: false, refused: new Set() }, DAY), 'not_set');
  assert.notEqual(DATE_FIT_WORDS.not_set, DATE_FIT_WORDS.free);
  assert.match(DATE_FIT_WORDS.not_set, /not set/i);
  assert.equal(CALENDAR_NOT_SET, 'Not set', "the supplier's own Dates prints the same word (S-PR3 capacityLine)");
});

test('the lock refusing the day is "Booked" — even with no pool; a set calendar the lock takes is "Free"', () => {
  assert.equal(dateFitOf({ set: true, refused: new Set([DAY]) }, DAY), 'booked');
  assert.equal(dateFitOf({ set: false, refused: new Set([DAY]) }, DAY), 'booked', 'a closure the shop typed is a fact');
  assert.equal(dateFitOf({ set: true, refused: new Set(['2026-12-19']) }, DAY), 'free');
  assert.equal(dateFitOf(undefined, DAY), null, 'an unread supplier says nothing');
});

test('a supplier is refused on a day only when EVERY bookable card of theirs is refused on it', () => {
  const cards = new Map([
    ['s1', ['c1', 'c2']],
    ['s2', ['c3']],
    ['s3', []],
  ]);
  const out = refusedDaysBySupplier(
    cards,
    [
      { service_id: 'c1', refused_on: DAY },
      { service_id: 'c3', refused_on: DAY },
      { service_id: 'c2', refused_on: '2026-12-19' },
      { service_id: 'c1', refused_on: '2026-12-19' },
    ],
    [DAY, '2026-12-19'],
  );
  assert.deepEqual([...out.get('s1')!], ['2026-12-19'], 'c2 is still open on the 12th');
  assert.deepEqual([...out.get('s2')!], [DAY]);
  assert.deepEqual([...out.get('s3')!], [], 'no bookable card → never judged');
});

test('the sheet and Build say "not set" — they never count it free', () => {
  const fits = sheetFits({
    distanceKm: null,
    innerRadiusKm: null,
    outerRadiusKm: null,
    reachesVenue: null,
    serviceRadiusKm: null,
    budgetFit: null,
    budgetEstimated: false,
    dateFit: 'not_set',
  });
  assert.deepEqual(fits, [{ tone: 'muted', kind: 'date', text: DATE_FIT_WORDS.not_set }]);
  const line = (vendorId: string): BuildLine =>
    ({
      planGroupId: vendorId,
      label: vendorId,
      booked: null,
      pick: { vendorId, name: vendorId, pricePhp: 100, inclusions: [] },
      options: [],
    }) as unknown as BuildLine;
  const fit = buildFitOf([line('a'), line('b')], new Map([['a', 'free'], ['b', 'not_set']]));
  assert.equal(fit.free, 1);
  assert.equal(fit.notSet, 1, 'the unset calendar is counted apart');
});

test('the couple page reads the ONE truth — not the blocks-only read that called an unset calendar free', () => {
  const page = src('app', 'dashboard', '[eventId]', 'vendors', 'page.tsx');
  const at = page.indexOf('const dateFitByVendorId');
  const fitBlock = page.slice(at, page.indexOf('dateFitByVendorId.set(vendorId, fit)', at) + 40);
  assert.match(fitBlock, /readCalendarTruth\(/, 'the bench fit is the calendar-truth read');
  assert.match(fitBlock, /dateFitOf\(/);
  assert.doesNotMatch(fitBlock, /getBatchVendorAvailableDays/, 'blocks-only is gone from the fit');
  const server = src('lib', 'calendar-truth.server.ts');
  assert.match(server, /service_cards_unbookable_on/, "the lock's own refusal");
  assert.match(server, /vendor_schedule_pools/, 'a calendar exists = a schedule pool');
  for (const f of [
    ['app', 'dashboard', '[eventId]', 'vendors', '_components', 'shortlist-categories.tsx'],
    ['app', 'dashboard', '[eventId]', 'vendors', '_components', 'vendor-quickview-inspector.tsx'],
  ]) {
    assert.match(src(...f), /dateFit === 'not_set'[\s\S]{0,400}DATE_FIT_WORDS\.not_set/, `${f.at(-1)} says "not set"`);
  }
});
