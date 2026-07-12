import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCreateCapture } from './create-event-capture';
import { BUDGET_BANDS_FALLBACK } from './budget-bands-shared';

const BANDS = BUDGET_BANDS_FALLBACK;

test('all-empty input → no date, no pax, no budget (name-only creation still works)', () => {
  const r = resolveCreateCapture({}, BANDS);
  assert.deepEqual(r, {
    dateMode: null,
    dateCandidates: [],
    dateWindowStart: null,
    dateWindowEnd: null,
    estimatedPax: null,
    budgetBand: null,
    estimatedBudgetCentavos: null,
  });
});

test('specific: candidate dates → deduped, chronological, capped at 4', () => {
  const r = resolveCreateCapture(
    { dateModeRaw: 'specific', dateCandidatesRaw: ['2027-03-15', '2027-01-10', '2027-03-15', '', '2027-06-01', '2027-08-08'] },
    BANDS,
  );
  assert.equal(r.dateMode, 'specific');
  // deduped (one 3-15), blanks dropped, sorted, capped to 4
  assert.deepEqual(r.dateCandidates, ['2027-01-10', '2027-03-15', '2027-06-01', '2027-08-08']);
  assert.equal(r.dateWindowStart, null);
});

test('specific: a single candidate is fine (mode specific, one date)', () => {
  const r = resolveCreateCapture({ dateModeRaw: 'specific', dateCandidatesRaw: ['2027-05-20'] }, BANDS);
  assert.equal(r.dateMode, 'specific');
  assert.deepEqual(r.dateCandidates, ['2027-05-20']);
});

test('window: a valid (≤30d) start..end range → mode window, no candidates', () => {
  const r = resolveCreateCapture(
    { dateModeRaw: 'window', windowStartRaw: '2027-06-01', windowEndRaw: '2027-06-20' },
    BANDS,
  );
  assert.equal(r.dateMode, 'window');
  assert.equal(r.dateWindowStart, '2027-06-01');
  assert.equal(r.dateWindowEnd, '2027-06-20');
  assert.deepEqual(r.dateCandidates, []);
});

test('window: a backwards range is swapped chronological, not rejected', () => {
  const r = resolveCreateCapture(
    { dateModeRaw: 'window', windowStartRaw: '2027-06-20', windowEndRaw: '2027-06-01' },
    BANDS,
  );
  assert.equal(r.dateWindowStart, '2027-06-01');
  assert.equal(r.dateWindowEnd, '2027-06-20');
});

test('window: over-long range is clamped to 30 days inclusive (start + 29)', () => {
  const r = resolveCreateCapture(
    { dateModeRaw: 'window', windowStartRaw: '2027-06-01', windowEndRaw: '2027-12-31' },
    BANDS,
  );
  assert.equal(r.dateWindowStart, '2027-06-01');
  assert.equal(r.dateWindowEnd, '2027-06-30'); // 2027-06-01 + 29 days
});

test('window without a complete pair falls back to candidates (or none)', () => {
  const r = resolveCreateCapture({ dateModeRaw: 'window', windowStartRaw: '2027-06-01' }, BANDS);
  assert.equal(r.dateMode, null); // incomplete window, no candidates
  assert.equal(r.dateWindowStart, null);
});

test('invalid / overflow dates are dropped everywhere (never throw)', () => {
  const r = resolveCreateCapture(
    { dateModeRaw: 'specific', dateCandidatesRaw: ['2027-02-30', 'not-a-date', '2027-13-01', '2027-05-05'] },
    BANDS,
  );
  assert.deepEqual(r.dateCandidates, ['2027-05-05']);
});

test('guest count: positive integers only, capped at the DB ceiling (< 10000)', () => {
  assert.equal(resolveCreateCapture({ paxRaw: '150' }, BANDS).estimatedPax, 150);
  assert.equal(resolveCreateCapture({ paxRaw: '9999' }, BANDS).estimatedPax, 9999); // DB max
  // >= 10000 would violate the events.estimated_pax CHECK → degrade to null, never a hard insert failure.
  for (const bad of ['', '0', '-5', '12.5', 'abc', '10000', '99999', '999999999']) {
    assert.equal(resolveCreateCapture({ paxRaw: bad }, BANDS).estimatedPax, null, `${bad} rejected`);
  }
});

test('past dates are rejected when a `today` bound is given (no planning in the past)', () => {
  const today = '2026-07-12';
  const r = resolveCreateCapture(
    { dateModeRaw: 'specific', dateCandidatesRaw: ['2025-01-01', '2026-07-12', '2027-03-01'] },
    BANDS,
    { today },
  );
  // 2025 dropped (past); today + future kept.
  assert.deepEqual(r.dateCandidates, ['2026-07-12', '2027-03-01']);
  // A window entirely in the past collapses to no usable date.
  const w = resolveCreateCapture(
    { dateModeRaw: 'window', windowStartRaw: '2025-01-01', windowEndRaw: '2025-03-01' },
    BANDS,
    { today },
  );
  assert.equal(w.dateMode, null);
});

test('budget: band + pax → estimated centavos (med per-head × pax × 100)', () => {
  const r = resolveCreateCapture({ budgetBandRaw: 'classic', paxRaw: '200' }, BANDS); // classic med 5000
  assert.equal(r.budgetBand, 'classic');
  assert.equal(r.estimatedBudgetCentavos, 100_000_000);
});

test('budget band without pax → band saved, amount null; no_limit + legacy alias', () => {
  assert.equal(resolveCreateCapture({ budgetBandRaw: 'premium' }, BANDS).estimatedBudgetCentavos, null);
  const nl = resolveCreateCapture({ budgetBandRaw: 'nolimit', paxRaw: '200' }, BANDS);
  assert.equal(nl.budgetBand, 'no_limit');
  assert.equal(nl.estimatedBudgetCentavos, null);
});

test('unknown band → null (fail closed)', () => {
  const r = resolveCreateCapture({ budgetBandRaw: 'ultra_mega', paxRaw: '100' }, BANDS);
  assert.equal(r.budgetBand, null);
  assert.equal(r.estimatedBudgetCentavos, null);
});

test('all together: candidates + pax + budget', () => {
  const r = resolveCreateCapture(
    { dateModeRaw: 'specific', dateCandidatesRaw: ['2027-06-01', '2027-06-08'], paxRaw: '80', budgetBandRaw: 'simple' },
    BANDS,
  );
  assert.deepEqual(r.dateCandidates, ['2027-06-01', '2027-06-08']);
  assert.equal(r.estimatedPax, 80);
  assert.equal(r.estimatedBudgetCentavos, 3500 * 80 * 100);
});
