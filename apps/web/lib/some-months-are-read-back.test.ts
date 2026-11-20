/**
 * 🗓 "SOME MONTHS" IS READ BACK, NOT ONLY WRITTEN (owner 2026-11-17, migration 20271355916558).
 *
 * Onboarding writes `date_mode = 'months'` + `events.date_months`. Until this guard, no reader selected
 * `date_months` and no caller passed it to the shared date words, so a couple who picked "Some months" saw their
 * months nowhere after creating the event: the Suppliers line said "Pick your date", the Event details row said
 * nothing, the Suppliers date sheet opened on an empty pick, Papic said "Pick the day", and a supplier's
 * "What is agreed" card said "No date set yet". A failure that renders like emptiness.
 *
 * Two halves:
 *  1. BEHAVIOUR — every reader says the months.
 *  2. SOURCE — every caller of the shared date words passes `months`, every select that feeds one of these
 *     readers names `date_months`, and every date-options object built from a row carries the row's months
 *     (that last scan also caught the supplier side: the customer list, the inquiry and the event lines). The file list is DERIVED (every non-test file whose select names both
 *     `date_mode` and `date_window_end`), so a seventh reader is caught without editing this test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDateWords, dateOptionsFactWords } from '@/lib/event-date-options';
import { suppliersDateFact } from '@/lib/suppliers-shell';
import { dateLadder } from '@/lib/suppliers-fact-sheets';
import { describeEventDate } from '@/lib/event-details-sheet';
import { yourEventDateDisplay } from '@/lib/details-your-event';
import { papicWaitsForTheDayWords } from '@/lib/papic-waits-for-the-day';
import { eventDateWords } from '@/lib/agreed-now';
import { eventDateOptionWords } from '@/lib/event-chat-title';
import { stripComments } from '@/lib/strip-comments';

const MONTHS = ['2027-02-01', '2027-04-01', '2027-05-01'];
const SAID = 'Feb · Apr · May 2027';

const row = {
  event_date: null,
  event_date_precision: 'day',
  date_mode: 'months',
  date_candidates: null,
  date_window_start: null,
  date_window_end: null,
  date_months: MONTHS,
  event_days: 1,
  event_type: 'wedding',
};

test('the shared words say the months', () => {
  assert.equal(openDateWords({ mode: 'months', candidates: null, windowStart: null, windowEnd: null, months: MONTHS }), `in ${SAID}`);
  assert.equal(dateOptionsFactWords({ mode: 'months', candidates: null, windowStart: null, windowEnd: null, days: 1, months: MONTHS }), SAID);
});

test('the Suppliers date line says the months, never "Pick your date"', () => {
  const fact = suppliersDateFact(null, 'day', {
    options: { mode: 'months', candidates: null, windowStart: null, windowEnd: null, days: 1, months: MONTHS },
  });
  assert.equal(fact.text, SAID);
  assert.equal(fact.open, true);
});

test('the Suppliers date sheet ladder lights Year and Month and names the months', () => {
  const rungs = dateLadder({
    date: null,
    precision: null,
    ceremonyTime: null,
    bookedNames: [],
    bookedDay: null,
    days: 1,
    options: { mode: 'months', candidates: [], windowStart: null, windowEnd: null, months: MONTHS },
  });
  const by = Object.fromEntries(rungs.map((r) => [r.key, r]));
  assert.equal(by.year?.on, true);
  assert.equal(by.year?.value, '2027');
  assert.equal(by.month?.on, true);
  assert.equal(by.month?.value, 'February 2027 – May 2027');
  assert.equal(by.day?.note, `considering ${SAID}`);
});

test('Event details and Your event say "Not settled · in …"', () => {
  assert.equal(describeEventDate(row), `Not settled · in ${SAID}`);
  assert.equal(yourEventDateDisplay(row, 'day'), `Not settled · in ${SAID}`);
});

test('Papic names the months it waits for', () => {
  assert.equal(papicWaitsForTheDayWords(row), `Switches on when you pick the day · you’re considering ${SAID}`);
});

test("a supplier's What-is-agreed card says the months, never \"No date set yet\"", () => {
  const words = eventDateWords({
    eventDate: null,
    estimatedPax: null,
    finalPax: null,
    dateOptions: { mode: 'months', candidates: null, windowStart: null, windowEnd: null, days: 1, months: MONTHS },
  });
  assert.equal(words, `Not settled · in ${SAID}`);
});

test("a supplier's customer list, inquiry and event lines say the months", () => {
  assert.equal(eventDateOptionWords({ eventDate: null, precision: null, candidates: null, windowStart: null, windowEnd: null, months: MONTHS }), `${SAID} · months`);
  // A real date, a candidate or a window still wins — months are said only when nothing else is.
  assert.equal(eventDateOptionWords({ eventDate: null, precision: null, candidates: ['2027-05-22'], windowStart: null, windowEnd: null, months: MONTHS }), 'May 22, 2027 · option');
});

test('a dropped months value stays honest: no months → nothing invented', () => {
  assert.equal(openDateWords({ mode: 'months', candidates: null, windowStart: null, windowEnd: null, months: null }), null);
  assert.equal(
    eventDateWords({ eventDate: null, estimatedPax: null, finalPax: null, dateOptions: { mode: 'months', candidates: null, windowStart: null, windowEnd: null, days: 1, months: [] } }),
    'No date set yet',
  );
});

/* ── SOURCE ─────────────────────────────────────────────────────────────────────────────────────────────────── */

const WEB = path.resolve(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p);
  }
  return out;
}

/** Comments out (the ONE shared stripper), so a note naming a column never counts as reading it. */
const code = (src: string): string => stripComments(src);

const FILES = [...walk(path.join(WEB, 'app')), ...walk(path.join(WEB, 'lib'))];

/** The date-word readers live in these; onboarding and create-event are WRITERS of the mode, not readers. */
const WRITERS = /[\\/](onboarding|create-event)[\\/]|[\\/]lib[\\/](onboarding[\\/]|create-event-capture)/;

test('every select that reads the open date also reads date_months', () => {
  const readers: string[] = [];
  const missing: string[] = [];
  for (const f of FILES) {
    if (WRITERS.test(f)) continue;
    const src = code(fs.readFileSync(f, 'utf8'));
    // A select string (or a columns constant) naming both: one literal, or adjacent literals joined by `+`.
    const literals = src.match(/(['"`])(?:(?!\1)[^\\\n]|\\.)*\1(\s*\+\s*(['"`])(?:(?!\3)[^\\\n]|\\.)*\3)*/g) ?? [];
    for (const lit of literals) {
      if (!/\bdate_mode\b/.test(lit) || !/\bdate_window_end\b/.test(lit)) continue;
      readers.push(path.relative(WEB, f));
      if (!/\bdate_months\b/.test(lit)) missing.push(path.relative(WEB, f));
    }
  }
  // Floored: the walk must find the readers this fix wired (six files today), or the scan is broken.
  assert.ok(new Set(readers).size >= 6, `only ${new Set(readers).size} readers found — the scan is broken: ${[...new Set(readers)].join(', ')}`);
  assert.deepEqual(missing, [], `these selects read the open date without date_months:\n  ${missing.join('\n  ')}`);
});

test('every call of the shared date words passes months', () => {
  const calls: string[] = [];
  const missing: string[] = [];
  for (const f of FILES) {
    if (f.endsWith(`${path.sep}event-date-options.ts`)) continue;
    const src = code(fs.readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/\b(openDateWords|dateOptionsFactWords)\(\s*\{([^}]*)\}/g)) {
      calls.push(`${path.relative(WEB, f)}:${m[1]}`);
      if (!/\bmonths\s*:/.test(m[2] ?? '')) missing.push(`${path.relative(WEB, f)}:${m[1]}`);
    }
  }
  assert.ok(calls.length >= 3, `only ${calls.length} calls found — the scan is broken`);
  assert.deepEqual(missing, [], `these calls drop the months:\n  ${missing.join('\n  ')}`);
});

/* The call scan above only sees the two shared functions by name. The Suppliers line passes its options through
   `suppliersDateFact` and the chat card through `dateOptions` — a sabotage there stayed GREEN on the first cut. So:
   every options object built from a database row's `date_window_end` must carry the row's months as well. */
/** Row-built date options that FILTER and never say a date — each with its reason. Add a line only with one. */
const FILTERS_NOT_WORDS: Readonly<Record<string, string>> = {
  'app/(shell)/explore/_lib/marketplace-view.tsx':
    "`coupleFitDates` feeds Find's free-on-your-date filter (`fitDateScope`); months would be a new filter rule, not words",
};

test('every date-options object built from a row carries the months', () => {
  const objects: string[] = [];
  const missing: string[] = [];
  for (const f of FILES) {
    if (WRITERS.test(f)) continue;
    if (FILTERS_NOT_WORDS[path.relative(WEB, f).split(path.sep).join('/')]) continue;
    const src = code(fs.readFileSync(f, 'utf8'));
    for (const m of src.matchAll(/\{[^{}]*\bwindowEnd:\s*\w+\.date_window_end\b[^{}]*\}/g)) {
      objects.push(path.relative(WEB, f));
      if (!/\bmonths:[^,}]*\bdate_months\b/.test(m[0])) missing.push(path.relative(WEB, f));
    }
  }
  assert.ok(objects.length >= 9, `only ${objects.length} row-built date options found — the scan is broken: ${objects.join(', ')}`);
  assert.deepEqual(missing, [], `these build date options from a row without its months:\n  ${missing.join('\n  ')}`);
});

test('the Suppliers date sheet keeps a months event as months', () => {
  const src = code(fs.readFileSync(path.join(WEB, 'app/dashboard/[eventId]/vendors/_actions/fact-sheet.ts'), 'utf8'));
  assert.match(src, /live\.date_mode === 'months' \? 'months'/, "the sheet's loader folds 'months' into 'specific' again");
  assert.match(src, /months:\s*cleanDateMonths\(live\.date_months\)/, "the sheet's loader no longer passes the months");
});
