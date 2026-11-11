/**
 * ＋ DOOR 2 · "MAKE A NEW CARD" FROM THE QUOTE, AND BACK (owner 11 Nov 2026; prototype frame 6: "opens the Card Maker ·
 * returns here with it picked").
 *
 * Fails if the return address can leave the two quote pages (an open redirect from the card save), passes an old
 * `quote_card` or an unsafe query through, stops landing a picked client on its Quotation page, or the Card Maker's
 * address stops carrying the way back.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardMakerFromQuote, quoteReturnPath, quoteReturnWithCard } from './quote-card-return';

const EV = '0b8f2c1e-1111-4a2b-9c3d-123456789abc';
const CARD = '7d1e9a40-2222-4b3c-8d4e-abcdefabcdef';

test('only the two pages that draw the quote are accepted', () => {
  assert.equal(quoteReturnPath(`/vendor-dashboard/messages/${EV}`), `/vendor-dashboard/messages/${EV}`);
  assert.equal(quoteReturnPath(`/vendor-dashboard/clients/${EV}?tab=chat`), `/vendor-dashboard/clients/${EV}?tab=quote`);
  for (const bad of [
    'https://evil.example/vendor-dashboard/messages/x',
    '//evil.example/vendor-dashboard/messages/x',
    '/\\evil.example',
    '/vendor-dashboard/shop',
    '/vendor-dashboard/messages/x/../../admin',
    '/admin',
    'vendor-dashboard/messages/x',
    '',
    null,
  ]) {
    assert.equal(quoteReturnPath(bad), null, `accepted ${String(bad)}`);
  }
});

test('the query is rebuilt: no old quote_card, nothing unsafe', () => {
  assert.equal(
    quoteReturnPath(`/vendor-dashboard/messages/${EV}?compose=quote&quote_card=old&x=%3Cscript%3E`),
    `/vendor-dashboard/messages/${EV}?compose=quote`,
  );
});

test('the save returns to the quote carrying the new card', () => {
  assert.equal(quoteReturnWithCard(`/vendor-dashboard/clients/${EV}`, CARD), `/vendor-dashboard/clients/${EV}?tab=quote&quote_card=${CARD}`);
  assert.equal(quoteReturnWithCard(`/vendor-dashboard/messages/${EV}`, CARD), `/vendor-dashboard/messages/${EV}?quote_card=${CARD}`);
  assert.equal(quoteReturnWithCard('/vendor-dashboard/shop', CARD), null);
  assert.equal(quoteReturnWithCard(`/vendor-dashboard/messages/${EV}`, 'x"><b'), null);
});

test('the Card Maker opens with the way back', () => {
  assert.equal(
    cardMakerFromQuote(`/vendor-dashboard/clients/${EV}?tab=quote`),
    `/vendor-dashboard/services/new?quote=${encodeURIComponent(`/vendor-dashboard/clients/${EV}?tab=quote`)}`,
  );
  assert.equal(cardMakerFromQuote('/dev/supplier-chat-lab'), '/vendor-dashboard/services/new');
});
