/**
 * 📅 THE SUPPLIER READS THE COUPLE'S DATE (walk 16 Nov 2026, EB-286).
 *
 * `events.event_date` is the LOCKED day and stays empty until the couple locks it; their picked option(s) live in
 * `date_mode` / `date_candidates` / `date_window_*` / `event_days`, which the couple's own screens already show.
 * The supplier's "Agreed now · Event date" read `event_date` alone, so it said "No date set yet" on an event the
 * couple reads as June 19, 2027.
 *
 * What would silently undo it:
 *   1. the row stops reading the options (back to "No date set yet" while the couple has a date);
 *   2. the card's read stops SELECTING the option columns (then 1 can never fire, whatever the row builder does);
 *   3. an unlocked option reads as a settled date (it must say "Not settled");
 *   4. a locked day stops winning over the options.
 * A refused read is not this row's job: the card already draws "Couldn't load what is agreed" for it.
 *
 * Run: cd apps/web && npx tsx --test lib/agreed-now-date-options.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agreedRows, eventDateWords, type AgreedInputs } from './agreed-now';

const opts = (o: Partial<NonNullable<AgreedInputs['event']['dateOptions']>>) => ({
  mode: 'specific',
  candidates: [] as string[],
  windowStart: null,
  windowEnd: null,
  days: 1,
  ...o,
});
const ev = (o: Partial<AgreedInputs['event']>): AgreedInputs['event'] => ({ eventDate: null, estimatedPax: null, finalPax: null, ...o });

test('1 · one open option reads as that date, not "No date set yet" (the prod case: Jun 19, 2027)', () => {
  const words = eventDateWords(ev({ dateOptions: opts({ candidates: ['2027-06-19'] }) }));
  assert.equal(words, 'Not settled · Jun 19, 2027');
  const rows = agreedRows({
    viewerUserId: 'v',
    quotes: [],
    event: ev({ dateOptions: opts({ candidates: ['2027-06-19'] }) }),
    changes: [],
    meetings: [],
    names: new Map(),
    booking: { isBooked: false, declined: false },
    quoteBy: 'You',
  });
  assert.equal(rows.find((r) => r.key === 'event_date')?.value, 'Not settled · Jun 19, 2027');
});

test('1b · several options and a window both read as not settled, with years', () => {
  assert.equal(
    eventDateWords(ev({ dateOptions: opts({ candidates: ['2027-07-03', '2027-06-19'] }) })),
    'Not settled · 2 options · Jun 19, 2027 – Jul 3, 2027',
  );
  assert.equal(
    eventDateWords(ev({ dateOptions: opts({ mode: 'window', windowStart: '2027-06-01', windowEnd: '2027-06-30' }) })),
    'Not settled · between Jun 1, 2027 and Jun 30, 2027',
  );
  assert.equal(eventDateWords(ev({ dateOptions: opts({ candidates: ['2027-06-19'], days: 3 }) })), 'Not settled · Jun 19, 2027 · 3 days');
});

test('2 · the card SELECTS the option columns and hands them to the row', () => {
  const src = readFileSync(join(__dirname, '../app/_components/chat/agreed-now.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  const cols = /const EVENT_COLS = '([^']+)'/.exec(src)?.[1] ?? '';
  for (const c of ['event_date', 'date_mode', 'date_candidates', 'date_window_start', 'date_window_end', 'event_days']) {
    assert.ok(cols.split(/,\s*/).includes(c), `the events read must select ${c}`);
  }
  assert.equal((src.match(/\.select\(EVENT_COLS\)/g) ?? []).length, 2, 'both event reads (service + session) use EVENT_COLS');
  assert.match(src, /dateOptions:\s*\{[\s\S]*?candidates:\s*event\.date_candidates/);
});

test('3 · nothing at all still says "No date set yet"', () => {
  assert.equal(eventDateWords(ev({})), 'No date set yet');
  assert.equal(eventDateWords(ev({ dateOptions: opts({}) })), 'No date set yet');
});

test('4 · a locked day wins over the options', () => {
  assert.equal(eventDateWords(ev({ eventDate: '2027-06-19', dateOptions: opts({ candidates: ['2027-07-03'] }) })), 'Jun 19, 2027');
});
