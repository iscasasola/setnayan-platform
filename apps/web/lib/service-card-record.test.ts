/**
 * THE CARD RECORD — pure compiler tests.
 *
 * Every rule that decides what a card has "earned" lives in compileCardRecord()
 * and its helpers, so all of it is asserted here without a database: the mix
 * maths, the milestone ladder's edges, the pax-band labelling, and the ledger's
 * cap and ordering.
 *
 * What is NOT tested here, on purpose: the privacy envelope. It is enforced in
 * SQL (the reader never emits a name, an id, an exact date or an exact pax), so
 * it is asserted against real SQL in tests/db/service-card-record.db.test.ts. A
 * TypeScript test could only re-state the shape, not the guarantee.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  compileCardRecord,
  milestonesFor,
  paxBandLabel,
  formatRecordMonth,
  MILESTONE_THRESHOLDS,
  LEDGER_MAX,
  EMPTY_CARD_RECORD,
  type ServiceCardRecordRow,
} from './service-card-record';

// ---------------------------------------------------------------------------
// Milestone medals — a pure function of the count, edges included
// ---------------------------------------------------------------------------

test('the ladder is the owner-locked 10 / 25 / 50 / 100', () => {
  assert.deepEqual([...MILESTONE_THRESHOLDS], [10, 25, 50, 100]);
});

test('milestones: nothing earned below the first rung', () => {
  for (const n of [0, 1, 9]) {
    assert.deepEqual(milestonesFor(n), { earned: [], next: 10 }, `count ${n}`);
  }
});

test('milestones: a rung is earned AT its threshold, not one past it', () => {
  assert.deepEqual(milestonesFor(10), { earned: [10], next: 25 });
  assert.deepEqual(milestonesFor(25), { earned: [10, 25], next: 50 });
  assert.deepEqual(milestonesFor(50), { earned: [10, 25, 50], next: 100 });
  assert.deepEqual(milestonesFor(100), { earned: [10, 25, 50, 100], next: null });
});

test('milestones: just under a rung has not earned it', () => {
  assert.deepEqual(milestonesFor(24), { earned: [10], next: 25 });
  assert.deepEqual(milestonesFor(49), { earned: [10, 25], next: 50 });
  assert.deepEqual(milestonesFor(99), { earned: [10, 25, 50], next: 100 });
});

test('milestones: past the top rung there is no next medal (we invent none)', () => {
  assert.deepEqual(milestonesFor(150), { earned: [10, 25, 50, 100], next: null });
});

test('milestones: junk counts degrade to zero rather than throwing', () => {
  assert.deepEqual(milestonesFor(-5), { earned: [], next: 10 });
  assert.deepEqual(milestonesFor(Number.NaN), { earned: [], next: 10 });
});

// ---------------------------------------------------------------------------
// Pax banding — this module owns the LABELS only; SQL owns the thresholds
// ---------------------------------------------------------------------------

test('pax bands: every key the reader emits has a label', () => {
  assert.equal(paxBandLabel('under_50'), 'Under 50 pax');
  assert.equal(paxBandLabel('50_99'), '50–99 pax');
  assert.equal(paxBandLabel('100_199'), '100–199 pax');
  assert.equal(paxBandLabel('200_plus'), '200+ pax');
});

test('pax bands: unknown reads as no chip, never as a raw code', () => {
  assert.equal(paxBandLabel('unknown'), null);
  assert.equal(paxBandLabel(null), null);
  assert.equal(paxBandLabel(undefined), null);
  assert.equal(paxBandLabel(''), null);
  // A band key this build has never heard of must not leak through as text.
  assert.equal(paxBandLabel('1000_plus'), null);
});

// ---------------------------------------------------------------------------
// Month formatting
// ---------------------------------------------------------------------------

test('month: YYYY-MM renders as a short month + year, parsed as UTC', () => {
  assert.equal(formatRecordMonth('2026-06'), 'Jun 2026');
  assert.equal(formatRecordMonth('2026-01'), 'Jan 2026');
  assert.equal(formatRecordMonth('2025-12'), 'Dec 2025');
});

test('month: anything that is not YYYY-MM renders as nothing, never "Invalid Date"', () => {
  assert.equal(formatRecordMonth(null), null);
  assert.equal(formatRecordMonth(''), null);
  assert.equal(formatRecordMonth('2026'), null);
  assert.equal(formatRecordMonth('2026-06-14'), null);
  assert.equal(formatRecordMonth('not-a-month'), null);
});

// ---------------------------------------------------------------------------
// compileCardRecord — the whole view model
// ---------------------------------------------------------------------------

test('a missing payload compiles to the zero record (a failed read shows nothing)', () => {
  assert.deepEqual(compileCardRecord(null), EMPTY_CARD_RECORD);
  assert.deepEqual(compileCardRecord(undefined), EMPTY_CARD_RECORD);
});

// ---------------------------------------------------------------------------
// TOTALITY — this runs inside a page render on a public route, so it may never
// throw for ANY input. A 500 on a vendor's whole profile page is not an
// acceptable failure mode for a decorative history section.
// ---------------------------------------------------------------------------

test('a whole-payload junk value compiles to the zero record, never a throw', () => {
  for (const junk of [
    42,
    'a string',
    true,
    [],
    [1, 2, 3],
    Number.NaN,
    Symbol('nope'),
    () => {},
  ]) {
    assert.doesNotThrow(() => compileCardRecord(junk), `input ${String(junk)}`);
    assert.deepEqual(compileCardRecord(junk), EMPTY_CARD_RECORD, `input ${String(junk)}`);
  }
});

test('a junk ELEMENT is skipped and its valid neighbours survive', () => {
  const c = compileCardRecord({
    booked_count: 9,
    type_mix: [
      null,
      'not an object',
      42,
      ['nested', 'array'],
      { event_type: 'wedding', n: 6 },
      { /* no fields at all */ },
      { event_type: 'debut', n: 3 },
    ],
    ledger: [
      null,
      'junk',
      { event_type: 'wedding', month_year: '2026-06', pax_band: '100_199' },
      99,
      { event_type: 'debut', month_year: '2026-05', pax_band: 'unknown' },
    ],
  });

  assert.equal(c.bookedCount, 9);
  assert.deepEqual(c.mix.map((m) => m.eventType), ['wedding', 'debut']);
  assert.deepEqual(c.ledger.map((r) => r.month), ['Jun 2026', 'May 2026']);
});

test('junk field TYPES inside a well-shaped element degrade, never throw', () => {
  const c = compileCardRecord({
    booked_count: { nope: true },
    type_mix: [
      { event_type: 12345, n: 4 }, // non-string type → dropped (unlabelable)
      { event_type: 'wedding', n: { bad: 1 } }, // non-numeric count → dropped
      { event_type: 'debut', n: '2' }, // numeric string → kept
    ],
    ledger: [
      { event_type: null, month_year: 7, pax_band: [] },
      { event_type: 'wedding', month_year: '2026-06', pax_band: 'under_50' },
    ],
  });

  assert.equal(c.bookedCount, 0, 'an unparseable count degrades to 0');
  assert.deepEqual(c.mix.map((m) => m.eventType), ['debut']);
  assert.equal(c.ledger.length, 2);
  // The unlabelable row still renders honestly rather than as "Invalid Date".
  assert.deepEqual(c.ledger[1], { label: 'Event', month: null, pax: null });
});

test('a non-array mix/ledger degrades to empty, never throws', () => {
  const c = compileCardRecord({ booked_count: 5, type_mix: 'nope', ledger: { a: 1 } });
  assert.equal(c.bookedCount, 5);
  assert.deepEqual(c.mix, []);
  assert.deepEqual(c.ledger, []);
});

// ---------------------------------------------------------------------------
// THE COUNT-ONLY SHAPE — what the SQL minimum-N floor produces. A first-class
// state, not a degraded one: the count and the medals stand alone.
// ---------------------------------------------------------------------------

test('count-only (SQL min-N floor): the count and medals survive an empty mix + ledger', () => {
  const c = compileCardRecord({ booked_count: 2, type_mix: [], ledger: [] });
  assert.equal(c.bookedCount, 2);
  assert.deepEqual(c.mix, [], 'suppressed below the floor');
  assert.deepEqual(c.ledger, [], 'suppressed below the floor');
  assert.deepEqual(c.milestones, { earned: [], next: 10 }, 'medals still compute');
});

test('count-only at a milestone still earns its medal', () => {
  const c = compileCardRecord({ booked_count: 30, type_mix: [], ledger: [] });
  assert.equal(c.bookedCount, 30);
  assert.deepEqual(c.milestones, { earned: [10, 25], next: 50 });
});

test('the compiler holds NO minimum-N constant — the floor lives only in SQL', () => {
  // Proof by behaviour: an above-floor count with a populated mix compiles it
  // through untouched, and a below-floor count with a (hypothetically)
  // populated mix ALSO compiles it through. The compiler never suppresses —
  // which is exactly why it cannot drift from the SQL floor.
  const below = compileCardRecord({
    booked_count: 1,
    type_mix: [{ event_type: 'wedding', n: 1 }],
    ledger: [{ event_type: 'wedding', month_year: '2026-01', pax_band: 'unknown' }],
  });
  assert.equal(below.mix.length, 1, 'the compiler renders what SQL gives it');
  assert.equal(below.ledger.length, 1);
});

test('an empty record stays empty and earns no medal', () => {
  const c = compileCardRecord({ booked_count: 0, type_mix: [], ledger: [] });
  assert.equal(c.bookedCount, 0);
  assert.deepEqual(c.mix, []);
  assert.deepEqual(c.ledger, []);
  assert.deepEqual(c.milestones, { earned: [], next: 10 });
});

test('mix maths: sorted count-desc, labeled, and the percentages sum to 100', () => {
  const raw: ServiceCardRecordRow = {
    booked_count: 50,
    type_mix: [
      { event_type: 'debut', n: 9 },
      { event_type: 'wedding', n: 34 },
      { event_type: 'corporate', n: 7 },
    ],
    ledger: [],
  };
  const c = compileCardRecord(raw);

  assert.equal(c.bookedCount, 50);
  assert.deepEqual(
    c.mix.map((m) => [m.eventType, m.n]),
    [
      ['wedding', 34],
      ['debut', 9],
      ['corporate', 7],
    ],
  );
  assert.deepEqual(
    c.mix.map((m) => m.label),
    ['Wedding', 'Debut', 'Corporate'],
  );

  const total = c.mix.reduce((s, m) => s + m.pct, 0);
  assert.ok(Math.abs(total - 100) < 1e-9, `percentages summed to ${total}`);
  assert.ok(Math.abs(c.mix[0]!.pct - 68) < 1e-9, `wedding pct was ${c.mix[0]!.pct}`);
});

test('mix maths: percentages are against the MIX total, so the bar always fills', () => {
  // booked_count deliberately disagrees with the mix (it cannot in practice —
  // this asserts the bar geometry does not depend on that agreement).
  const c = compileCardRecord({
    booked_count: 999,
    type_mix: [
      { event_type: 'wedding', n: 3 },
      { event_type: 'debut', n: 1 },
    ],
    ledger: [],
  });
  assert.equal(c.bookedCount, 999);
  assert.equal(c.mix[0]!.pct, 75);
  assert.equal(c.mix[1]!.pct, 25);
});

test('mix maths: ties break on the slug so the bar is deterministic', () => {
  const c = compileCardRecord({
    booked_count: 4,
    type_mix: [
      { event_type: 'wedding', n: 2 },
      { event_type: 'debut', n: 2 },
    ],
    ledger: [],
  });
  assert.deepEqual(c.mix.map((m) => m.eventType), ['debut', 'wedding']);
});

test('mix maths: numeric strings from the JSON payload are coerced, not dropped', () => {
  const c = compileCardRecord({
    booked_count: '12',
    type_mix: [{ event_type: 'wedding', n: '12' }],
    ledger: [],
  });
  assert.equal(c.bookedCount, 12);
  assert.equal(c.mix[0]!.n, 12);
  assert.deepEqual(c.milestones, { earned: [10], next: 25 });
});

test('mix maths: unlabelable or empty slices are dropped', () => {
  const c = compileCardRecord({
    booked_count: 5,
    type_mix: [
      { event_type: 'wedding', n: 5 },
      { event_type: null, n: 3 },
      { event_type: '  ', n: 2 },
      { event_type: 'debut', n: 0 },
    ],
    ledger: [],
  });
  assert.deepEqual(c.mix.map((m) => m.eventType), ['wedding']);
});

test('ledger: capped at LEDGER_MAX and ordered newest-first', () => {
  const months = [
    '2025-11',
    '2026-05',
    '2026-01',
    '2026-06',
    '2025-08',
    '2026-03',
    '2026-02',
    '2024-12',
  ];
  assert.ok(months.length > LEDGER_MAX, 'fixture must exceed the cap to test it');

  const c = compileCardRecord({
    booked_count: months.length,
    type_mix: [{ event_type: 'wedding', n: months.length }],
    ledger: months.map((m) => ({
      event_type: 'wedding',
      month_year: m,
      pax_band: '100_199',
    })),
  });

  assert.equal(c.ledger.length, LEDGER_MAX);
  assert.deepEqual(
    c.ledger.map((r) => r.month),
    ['Jun 2026', 'May 2026', 'Mar 2026', 'Feb 2026', 'Jan 2026', 'Nov 2025'],
  );
});

test('ledger: rows are labeled and pax-banded; unknown pax renders no chip', () => {
  const c = compileCardRecord({
    booked_count: 3,
    type_mix: [],
    ledger: [
      { event_type: 'wedding', month_year: '2026-06', pax_band: '200_plus' },
      { event_type: 'gender_reveal', month_year: '2026-04', pax_band: 'under_50' },
      { event_type: 'corporate', month_year: '2026-02', pax_band: 'unknown' },
    ],
  });

  assert.deepEqual(c.ledger, [
    { label: 'Wedding', month: 'Jun 2026', pax: '200+ pax' },
    { label: 'Gender Reveal', month: 'Apr 2026', pax: 'Under 50 pax' },
    { label: 'Corporate', month: 'Feb 2026', pax: null },
  ]);
});

test('ledger: a row with no month is KEPT — the event is real, only its date is missing', () => {
  const c = compileCardRecord({
    booked_count: 2,
    type_mix: [],
    ledger: [
      { event_type: 'wedding', month_year: '2026-06', pax_band: 'unknown' },
      { event_type: 'debut', month_year: null, pax_band: 'unknown' },
    ],
  });
  assert.equal(c.ledger.length, 2);
  assert.deepEqual(c.ledger.map((r) => r.label), ['Wedding', 'Debut']);
  assert.equal(c.ledger[1]!.month, null);
});

test('a null mix/ledger from the reader compiles to empty arrays, not a crash', () => {
  const c = compileCardRecord({ booked_count: 7, type_mix: null, ledger: null });
  assert.equal(c.bookedCount, 7);
  assert.deepEqual(c.mix, []);
  assert.deepEqual(c.ledger, []);
  assert.deepEqual(c.milestones, { earned: [], next: 10 });
});

test('compileCardRecord is pure — the same input compiles identically twice', () => {
  const raw: ServiceCardRecordRow = {
    booked_count: 27,
    type_mix: [
      { event_type: 'wedding', n: 20 },
      { event_type: 'debut', n: 7 },
    ],
    ledger: [{ event_type: 'wedding', month_year: '2026-06', pax_band: '50_99' }],
  };
  assert.deepEqual(compileCardRecord(raw), compileCardRecord(raw));
});
