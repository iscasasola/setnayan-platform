/**
 * card-dates.test.ts — a card may claim the date ONLY when one day survives.
 *
 * The `sets` cases are the ones that matter: every other outcome is cosmetic,
 * but claiming "this sets your date" when two days remain tells a couple their
 * wedding day is decided when it is not.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_INLINE_DATES,
  cardDates,
  dateOutcome,
} from './card-dates';

// ── cardDates ───────────────────────────────────────────────────────────────

test('four or fewer days are all named inline, nothing hidden', () => {
  const d = cardDates({ freeDays: ['a', 'b', 'c', 'd'], windowSize: 6 });
  assert.deepEqual(d?.shown, ['a', 'b', 'c', 'd']);
  assert.equal(d?.hidden, 0);
});

test('the FIFTH day goes behind the disclosure — the owner’s number', () => {
  assert.equal(MAX_INLINE_DATES, 4);
  const d = cardDates({ freeDays: ['a', 'b', 'c', 'd', 'e'], windowSize: 7 });
  assert.deepEqual(d?.shown, ['a', 'b', 'c', 'd']);
  assert.equal(d?.hidden, 1);
  assert.equal(d?.all.length, 5, 'the popup must still hold every day');
});

test('a wide window names none and counts instead — 28 chips is not information', () => {
  const days = Array.from({ length: 24 }, (_, i) => `d${i}`);
  const d = cardDates({ freeDays: days, windowSize: 30 });
  assert.equal(d?.wide, true);
  assert.deepEqual(d?.shown, []);
  assert.equal(d?.hidden, 24);
  assert.equal(d?.all.length, 24, 'the popup still holds them all');
});

test('no calendar signal says nothing at all — never a false "booked"', () => {
  assert.equal(cardDates({ freeDays: null, windowSize: 6 }), null);
});

test('no free day says nothing — the amber clash badge already covers it', () => {
  assert.equal(cardDates({ freeDays: [], windowSize: 6 }), null);
});

test('the popup list is never truncated, however many there are', () => {
  const days = Array.from({ length: 9 }, (_, i) => `d${i}`);
  const d = cardDates({ freeDays: days, windowSize: 8 });
  assert.equal(d?.all.length, 9);
  assert.equal(d!.shown.length + d!.hidden, 9, 'shown + hidden must account for every day');
});

// ── dateOutcome ─────────────────────────────────────────────────────────────

test('🔑 ONE viable day sets the date — the only case that may claim it', () => {
  assert.deepEqual(
    dateOutcome({ viableDays: ['2027-09-12'], dateAnchored: false }),
    { kind: 'sets', day: '2027-09-12' },
  );
});

test('🔑 TWO viable days NARROW — mirrors actions.ts `viable.length === 1`', () => {
  // The Glasshouse Alta case: free Sep 12 AND Sep 26. The prototype claims
  // this sets the date to Sep 12. It does not.
  const o = dateOutcome({ viableDays: ['2027-09-12', '2027-09-26'], dateAnchored: false });
  assert.equal(o?.kind, 'narrows');
  assert.equal(o?.kind === 'narrows' && o.count, 2);
});

test('an anchored date says nothing — dateFit already answers the only question left', () => {
  assert.equal(dateOutcome({ viableDays: ['2027-09-12'], dateAnchored: true }), null);
});

test('no overlap says nothing — the amber badge names the clash better', () => {
  assert.equal(dateOutcome({ viableDays: [], dateAnchored: false }), null);
});

test('no signal never claims an outcome', () => {
  assert.equal(dateOutcome({ viableDays: null, dateAnchored: false }), null);
});

test('a vendor free on many days never claims to set the date', () => {
  for (let n = 2; n <= 12; n++) {
    const days = Array.from({ length: n }, (_, i) => `d${i}`);
    const o = dateOutcome({ viableDays: days, dateAnchored: false });
    assert.equal(o?.kind, 'narrows', `${n} viable days must narrow, never set`);
  }
});

/* ── THE SOURCE HALF ─────────────────────────────────────────────────────────
   Every assertion above passes if the card stops rendering any of this. These
   read the component. */
import { readFileSync } from 'node:fs';
import { stripComments } from '@/lib/strip-comments';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH_RAW = readFileSync(
  resolve(HERE, '../app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'),
  'utf8',
);
/* Comment-stripped for any assertion about what the component SAYS. The first
   draft of the last test in this file failed on its own docblock, which
   explains the rule it was enforcing — a guard that reads prose is measuring
   the wrong thing. */
const BENCH = stripComments(BENCH_RAW);

test('source · the card renders the date block, on BOTH rails', () => {
  assert.match(BENCH, /function CardDateBlock\(/, 'the date block is gone');
  assert.match(BENCH, /<CardDateBlock/, 'the card no longer renders it');
  const wired = BENCH.match(/dates=\{dateViewFor\(v\)\}/g) ?? [];
  assert.equal(
    wired.length,
    2,
    'both VendorCard call sites must pass dates — the fits rail AND the sunk ' +
      `rail. Found ${wired.length}.`,
  );
});

test('source · the outcome is computed against the SAME buildWindow the sink uses', () => {
  const fn = BENCH.slice(BENCH.indexOf('const dateViewFor'), BENCH.indexOf('const [planEditing'));
  assert.match(fn, /buildWindow\?\.dayKeys/, 'the intersection no longer reads the build window');
  assert.match(fn, /dateAnchored:\s*buildWindow\?\.source === 'anchored'/,
    'an anchored date must silence the outcome line');
  // A second window here would be free to drift from the banner and the sink.
  assert.ok(
    !/resolveProbeWindow|buildDateWindow\(/.test(fn),
    'the card must not derive its own window — one window, one classifier',
  );
});

test('source · the overflow trigger stops propagation, or it opens the inspector behind it', () => {
  const block = BENCH.slice(BENCH.indexOf('function CardDateBlock('), BENCH.indexOf('function VendorCard('));
  assert.match(block, /className="fd-more"/, 'the overflow trigger is gone');
  assert.match(block, /e\.preventDefault\(\)/, 'the press would follow the card link');
  assert.match(block, /e\.stopPropagation\(\)/, 'the press would also open the quick-view');
  assert.match(block, /aria-expanded=\{open\}/, 'the disclosure state is not announced');
});

test('source · the popup lists EVERY date, not the truncated set', () => {
  const block = BENCH.slice(BENCH.indexOf('function CardDateBlock('), BENCH.indexOf('function VendorCard('));
  assert.match(block, /parts\.all\.map/, 'the popup renders the truncated list, not all of them');
  assert.ok(
    !/parts\.shown\.map[\s\S]{0,200}fd-chip/.test(block),
    'the popup must not re-render the inline slice',
  );
});

test('source · the "sets your date" sentence exists in ONE place', () => {
  const copy = readFileSync(resolve(HERE, 'explore-info-copy.ts'), 'utf8');
  assert.match(copy, /Locking this sets your date to/, 'the outcome copy is gone');
  // The component must not hand-write it — it renders dateOutcomeLine().
  assert.ok(
    !/sets your date/i.test(BENCH),
    'the component hardcodes the sentence — it must come from dateOutcomeLine, ' +
      'which is the only thing that enforces the one-viable-day rule',
  );
});
