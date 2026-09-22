/**
 * quote-stages.test.ts — the five steps of writing a quote, executed.
 *
 * ⚖ OWNER, 2026-09-22: *"create evident separation for different brain
 * processes … build a clean continuity."* The rule lives in
 * `lib/quote-stages.ts`; this file runs it for every step, both openings, and
 * the five summaries — and `app/_components/the-quote-walks-five-steps.test.ts`
 * pins that the builder draws exactly these steps in this order.
 *
 * 🛡 Sabotages watched red: reorder two stages · `openingStage` ignoring the
 * revision · a summary printing a figure the draft does not hold.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QUOTE_STAGES,
  QUOTE_STAGE_COUNT,
  nextStage,
  openingStage,
  stageStates,
  stageSummaries,
  type QuoteStageFacts,
} from './quote-stages';

test('five steps, in the owner\'s order, each with a number matching its place and a lead on all but the last', () => {
  assert.equal(QUOTE_STAGE_COUNT, 5);
  assert.deepEqual(
    QUOTE_STAGES.map((s) => [s.n, s.id, s.title]),
    [
      [1, 'know', 'Know the event'],
      [2, 'offer', 'Choose what to offer'],
      [3, 'price', 'Set the price'],
      [4, 'terms', 'Terms'],
      [5, 'send', 'Review & send'],
    ],
  );
  QUOTE_STAGES.forEach((s, i) => assert.equal(s.n, i + 1, `${s.id} is numbered for its place`));
  assert.ok(QUOTE_STAGES.slice(0, 4).every((s) => s.lead && s.lead.length > 0));
  assert.equal(QUOTE_STAGES[4]!.lead, null);
  // sabotage: swap 'offer' and 'price' → RED (order AND numbering)
});

test('every step ends in the next; the last ends nowhere', () => {
  assert.equal(nextStage('know'), 'offer');
  assert.equal(nextStage('offer'), 'price');
  assert.equal(nextStage('price'), 'terms');
  assert.equal(nextStage('terms'), 'send');
  assert.equal(nextStage('send'), null);
});

test('a fresh quote opens at Know the event; an update opens at Set the price', () => {
  assert.equal(openingStage({ revision: false }), 'know');
  assert.equal(openingStage({ revision: true }), 'price');
  // sabotage: return 'know' regardless → RED
});

test('done / cur / later — for every current step, everything before is done, everything after is later', () => {
  for (const s of QUOTE_STAGES) {
    const states = stageStates(s.id);
    QUOTE_STAGES.forEach((t) => {
      const expected = t.n < s.n ? 'done' : t.n === s.n ? 'cur' : 'later';
      assert.equal(states[t.id], expected, `${t.id} while on ${s.id}`);
    });
  }
});

const FACTS: QuoteStageFacts = {
  eventLine: 'Wedding · 13 March 2027 · Calabarzon',
  pax: 200,
  hours: 8,
  cardsLine: 'Live band + Host / MC',
  netPayableCentavos: 7_575_000,
  feeText: '₱3,788',
  papicText: 'off',
  paymentsCount: 2,
  railLabels: ['BDO', 'GCash'],
  validUntil: '2026-10-06',
};

test('the five summaries are written from the live draft — money through the shared formatter', () => {
  const s = stageSummaries(FACTS);
  assert.equal(s.know, 'Wedding · 13 March 2027 · Calabarzon');
  assert.equal(s.offer, 'Live band + Host / MC · 200 guests · 8 h');
  assert.equal(s.price, '₱75,750 · fee ₱3,788 · Papic off');
  assert.equal(s.terms, '2 payments · BDO · GCash · until 2026-10-06');
  assert.equal(s.send, 'Send · ₱75,750');
  // sabotage: `price` printing the subtotal instead of netPayable → RED
});

test('nothing is invented when a fact is missing — no card, no fee, no Papic, no rails, no date', () => {
  const s = stageSummaries({
    ...FACTS,
    eventLine: null,
    cardsLine: null,
    feeText: null,
    papicText: null,
    railLabels: [],
    validUntil: '',
    paymentsCount: 1,
  });
  assert.equal(s.know, 'Their event');
  assert.equal(s.offer, 'No card loaded · 200 guests · 8 h');
  assert.equal(s.price, '₱75,750', 'no fee and no Papic text ⇒ neither word appears');
  assert.equal(s.terms, '1 payment · every approved method');
  assert.doesNotMatch(s.price, /fee|Papic/);
  // sabotage: `fee ${f.feeText ?? '—'}` → RED ("—" is a figure nobody measured)
});
