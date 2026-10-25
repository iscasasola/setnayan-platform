/**
 * saved-quote.test.ts — a saved quote is read back as untrusted, keeps no couple, and "Good for" counts PH days.
 * Run: cd apps/web && npx tsx --test lib/saved-quote.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSavedQuoteDraft, validDaysOf, validUntilFor, SAVED_QUOTE_MAX_LINES } from './saved-quote';

const LINE = { label: 'Lechon', basis: 'flat', free: false, flatPhp: 12000, ratePhp: 0, minPax: 0, basePhp: 0, inclHours: 0, extraPhp: 0 };
const DRAFT = {
  v: 1,
  lines: [LINE],
  crew: { mode: 'charge', size: 5, perHeadPhp: 350 },
  transport: { mode: 'flat', flatPhp: 2000 },
  discountPhp: 1000,
  discountReason: 'Booked early',
  schedule: { manual: [{ label: 'First payment', kind: 'percent', amountPhp: null, percent: 20, due: 'on_lock', offsetDays: 0 }], autoBalance: { label: 'Final balance', due: 'before_event', offsetDays: 7 } },
  validDays: 14,
  note: 'Salamat po!',
};

test('a whole draft reads back as written', () => {
  const d = parseSavedQuoteDraft(DRAFT);
  assert.ok(d);
  assert.equal(d!.lines[0]!.label, 'Lechon');
  assert.equal(d!.crew.mode, 'charge');
  assert.equal(d!.discountReason, 'Booked early');
  assert.equal(d!.validDays, 14);
});

test('anything unreadable is refused, never guessed', () => {
  for (const bad of [null, 'x', [], {}, { ...DRAFT, v: 2 }, { ...DRAFT, lines: [] }, { ...DRAFT, lines: [{ label: '' }] }]) {
    assert.equal(parseSavedQuoteDraft(bad), null, JSON.stringify(bad));
  }
});

test('every field is clamped to its own range, and junk becomes the safe default', () => {
  const d = parseSavedQuoteDraft({
    ...DRAFT,
    lines: [{ ...LINE, basis: 'weird', flatPhp: -5, minPax: 1e9 }],
    crew: { mode: 'free-lunch', size: -1 },
    discountPhp: -100,
    schedule: { manual: [{ kind: 'percent', percent: 900, due: 'whenever' }] },
    validDays: 9999,
  })!;
  assert.equal(d.lines[0]!.basis, 'flat');
  assert.equal(d.lines[0]!.flatPhp, 0);
  assert.equal(d.lines[0]!.minPax, 100_000);
  assert.equal(d.crew.mode, 'included');
  assert.equal(d.crew.size, 0);
  assert.equal(d.discountPhp, 0);
  assert.equal(d.schedule.manual[0]!.percent, 100);
  assert.equal(d.schedule.manual[0]!.due, 'on_lock');
  assert.equal(d.validDays, 365);
  const many = parseSavedQuoteDraft({ ...DRAFT, lines: Array.from({ length: 200 }, () => LINE) })!;
  assert.equal(many.lines.length, SAVED_QUOTE_MAX_LINES);
});

test('a saved quote carries no couple — only the fields it names', () => {
  const d = parseSavedQuoteDraft({ ...DRAFT, coupleName: 'Ana & Miguel', pax: 150, eventDate: '2026-12-12' })!;
  assert.deepEqual(Object.keys(d).sort(), ['crew', 'discountPhp', 'discountReason', 'lines', 'note', 'schedule', 'transport', 'v', 'validDays']);
});

test('"Good for N days" is counted in PH civil days, both ways', () => {
  assert.equal(validUntilFor('2026-10-14', 7), '2026-10-21');
  assert.equal(validUntilFor('2026-12-28', 7), '2027-01-04');
  assert.equal(validUntilFor('2026-10-14', null), '');
  assert.equal(validDaysOf('2026-10-14', '2026-10-28'), 14);
  assert.equal(validDaysOf('2026-10-14', '2026-10-14'), null);
  assert.equal(validDaysOf('2026-10-14', ''), null);
});
