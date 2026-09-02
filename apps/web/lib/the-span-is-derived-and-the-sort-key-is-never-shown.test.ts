/**
 * TWO THINGS ABOUT THE TIMELINE THAT WOULD FAIL SILENTLY.
 *
 * 1. THE SPAN IS DERIVED. 7a forbids storing it ("a stored span goes stale the
 *    first time a date moves"), so clusterSpan() recomputes it on every read.
 *    A wrong span does not throw and does not look broken — it just quietly
 *    describes a year the group no longer covers.
 *
 * 2. 🛑 `sort_key` IS NOT A DATE ANYBODY CHOSE. It is the MIDPOINT of the range
 *    a row's precision claims, and it exists only so "Sometime in 2027" does
 *    not sort as if it were New Year's Day. Rendering it would tell a couple
 *    their engagement party is on July 2nd — a specific, plausible, entirely
 *    invented day. The last test here is a source scan pinning that no surface
 *    ever draws it, because nothing about that mistake looks wrong on screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  clusterSpan,
  isApproximate,
  timelineDateLabel,
  type ClusterTimelineRow,
} from './clusters';

function row(p: Partial<ClusterTimelineRow>): ClusterTimelineRow {
  return {
    event_id: 'e',
    display_name: 'A celebration',
    event_type: 'celebration',
    event_date: null,
    event_end_date: null,
    event_date_precision: 'day',
    is_anchor: false,
    range_start: null,
    range_end: null,
    sort_key: null,
    ...p,
  };
}

/* ── labels ──────────────────────────────────────────────────────────────── */

test('each precision speaks in the words its host actually chose', () => {
  assert.equal(
    timelineDateLabel({ event_date: '2027-01-01', event_date_precision: 'year' }),
    'Sometime in 2027',
    'a year-precision celebration was given a day its host never picked',
  );
  assert.equal(
    timelineDateLabel({ event_date: '2027-08-01', event_date_precision: 'month' }),
    'August 2027',
  );
  assert.equal(
    timelineDateLabel({ event_date: '2027-08-15', event_date_precision: 'day' }),
    // ⚠ Sunday, not the "Friday, August 15, 2027" that iteration 0021's comment
    // block and this repo's docs use as an illustration — that string was only
    // ever an example of the SHAPE. 2027-08-15 really is a Sunday.
    'Sunday, August 15, 2027',
  );
});

test('no date, and an unrecognised precision, both say so rather than guessing', () => {
  assert.equal(timelineDateLabel({ event_date: null, event_date_precision: 'day' }), 'Date to be confirmed');
  // event_date holds a PLACEHOLDER whenever precision is not 'day', so an
  // unreadable precision means any date we print is confidently wrong.
  assert.equal(
    timelineDateLabel({ event_date: '2027-08-15', event_date_precision: 'quarter' }),
    'Date to be confirmed',
  );
});

test('a multi-day celebration shows its range — but only at day precision', () => {
  assert.equal(
    timelineDateLabel({
      event_date: '2027-05-01',
      event_end_date: '2027-05-04',
      event_date_precision: 'day',
    }),
    'Saturday, May 1, 2027 – Tuesday, May 4, 2027',
  );
  // Two placeholders pretending to be a plan.
  assert.equal(
    timelineDateLabel({
      event_date: '2027-01-01',
      event_end_date: '2027-12-31',
      event_date_precision: 'year',
    }),
    'Sometime in 2027',
  );
});

test('an approximate date is flagged as approximate', () => {
  assert.equal(isApproximate({ event_date: '2027-01-01', event_date_precision: 'year' }), true);
  assert.equal(isApproximate({ event_date: '2027-08-01', event_date_precision: 'month' }), true);
  assert.equal(isApproximate({ event_date: '2027-08-15', event_date_precision: 'day' }), false);
  assert.equal(isApproximate({ event_date: null, event_date_precision: 'year' }), false);
});

/* ── the derived span ────────────────────────────────────────────────────── */

test('the span runs from the earliest start to the latest end, across mixed precisions', () => {
  const span = clusterSpan([
    row({ range_start: '2027-03-05', range_end: '2027-03-05' }), // the wedding
    row({ range_start: '2027-01-01', range_end: '2027-12-31' }), // "Sometime in 2027"
    row({ range_start: '2028-02-01', range_end: '2028-02-29' }), // "February 2028"
  ]);
  assert.equal(span, 'January 2027 – February 2028');
});

test('a span inside one month is stated once, not as a range to itself', () => {
  assert.equal(
    clusterSpan([row({ range_start: '2027-08-01', range_end: '2027-08-31' })]),
    'August 2027',
  );
});

test('a group whose celebrations have no dates has no span, and does not invent one', () => {
  assert.equal(clusterSpan([]), null);
  assert.equal(clusterSpan([row({}), row({})]), null, 'undated members produced a span from nothing');
});

test('an undated member does not drag the span, it is simply absent from it', () => {
  assert.equal(
    clusterSpan([
      row({ range_start: '2027-06-01', range_end: '2027-06-30' }),
      row({}), // no date yet
    ]),
    'June 2027',
  );
});

/* ── the sort key must never reach a person ──────────────────────────────── */

test('no surface renders sort_key', () => {
  const roots = [
    path.join(__dirname, '..', 'app', 'dashboard', '(account)', 'clusters'),
  ];
  const offenders: string[] = [];

  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
        continue;
      }
      if (!/\.tsx?$/.test(full)) continue;
      const src = readFileSync(full, 'utf8');
      // Strip block and line comments — this file's own warnings name the
      // field, and so do the surfaces'. Only real code counts.
      const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (/\bsort_key\b/.test(code)) offenders.push(path.relative(process.cwd(), full));
    }
  };
  for (const r of roots) walk(r);

  assert.deepEqual(
    offenders,
    [],
    'sort_key is the MIDPOINT of an uncertain range — drawing it invents a day the host never chose',
  );
});
