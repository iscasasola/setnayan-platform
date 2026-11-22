/**
 * 🏷 Shop offers on a card (Card Maker part 3):
 *   1 · on / off this card, and the "Also on N other cards" line;
 *   2 · put on: an all-cards offer is untouched; a picked-cards offer gains this card once;
 *   3 · take off: an all-cards offer becomes every OTHER card; the last card gives null (switch it off instead);
 *   4 · the row uses the shipped Offer Maker's one dispatcher, posts no field with the card, reads only when opened,
 *       and says a refused read — never "No offers yet".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { Offer } from './offers';
import { newOfferHref, offersOffCard, offersOnCard, otherCardsLine, withCard, withoutCard } from './card-shop-offers';

const WEB = join(import.meta.dirname, '..');

const offer = (over: Partial<Offer>): Offer => ({
  id: 'S89O-1',
  name: 'Rainy season',
  reachesAll: false,
  cards: [],
  pctOff: 10,
  phpOff: null,
  firstPayment: null,
  firstPaymentUnit: 'php',
  giftMode: 'same',
  gifts: [],
  who: 'everyone',
  minLeadMonths: null,
  firstNCap: null,
  firstNTaken: 0,
  seasonFrom: null,
  seasonTo: null,
  untilDate: null,
  isOn: true,
  sortOrder: 0,
  ...over,
});

test('1 · on / off this card, and how many other cards it sits on', () => {
  const all = offer({ id: 'a', reachesAll: true });
  const mine = offer({ id: 'b', cards: ['c1', 'c2'] });
  const other = offer({ id: 'c', cards: ['c2'] });
  assert.deepEqual(offersOnCard([all, mine, other], 'c1').map((o) => o.id), ['a', 'b']);
  assert.deepEqual(offersOffCard([all, mine, other], 'c1').map((o) => o.id), ['c']);
  assert.equal(otherCardsLine(all, 'c1'), 'On all your cards');
  assert.equal(otherCardsLine(mine, 'c1'), 'Also on 1 other card');
  assert.equal(otherCardsLine(offer({ cards: ['c1', 'c2', 'c3', 'c4'] }), 'c1'), 'Also on 3 other cards');
  assert.equal(otherCardsLine(offer({ cards: ['c1'] }), 'c1'), 'Only on this card');
});

test('2 · put on: all-cards untouched; a picked-cards offer gains this card once', () => {
  const all = offer({ reachesAll: true });
  assert.equal(withCard(all, 'c1'), all);
  assert.deepEqual(withCard(offer({ cards: ['c2'] }), 'c1').cards, ['c2', 'c1']);
  assert.deepEqual(withCard(offer({ cards: ['c1'] }), 'c1').cards, ['c1']);
});

test('3 · take off: all-cards → every other card; the last card → null', () => {
  const off = withoutCard(offer({ reachesAll: true }), 'c1', ['c1', 'c2', 'c3']);
  assert.ok(off);
  assert.equal(off.reachesAll, false);
  assert.deepEqual(off.cards, ['c2', 'c3']);
  assert.deepEqual(withoutCard(offer({ cards: ['c1', 'c2'] }), 'c1', ['c1', 'c2'])?.cards, ['c2']);
  assert.equal(withoutCard(offer({ cards: ['c1'] }), 'c1', ['c1', 'c2']), null, 'never an offer on no card');
  assert.equal(withoutCard(offer({ reachesAll: true }), 'c1', ['c1']), null);
  assert.equal(newOfferHref('S89S-AB'), '/vendor-dashboard/shop?maker=offers&new=card&card=S89S-AB');
});

test('4 · the row: one shipped dispatcher, no posted field, lazy read, honest states', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/services/_components/card-shop-offers.tsx'), 'utf8'));
  assert.match(src, /from '@\/app\/vendor-dashboard\/offers\/actions'/);
  assert.ok(!/'use server'/.test(src), 'no new server action');
  assert.ok(!/<(input|select|textarea)\b/.test(src), 'posts nothing with the card');
  assert.match(src, /hasAttribute\('inert'\)/, 'reads only once the fold opens');
  assert.match(src, /k: 'unread'/);
  assert.ok(!/No offers yet/.test(src), 'a refused read is never "none"');
  assert.match(src, /lock="offerMaker"/, 'locked shows the shared lock (Problem → Solution)');
  assert.match(src, /pushUndo\(/, 'every change has Undo');
  const maker = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/services/_components/canvas-maker.tsx'), 'utf8'));
  assert.match(maker, /isEdit && editing \? \(\s*<div data-maker-group-row="m-shop-offers">/, 'only on a card that exists');
});
