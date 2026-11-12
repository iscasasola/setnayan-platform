/**
 * 🧾 The words and the one total rule of a self-added supplier's price basis (lib/self-added-price-basis.ts) — the
 * approved prototype's states 2–7 (`prototypes/manual_service_price_basis_2026-11-13/index.html`), and the honesty
 * rule: no times / nobody counted / an unread count → no total, never ₱0.
 *
 * Run (from apps/web): tsx --test lib/self-added-price-basis.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  basisCalc,
  basisFromColumn,
  basisTotal,
  parsePriceTerms,
  parseRatePhp,
  parseSelfAddedBasis,
  priceRowName,
  selfAddedCardLine,
  NO_TIMES_WORDS,
  SET_HOURS_LINK_WORDS,
  CHANGE_HOURS_LINK_WORDS,
  GUEST_LIST_LINK_WORDS,
  GUESTS_UNREAD_WORDS,
} from './self-added-price-basis';

const T120 = { counted: 120, hours: null, arriveAt: null, doneAt: null };
const T5H = { counted: 0, hours: 5, arriveAt: '2027-03-14T07:00:00Z', doneAt: '2027-03-14T12:00:00Z' };

test('the Price row is named by the choice (states 2 · 4 · 5)', () => {
  assert.equal(priceRowName('fixed'), 'Price');
  assert.equal(priceRowName('per_pax'), 'Price per guest');
  assert.equal(priceRowName('per_hour'), 'Price per hour');
});

test('state 4 · per guest: ₱1,350 × 120 guests it counts = ₱162,000', () => {
  assert.deepEqual(basisTotal('per_pax', 1350, T120), { kind: 'total', totalPhp: 162000, n: 120 });
  const c = basisCalc('per_pax', 1350, T120);
  assert.deepEqual(c.calc, { count: '120 guests', tail: 'it counts', total: '₱162,000' });
  assert.equal(c.link, GUEST_LIST_LINK_WORDS);
});

test('state 5 · per hour: ₱6,000 × 5 hours on the schedule = ₱30,000, Arrive 3:00 PM · Done 8:00 PM', () => {
  assert.deepEqual(basisTotal('per_hour', 6000, T5H), { kind: 'total', totalPhp: 30000, n: 5 });
  const c = basisCalc('per_hour', 6000, T5H);
  assert.deepEqual(c.calc, { count: '5 hours', tail: 'on the schedule', total: '₱30,000' });
  assert.equal(c.from, 'Arrive 3:00 PM · Done 8:00 PM');
  assert.equal(c.link, CHANGE_HOURS_LINK_WORDS);
});

test('state 6 · per hour, no times: no total, one link to set their hours', () => {
  const none = { counted: 120, hours: null, arriveAt: null, doneAt: null };
  assert.deepEqual(basisTotal('per_hour', 6000, none), { kind: 'none', why: 'no_times' });
  const c = basisCalc('per_hour', 6000, none);
  assert.equal(c.calc, null, 'no sum is drawn');
  assert.equal(c.wait, NO_TIMES_WORDS);
  assert.equal(c.link, SET_HOURS_LINK_WORDS);
});

test('never a ₱0: nobody counted, or an unread count, is no total', () => {
  assert.deepEqual(basisTotal('per_pax', 1350, { counted: 0, hours: null, arriveAt: null, doneAt: null }), { kind: 'none', why: 'none_counted' });
  assert.deepEqual(basisTotal('per_pax', 1350, 'unread'), { kind: 'none', why: 'unread' });
  assert.equal(basisCalc('per_pax', 1350, 'unread').wait, GUESTS_UNREAD_WORDS);
  assert.equal(selfAddedCardLine({ basis: 'per_pax', ratePhp: 1350, terms: 'unread' })!.showsTotal, false);
  assert.equal(selfAddedCardLine({ basis: 'per_hour', ratePhp: 6000, terms: { ...T5H, hours: null } })!.showsTotal, false);
});

test('to the centavo, the same rule as SQL round(rate × n, 2)', () => {
  assert.equal((basisTotal('per_hour', 1234.56, { ...T5H, hours: 6.5 }) as { totalPhp: number }).totalPhp, 8024.64);
});

test('state 7 · the saved card: "₱1,350 per guest · 120 counted · ₱162,000"', () => {
  const line = selfAddedCardLine({ basis: 'per_pax', ratePhp: 1350, terms: T120 })!;
  assert.equal(line.lead, '₱1,350 per guest · 120 counted');
  assert.equal(line.showsTotal, true);
  // The card then draws its own total after it (shortlist-categories.tsx: `{lead} · ` + formatPhp(v.totalCostPhp)).
  assert.equal(`${line.lead} · ₱162,000`, '₱1,350 per guest · 120 counted · ₱162,000');
  assert.equal(selfAddedCardLine({ basis: 'fixed', ratePhp: null, terms: T120 }), null, 'One price: the card as shipped');
  assert.equal(
    selfAddedCardLine({ basis: 'per_hour', ratePhp: 6000, terms: { ...T5H, hours: null } })!.lead,
    '₱6,000 per hour · no times on the schedule yet',
  );
});

test('parsing — the form, the column, the read', () => {
  assert.equal(parseSelfAddedBasis('per_pax'), 'per_pax');
  assert.equal(parseSelfAddedBasis(null), null, 'not posted → leave the facts alone');
  assert.equal(parseSelfAddedBasis('per_day'), null);
  assert.equal(basisFromColumn(null), 'fixed');
  assert.equal(parseRatePhp('1,350'), 1350);
  assert.equal(parseRatePhp('0'), null);
  assert.equal(parseRatePhp(''), null);
  assert.deepEqual(parsePriceTerms({ counted: 120, hours: null, arrive_at: null, done_at: null }), T120);
  assert.equal(parsePriceTerms(null), null);
  assert.equal(parsePriceTerms({ counted: 'x' }), null, 'a bad shape is unread, never 0');
});

test('the saved card draws the line, then its OWN total — and no total when the count is not known', () => {
  const card = fs.readFileSync(path.join(__dirname, '../app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'), 'utf8');
  assert.match(card, /basisLine && !\(basisLine\.showsTotal && hasRecordedPrice\) \?/);
  assert.match(card, /<span className="sc-price" data-price-basis-line="">\{basisLine\.lead\} · <\/span>/);
});

test('the sheet uses the Card Maker’s words and the house PickMenu — a tap opens, never cycles', () => {
  const rows = fs.readFileSync(path.join(__dirname, '../app/dashboard/[eventId]/_components/price-basis-rows.tsx'), 'utf8');
  assert.match(rows, /PRICING_BASIS_OPTIONS/);
  assert.match(rows, /'One price'/);
  assert.match(rows, /<PickMenu/);
  assert.match(rows, /label="How the price works"/);
});
