/**
 * 🏷 DOOR 1 · "APPLY AN OFFER" ON THE QUOTE (owner 11 Nov 2026: *"YES. they can load a bundle also and edit from it."*).
 *
 * Fails if the quote's offer list stops being the Offer Maker's own answer: an Off / ended / taken offer is offered; a
 * low-first-payment or gift-only offer is DROPPED (approved design 12 Nov: they fit, with their parts); an offer that
 * does not reach the quote's cards is offered; the anchor stops being ONLY the lines of the cards the offer reaches
 * (owner 12 Nov — "on <card> only"); a season the event falls outside (or no event
 * date) or an early-bird rung the date does not earn is offered; the amount stops being `pickBestDiscount`'s (% first,
 * then ₱ off what is left; ₱ capped at the price); the offer already sitting in the card discount is offered twice; or
 * the applied offer stops being its own named negative line.
 *
 * The figures are fixtures, not prices.
 * SABOTAGE (seen red, restored): drop the `alreadyInDiscount` skip · anchor = every line (`linesSum`) instead of the
 * offer's own cards' lines.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blankOffer, offAmount, type Offer } from './offers';
import { appliedOfferNow, offerAnchorPhp, offerLineItem, offersForQuote, reachWords, type QuoteOfferFit, type QuoteOfferInput } from './quote-offer-door';

const NOW = new Date('2026-11-11T04:00:00Z');
const TODAY = '2026-11-11';
const offer = (over: Partial<Offer>): Offer => ({ ...blankOffer(over.id ?? 'o1'), name: 'Dry-season weekday', ...over });
/** One line on card-a worth `php` — the shape the maker hands the door. */
const on = (php: number, cardId: string | null = 'card-a') => [{ cardId, amountPhp: php }];
const input = (over: Partial<QuoteOfferInput>): QuoteOfferInput => ({
  offers: [],
  lines: on(45000),
  today: TODAY,
  eventDate: '2027-03-14',
  now: NOW,
  ...over,
});

test('a running % offer that reaches the card fits, priced by the offers’ own sums', () => {
  const o = offer({ id: 'o1', pctOff: 5 });
  const fits = offersForQuote(input({ offers: [o] }));
  assert.deepEqual(fits, [
    { id: 'o1', name: 'Dry-season weekday', words: '5% off', offPhp: 2250, reachesAll: true, reachIds: [], firstPayment: null, gifts: [] },
  ]);
  assert.equal(fits[0]!.offPhp, offAmount(o, 45000), 'the quote and the Offer Maker disagree about what it takes off');
});

test('% then ₱ off what is left — one offer, the Offer Maker’s order', () => {
  const o = offer({ id: 'o2', pctOff: 10, phpOff: 5000 });
  const [fit] = offersForQuote(input({ offers: [o], lines: on(110000) }));
  assert.equal(fit!.offPhp, 16000);
  assert.equal(fit!.offPhp, offAmount(o, 110000));
  assert.equal(fit!.words, '10% + ₱5,000 off');
});

test('Off, ended and all-taken offers are not offered', () => {
  const list = [
    offer({ id: 'off', pctOff: 5, isOn: false }),
    offer({ id: 'ended', pctOff: 5, untilDate: '2026-11-01' }),
    offer({ id: 'taken', pctOff: 5, who: 'first_n', firstNCap: 3, firstNTaken: 3 }),
    offer({ id: 'off-gift', isOn: false, gifts: [{ kind: 'typed', label: 'Album', worthPhp: 3000 }] }),
    offer({ id: 'ended-first', firstPayment: 5000, untilDate: '2026-11-01' }),
  ];
  assert.deepEqual(offersForQuote(input({ offers: list })), []);
});

test('a low-first-payment offer and a gift-only offer FIT, with their parts and nothing off the price (design 12 Nov)', () => {
  const gift = offer({ id: 'gift', gifts: [{ kind: 'typed', label: 'Album', worthPhp: 3000 }] });
  const first = offer({ id: 'first', firstPayment: 5000 });
  const fits = offersForQuote(input({ offers: [gift, first] }));
  assert.deepEqual(fits.map((f) => f.id).sort(), ['first', 'gift']);
  const g = fits.find((f) => f.id === 'gift')!;
  assert.equal(g.offPhp, 0);
  assert.deepEqual(g.gifts, [{ kind: 'typed', label: 'Album', worthPhp: 3000 }]);
  const f = fits.find((x) => x.id === 'first')!;
  assert.equal(f.offPhp, 0);
  assert.deepEqual(f.firstPayment, { unit: 'php', value: 5000, words: '₱5,000 to reserve' });
  assert.equal(offerLineItem(f), null, 'an offer that takes nothing off the price draws no negative line');
  // Its who-rule still holds: a season gift with the event outside the window does not fit.
  const seasonGift = offer({ id: 'sg', who: 'season', seasonFrom: '2027-06-01', seasonTo: '2027-08-31', gifts: [{ kind: 'typed', label: 'Album', worthPhp: 0 }] });
  assert.deepEqual(offersForQuote(input({ offers: [seasonGift], eventDate: '2027-03-14' })), []);
  assert.deepEqual(offersForQuote(input({ offers: [seasonGift], eventDate: '2027-07-10' })).map((x) => x.id), ['sg']);
});

test('🎯 an offer that reaches ONE card comes off THAT card’s lines only — "on <card> only" (owner 12 Nov)', () => {
  const lines = [
    { cardId: 'card-a', amountPhp: 60000 },
    { cardId: 'card-a', amountPhp: 4000 }, // card-a's ticked add-on
    { cardId: 'card-b', amountPhp: 40000 },
    { cardId: null, amountPhp: 6000 }, // a typed line
  ];
  const mine = offer({ id: 'mine', pctOff: 10, reachesAll: false, cards: ['card-a'] });
  assert.equal(offerAnchorPhp(mine, lines), 64000, 'the anchor is card-a’s lines and nothing else');
  const [fit] = offersForQuote(input({ offers: [mine], lines }));
  assert.equal(fit!.offPhp, 6400, '10% of card-a’s ₱64,000 — never of the ₱110,000 the whole quote comes to');
  assert.deepEqual(fit!.reachIds, ['card-a']);
  assert.equal(reachWords(fit!, (id) => (id === 'card-a' ? 'Garden buffet' : id)), 'on Garden buffet only');
  // An All-cards offer is the whole quote.
  const all = offer({ id: 'all', pctOff: 10 });
  assert.equal(offersForQuote(input({ offers: [all], lines }))[0]!.offPhp, 11000);
  assert.equal(reachWords(offersForQuote(input({ offers: [all], lines }))[0]!, String), null);
  // The line names the reach, and carries the offer, so a revision keeps it.
  assert.deepEqual(offerLineItem(fit!, 'on Garden buffet only'), {
    label: 'Dry-season weekday',
    detail: '10% off · on Garden buffet only · offer',
    amount_centavos: -640000,
    offer_id: 'mine',
  });
});

test('an offer for other cards does not fit; with no card picked only All-cards offers fit', () => {
  const other = offer({ id: 'other', pctOff: 5, reachesAll: false, cards: ['card-z'] });
  const mine = offer({ id: 'mine', pctOff: 5, reachesAll: false, cards: ['card-a'] });
  const all = offer({ id: 'all', phpOff: 1000 });
  assert.deepEqual(offersForQuote(input({ offers: [other, mine, all] })).map((f) => f.id), ['mine', 'all']);
  assert.deepEqual(offersForQuote(input({ offers: [other, mine, all], lines: on(45000, null) })).map((f) => f.id), ['all']);
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
  assert.equal(offersForQuote(input({ offers: [big], lines: on(8000) }))[0]!.offPhp, 8000);
  assert.deepEqual(offersForQuote(input({ offers: [big], lines: on(0) })), []);
  assert.deepEqual(offersForQuote(input({ offers: [big], lines: [] })), []);
});

test('the applied offer re-prices as the lines move, and is its own named negative line', () => {
  const o = offer({ id: 'o1', pctOff: 5 });
  assert.equal(appliedOfferNow('o1', input({ offers: [o], lines: on(60000) }))!.offPhp, 3000);
  assert.equal(appliedOfferNow('o1', input({ offers: [o], lines: on(0) })), null);
  const fit: QuoteOfferFit = { id: 'o1', name: 'Dry-season weekday', words: '5% off', offPhp: 2250, reachesAll: true, reachIds: [], firstPayment: null, gifts: [] };
  assert.deepEqual(offerLineItem(fit), {
    label: 'Dry-season weekday',
    detail: '5% off · offer',
    amount_centavos: -225000,
    offer_id: 'o1',
  });
});
