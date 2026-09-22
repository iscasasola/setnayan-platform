/**
 * quote-event-brief.test.ts — step 1 of the quote tells the supplier what
 * Setnayan knows, in the rail's own rows plus the stage-1 facts, and names
 * what is withheld ONLY when a fee is actually enforced.
 *
 * ⚖ OWNER, 2026-09-22: *"the vendor must see the basic information we can
 * provide to them to help them build for the event."* Fields per the
 * 2026-09-20 ruling (stage 1 = type, date, AREA, guests, asked-for,
 * preferences, budget band; locked categories per 2026-09-08).
 *
 * 🛡 Sabotages watched red: the withheld line printed at 'unlocked' · the
 * rail's rows rewritten · the venue passed as the area.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { briefForQuote, type QuoteEventBriefInput } from './quote-event-brief';
import { WITHHELD_FIELD_LABEL } from './event-access-stage';

const RAIL_ROWS = [
  { label: 'Target date', value: 'Saturday, 13 March 2027', note: '2 other couples want this date', noteIsPrivate: true },
  { label: 'Pax', value: '~200 planning', note: '150 at inquiry' },
  { label: 'Location', value: 'Not set yet', unknown: true },
  { label: 'Locked suppliers', value: '1 of 3' },
];

function input(over: Partial<QuoteEventBriefInput> = {}): QuoteEventBriefInput {
  return {
    eventId: 'evt_1',
    eventTypeLabel: 'Wedding',
    targetDateLabel: 'Saturday, 13 March 2027',
    area: 'Calabarzon',
    facts: RAIL_ROWS,
    askedFor: 'Live band',
    budgetBand: { label: 'Premium', perHeadPhp: 11000 },
    styleLabels: ['Timeless', 'Catholic'],
    lockedCategories: ['Band / DJ'],
    stage: 'unlocked',
    ...over,
  };
}

test('the rail\'s rows come first, verbatim — including its honest "Not set yet" — then the stage-1 facts', () => {
  const b = briefForQuote(input());
  assert.deepEqual(
    b.rows.map((r) => [r.label, r.value]),
    [
      ['Target date', 'Saturday, 13 March 2027'],
      ['Pax', '~200 planning'],
      ['Location', 'Not set yet'],
      ['Locked suppliers', '1 of 3'],
      ['Area', 'Calabarzon'],
      ['Asked for', 'Live band'],
      ['Budget band', 'Premium · ~₱11,000 a head'],
      ['Style', 'Timeless · Catholic'],
      ['Already locked', 'Band / DJ'],
    ],
  );
  assert.equal(b.rows[2]!.unknown, true, 'an unknown stays marked unknown');
  assert.equal(b.rows[0]!.note, null, 'a PRIVATE note (date demand) never reaches the quote rows');
  assert.equal(b.rows[1]!.note, '150 at inquiry', 'a public note (the inquiry count) does');
  assert.equal(b.fullBriefHref, '/vendor-dashboard/clients/evt_1');
  // sabotage: `rows.unshift(...)` the stage-1 facts before the rail's → RED
});

test('the folded line is type · date · area, dropping what is unknown; nothing known ⇒ null', () => {
  assert.equal(briefForQuote(input()).eventLine, 'Wedding · Saturday, 13 March 2027 · Calabarzon');
  assert.equal(briefForQuote(input({ area: null })).eventLine, 'Wedding · Saturday, 13 March 2027');
  assert.equal(briefForQuote(input({ eventTypeLabel: null, targetDateLabel: null, area: '' })).eventLine, null);
});

test('a fact the event does not state is simply absent — no row, no dash', () => {
  const b = briefForQuote(input({ askedFor: null, budgetBand: null, styleLabels: [], lockedCategories: [], area: null }));
  assert.deepEqual(b.rows.map((r) => r.label), ['Target date', 'Pax', 'Location', 'Locked suppliers']);
  const noMedian = briefForQuote(input({ budgetBand: { label: 'No limit', perHeadPhp: 0 } }));
  assert.equal(noMedian.rows.find((r) => r.label === 'Budget band')?.value, 'No limit', 'a band with no median prints its label alone');
});

test('the withheld line is printed ONLY while quoting — and names every stage-3 field', () => {
  const quoting = briefForQuote(input({ stage: 'quoting' }));
  assert.ok(quoting.withheld, 'while quoting under an enforced fee, the screen says what it withholds');
  assert.match(quoting.withheld!.headline, /Quote first/);
  for (const label of Object.values(WITHHELD_FIELD_LABEL)) {
    assert.ok(quoting.withheld!.detail.toLowerCase().includes(label.toLowerCase()), `names ${label}`);
  }
  assert.equal(briefForQuote(input({ stage: 'unlocked' })).withheld, null, 'flag off ⇒ nothing is withheld ⇒ nothing is announced');
  assert.equal(briefForQuote(input({ stage: 'booked_fee_due' })).withheld, null, 'a booked-but-unpaid shop is not "quoting"');
  // sabotage: `input.stage !== 'unlocked'` → RED on booked_fee_due; `true` → RED on unlocked
});

test('locked categories are deduped and sorted so the row cannot reshuffle between loads', () => {
  const b = briefForQuote(input({ lockedCategories: ['Venue', 'Band / DJ', 'Venue'] }));
  assert.equal(b.rows.find((r) => r.label === 'Already locked')?.value, 'Band / DJ · Venue');
});
