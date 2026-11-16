/**
 * 📅 THE COUPLE'S OWN SCREENS READ THEIR OPEN DATE (walk 16 Nov 2026, EB-111 · EB-168 · EB-191).
 *
 * A wedding with one picked option (`date_candidates = {2027-06-19}`) and no locked day (`event_date` NULL): the header
 * read "Saturday, June 19, 2027", while Event settings said "Wedding date · Not set" and Papic said "Switches on when
 * your date is set". Both read the locked day only. One phrase now says the picked day(s) everywhere
 * (`openDateWords`).
 *
 * 💍 Corrected the same day: ONE picked day IS the event's date (owner 14 Nov, DECISION_LOG 16f7e76a — Home already reads
 * it that way through `withPickedDate`), so the fact rows say it as the date. "Not settled · …" is for 2+ options or a range.
 *
 * What would silently undo it:
 *   1. the shared phrase stops naming the day (or drops the year);
 *   2. Event settings' Date row stops reading the options — its column list loses them, or the load stops using them;
 *   3. Event details' describer goes back to a count ("1 candidate date");
 *   4. Papic says "set" again, or stops naming the day — its read loses the columns.
 * EB-168 (the date sheet: "Day · not yet · considering 1 date: Jun 19") already said the truth and is untouched.
 *
 * Run: cd apps/web && npx tsx --test lib/the-couple-reads-their-open-date.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { openDateWords } from './event-date-options';
import { describeEventDate } from './event-details-sheet';
import { yourEventDateDisplay } from './details-your-event';
import { papicWaitsForTheDayWords } from './papic-waits-for-the-day';

const PROD_ROW = { date_mode: 'specific', date_candidates: ['2027-06-19'], date_window_start: null, date_window_end: null, event_days: 1 };
const src = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');

test('1 · the shared phrase names the day(s), with the year', () => {
  const o = (x: Partial<Parameters<typeof openDateWords>[0]>) => openDateWords({ mode: 'specific', candidates: [], windowStart: null, windowEnd: null, ...x });
  assert.equal(o({ candidates: ['2027-06-19'] }), 'Jun 19, 2027');
  assert.equal(o({ candidates: ['2027-07-03', '2027-06-19', '2027-06-19'] }), '2 options · Jun 19, 2027 – Jul 3, 2027');
  assert.equal(o({ mode: 'window', windowStart: '2027-06-01', windowEnd: '2027-06-30' }), 'between Jun 1, 2027 and Jun 30, 2027');
  assert.equal(o({ candidates: ['2027-06-19'], days: 3 }), 'Jun 19, 2027 · 3 days');
  assert.equal(o({ candidates: ['nope', '2027-02-30'] }), null);
});

test('2 · Event settings: the Date row says the picked day, and its read selects the options', () => {
  // 💍 One picked day IS the date (owner 14 Nov, 16f7e76a) — the same answer Home gives through `withPickedDate`.
  assert.equal(yourEventDateDisplay({ event_date: null, ...PROD_ROW }, null), 'June 19, 2027');
  assert.equal(
    yourEventDateDisplay({ event_date: null, ...PROD_ROW, date_candidates: ['2027-06-19', '2027-07-03'] }, null),
    'Not settled · 2 options · Jun 19, 2027 – Jul 3, 2027',
  );
  assert.equal(yourEventDateDisplay({ event_date: '2027-06-19', ...PROD_ROW, date_candidates: ['2027-07-03'] }, 'day'), 'June 19, 2027');
  assert.equal(yourEventDateDisplay({ event_date: null, ...PROD_ROW, date_candidates: [] }, null), null);
  const facts = src('app/dashboard/[eventId]/launch/_components/details-your-event-facts.ts');
  const cols = /const YOUR_EVENT_COLUMNS =([\s\S]*?);/.exec(facts)?.[1] ?? '';
  for (const c of ['event_date', 'date_mode', 'date_candidates', 'date_window_start', 'date_window_end', 'event_days']) {
    assert.ok(new RegExp(`\\b${c}\\b`).test(cols), `YOUR_EVENT_COLUMNS must select ${c}`);
  }
  const load = src('app/dashboard/[eventId]/launch/_components/details-your-event-load.tsx');
  assert.match(load, /dateDisplay:\s*yourEventDateDisplay\(row, precision\)/);
});

test('3 · Event details: the describer says the picked day, never a count', () => {
  assert.equal(describeEventDate({ event_date: null, ...PROD_ROW }), 'June 19, 2027');
  const two = describeEventDate({ event_date: null, ...PROD_ROW, date_candidates: ['2027-06-19', '2027-07-03'] });
  assert.equal(two, 'Not settled · 2 options · Jun 19, 2027 – Jul 3, 2027');
  assert.doesNotMatch(String(two), /candidate date/);
  assert.equal(describeEventDate({ event_date: null, date_mode: 'window', date_window_start: '2027-06-01', date_window_end: '2027-06-30' }), 'Not settled · between Jun 1, 2027 and Jun 30, 2027');
});

test('4 · Papic: waits for the exact day, says so, and names the picked day', () => {
  assert.equal(papicWaitsForTheDayWords(PROD_ROW), 'Switches on when you pick the day · you’re considering Jun 19, 2027');
  assert.equal(papicWaitsForTheDayWords({}), 'Switches on when you pick the day');
  const card = src('app/dashboard/[eventId]/studio/papic/_components/papic-camera-settings.tsx');
  assert.doesNotMatch(card, /when your date is set/);
  const sel = /\.select\(\s*'event_type, event_date, papic_window_start[\s\S]*?\)/.exec(card)?.[0] ?? '';
  for (const c of ['date_mode', 'date_candidates', 'date_window_start', 'date_window_end', 'event_days']) {
    assert.ok(new RegExp(`\\b${c}\\b`).test(sel), `Papic's read must select ${c}`);
  }
  assert.match(card, /if \(!on\) return papicWaitsForTheDayWords\(/);
});
