/**
 * supplier-cuts-make-a-quote.test.ts — 🧾 CUT 7, "MAKE A QUOTE" IN THE CHAT (owner-approved 2026-11-14 — DECISION_LOG
 * "THE SEVEN SUPPLIER CUTS ARE APPROVED"; prototype `prototypes/supplier_eleven_jobs_cuts_2026-11-14_fable.html` § 7).
 *
 *   (1) Good until is FILLED — 14 days, or the event day if sooner — and said as a date and a count, never hidden;
 *   (2) the offer starts at the picked cards' own prices and the one line IS the offer (the server re-sums lines);
 *   (3) the card sends through the SHIPPED writer, so it lands as the chat's own quote card; no new server action;
 *   (4) Full quotation opens today's builder, and the help answer exists.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { MAKE_A_QUOTE_GOOD_FOR_DAYS, goodUntilWords, makeQuoteGoodUntil, makeQuoteLines, makeQuoteOfferStart, makeQuoteRefusal } from './make-a-quote';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('(1) Good until opens filled: 14 days, or the event day when sooner; none when no day is left', () => {
  assert.equal(MAKE_A_QUOTE_GOOD_FOR_DAYS, 14);
  assert.equal(makeQuoteGoodUntil('2026-11-14', null), '2026-11-28');
  assert.equal(makeQuoteGoodUntil('2026-11-14', '2026-12-12'), '2026-11-28');
  assert.equal(makeQuoteGoodUntil('2026-11-14', '2026-11-20'), '2026-11-20', 'a default past the event day');
  assert.equal(makeQuoteGoodUntil('2026-11-14', '2026-11-14'), null, 'a default the send would refuse');
  assert.equal(goodUntilWords('2026-11-28', '2026-11-14'), 'Nov 28 · 14 days');
  assert.equal(goodUntilWords('2026-11-15', '2026-11-14'), 'Nov 15 · 1 day');
  const card = read('app/_components/chat/cards/make-quote-card.tsx');
  assert.match(card, /useState<string \| null>\(\(\) => makeQuoteGoodUntil\(today, eventDate\)\)/, 'Good until no longer opens filled');
  assert.match(card, /name="Good until"/);
});

test('(2) the offer starts at the cards’ own prices, and the one line is the offer', () => {
  const a = { id: 'a', name: 'Garden centrepieces', fromCentavos: 1_500_000 };
  const b = { id: 'b', name: 'Bridal bouquet', fromCentavos: null };
  assert.equal(makeQuoteOfferStart([a, b]), 1_500_000);
  assert.deepEqual(makeQuoteLines([a], 1_200_000), [{ label: 'Garden centrepieces', detail: null, amount_centavos: 1_200_000, card_id: 'a' }]);
  const two = makeQuoteLines([a, b], 2_000_000);
  assert.equal(two.length, 1);
  assert.equal(two[0]!.label, 'Garden centrepieces · Bridal bouquet');
  assert.equal(two[0]!.amount_centavos, 2_000_000);
  assert.equal(makeQuoteRefusal({ picked: 0, offerCentavos: 1, validUntil: '2026-11-28', todayIso: '2026-11-14', eventDate: null }), 'Pick at least one of your cards.');
  assert.equal(makeQuoteRefusal({ picked: 1, offerCentavos: 0, validUntil: '2026-11-28', todayIso: '2026-11-14', eventDate: null }), 'Type your offer.');
  assert.equal(makeQuoteRefusal({ picked: 1, offerCentavos: 100, validUntil: '2026-11-28', todayIso: '2026-11-14', eventDate: null }), null);
  assert.ok(makeQuoteRefusal({ picked: 1, offerCentavos: 100, validUntil: null, todayIso: '2026-11-14', eventDate: null }), 'a quote sent with no Good until');
});

test('(3) it sends through the shipped writer — no new server action', () => {
  const card = read('app/_components/chat/cards/make-quote-card.tsx');
  assert.match(card, /await sendCustomProposalFromChat\(fd\)/);
  assert.doesNotMatch(card, /['"]use server['"]/);
  assert.match(card, /lineItems: makeQuoteLines\(chosen, offerC\)/);
  assert.match(card, /serviceCardIds: chosen\.map\(\(c\) => c\.id\)/);
  const calls = read('app/_components/chat/cards/card-calls.ts');
  assert.doesNotMatch(calls, /['"]use server['"]/, 'the card read became a server action');
  assert.match(calls, /export async function loadCardsForMakeQuote/);
});

test('(4) Full quotation opens today’s builder; the help answer exists', () => {
  const card = read('app/_components/chat/cards/make-quote-card.tsx');
  assert.match(card, /plusDoor\('vendor', 'build-quote', ''\)/);
  assert.match(card, /label="Full quotation"/);
  assert.match(read('lib/help/supplier-cuts.ts'), /slug: 'make-a-quote-in-chat'/);
});
