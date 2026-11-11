/**
 * 🏷 DOOR 1 · "APPLY AN OFFER" ON THE QUOTE (owner 11 Nov 2026: *"YES. they can load a bundle also and edit from it."*).
 *
 * Fails if the quote's offer list stops being the Offer Maker's own answer: an Off / ended / taken / gift-only offer is
 * offered; an offer that does not reach the quote's cards is offered; a season the event falls outside (or no event
 * date) or an early-bird rung the date does not earn is offered; the amount stops being `pickBestDiscount`'s (% first,
 * then ₱ off what is left; ₱ capped at the price); the offer already sitting in the card discount is offered twice; or
 * the applied offer stops being its own named negative line.
 *
 * The figures are fixtures, not prices.
 * SABOTAGE (seen red, restored): drop the `alreadyInDiscount` skip.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankOffer, offAmount, type Offer } from './offers';
import { appliedOfferNow, offerLineItem, offersForQuote, type QuoteOfferInput } from './quote-offer-door';

const NOW = new Date('2026-11-11T04:00:00Z');
const TODAY = '2026-11-11';
const offer = (over: Partial<Offer>): Offer => ({ ...blankOffer(over.id ?? 'o1'), name: 'Dry-season weekday', ...over });
const input = (over: Partial<QuoteOfferInput>): QuoteOfferInput => ({
  offers: [],
  cardIds: ['card-a'],
  anchorPhp: 45000,
  today: TODAY,
  eventDate: '2027-03-14',
  now: NOW,
  ...over,
});

test('a running % offer that reaches the card fits, priced by the offers’ own sums', () => {
  const o = offer({ id: 'o1', pctOff: 5 });
  const fits = offersForQuote(input({ offers: [o] }));
  assert.deepEqual(fits, [{ id: 'o1', name: 'Dry-season weekday', words: '5% off', offPhp: 2250 }]);
  assert.equal(fits[0]!.offPhp, offAmount(o, 45000), 'the quote and the Offer Maker disagree about what it takes off');
});

test('% then ₱ off what is left — one offer, the Offer Maker’s order', () => {
  const o = offer({ id: 'o2', pctOff: 10, phpOff: 5000 });
  const [fit] = offersForQuote(input({ offers: [o], anchorPhp: 110000 }));
  assert.equal(fit!.offPhp, 16000);
  assert.equal(fit!.offPhp, offAmount(o, 110000));
  assert.equal(fit!.words, '10% + ₱5,000 off');
});

test('Off, ended, all taken and gift-only offers are not offered', () => {
  const list = [
    offer({ id: 'off', pctOff: 5, isOn: false }),
    offer({ id: 'ended', pctOff: 5, untilDate: '2026-11-01' }),
    offer({ id: 'taken', pctOff: 5, who: 'first_n', firstNCap: 3, firstNTaken: 3 }),
    offer({ id: 'gift', gifts: [{ kind: 'typed', label: 'Album', worthPhp: 3000 }] }),
    offer({ id: 'first', firstPayment: 5000 }),
  ];
  assert.deepEqual(offersForQuote(input({ offers: list })), []);
});

test('an offer for other cards does not fit; with no card picked only All-cards offers fit', () => {
  const other = offer({ id: 'other', pctOff: 5, reachesAll: false, cards: ['card-z'] });
  const mine = offer({ id: 'mine', pctOff: 5, reachesAll: false, cards: ['card-a'] });
  const all = offer({ id: 'all', phpOff: 1000 });
  assert.deepEqual(offersForQuote(input({ offers: [other, mine, all] })).map((f) => f.id), ['mine', 'all']);
  assert.deepEqual(offersForQuote(input({ offers: [other, mine, all], cardIds: [] })).map((f) => f.id), ['all']);
});

test('a season the event is outside, or no event date, is not applied — nor an early-bird rung the date does not earn', () => {
  const season = offer({ id: 'season', pctOff: 5, who: 'season', seasonFrom: '2027-06-01', seasonTo: '2027-08-31' });
  const early = offer({ id: 'early', pctOff: 10, who: 'early_bird', minLeadMonths: 6 });
  assert.deepEqual(offersForQuote(input({ offers: [season, early], eventDate: '2027-03-14' })).map((f) => f.id), [], 'March is outside the season, and 4 months out is under 6');
  assert.deepEqual(offersForQuote(input({ offers: [season, early], eventDate: '2027-07-10' })).map((f) => f.id), ['early', 'season']);
  assert.deepEqual(offersForQuote(input({ offers: [season, early], eventDate: null })), [], 'advertised is not applied');
});

test('the offer already in the card discount is not offered twice', () => {
  const o = offer({ id: 'o1', pctOff: 5 });
  assert.deepEqual(offersForQuote(input({ offers: [o], alreadyInDiscount: 'o1' })), []);
});

test('a ₱ offer never takes more than the lines come to; no lines → nothing fits', () => {
  const big = offer({ id: 'big', phpOff: 99999 });
  assert.equal(offersForQuote(input({ offers: [big], anchorPhp: 8000 }))[0]!.offPhp, 8000);
  assert.deepEqual(offersForQuote(input({ offers: [big], anchorPhp: 0 })), []);
});

test('the applied offer re-prices as the lines move, and is its own named negative line', () => {
  const o = offer({ id: 'o1', pctOff: 5 });
  assert.equal(appliedOfferNow('o1', input({ offers: [o], anchorPhp: 60000 }))!.offPhp, 3000);
  assert.equal(appliedOfferNow('o1', input({ offers: [o], cardIds: ['card-a'], anchorPhp: 0 })), null);
  assert.deepEqual(offerLineItem({ id: 'o1', name: 'Dry-season weekday', words: '5% off', offPhp: 2250 }), {
    label: 'Dry-season weekday',
    detail: '5% off · offer',
    amount_centavos: -225000,
  });
});
