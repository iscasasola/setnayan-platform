/**
 * find-service-cards — Find v4 (owner 2026-10-29): one list per category, every service's cards, never a card that is
 * not free on the event's date, a shop kept together, the ✎ listing only services with cards, a typed service landing
 * on it, ⇅ Price/Rating, and Best for your event (performers only). Executed, not read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FIND_FILTERS_OFF,
  bestForYourEvent,
  cardsWord,
  clusterCards,
  freeOnWords,
  keepFreeCards,
  legacyServiceFor,
  matchServiceQuery,
  pageOfClusters,
  passesFindFilters,
  pencilWords,
  priceBands,
  refusedOn,
  servicesScopeWords,
  servicesWithCards,
  type FindCardRow,
  type FindService,
} from './find-service-cards';

const c = (profileId: string, service: string, serviceId: string | null, fromPhp: number | null = null): FindCardRow => ({
  serviceId,
  profileId,
  service,
  card: null,
  fromPhp,
});
const S: FindService[] = [
  { key: 'catering', label: 'Catering' },
  { key: 'lechonero', label: 'Lechonero' },
  { key: 'halal_catering', label: 'Halal Catering' },
  { key: 'massage', label: 'Massage' },
];

test('🔑 a card not free on the date is never kept — one date: free that day; several: free on at least one', () => {
  const cards = [c('a', 'catering', 's1'), c('b', 'catering', 's2'), c('c', 'lechonero', 's3')];
  const one = keepFreeCards(cards, new Set([refusedOn('s1', '2026-12-18')]), ['2026-12-18']);
  assert.deepEqual(one.cards.map((x) => x.serviceId), ['s2', 's3']);
  assert.equal(one.availability, 'checked');
  // s2 is refused on one of two dates — free on the other, so it stays; s3 refused on both leaves.
  const two = keepFreeCards(
    cards,
    new Set([refusedOn('s2', '2026-12-18'), refusedOn('s3', '2026-12-18'), refusedOn('s3', '2026-12-19')]),
    ['2026-12-18', '2026-12-19'],
  );
  assert.deepEqual(two.cards.map((x) => x.serviceId), ['s1', 's2']);
});

test('🔑 an unreadable calendar is SAID (unread) and hides nobody; no date is said too', () => {
  const cards = [c('a', 'catering', 's1')];
  assert.deepEqual(keepFreeCards(cards, null, ['2026-12-18']), { cards, availability: 'unread' });
  assert.deepEqual(keepFreeCards(cards, new Set(), []), { cards, availability: 'no_date' });
  assert.equal(freeOnWords('unread', ['2026-12-18']), "couldn't check dates");
  assert.equal(freeOnWords('checked', ['2026-12-18']), 'free on Dec 18');
  assert.equal(freeOnWords('checked', ['2026-12-18', '2026-12-19']), 'free on one of your dates');
});

test('a legacy shop (no card row) is never refused and is filed under its known service', () => {
  assert.equal(keepFreeCards([c('a', 'catering', null)], new Set(), ['2026-12-18']).cards.length, 1);
  assert.equal(legacyServiceFor(['photo', 'lechonero'], ['catering', 'lechonero']), 'lechonero');
  assert.equal(legacyServiceFor(['photo'], ['catering', 'lechonero']), 'catering');
});

test('🔑 the ✎ lists only services WITH cards; an unreadable count lists nothing (not "all empty")', () => {
  const cards = [c('a', 'catering', '1'), c('b', 'catering', '2'), c('a', 'lechonero', '3')];
  assert.deepEqual(
    servicesWithCards(S, cards).map((x) => [x.service.key, x.count]),
    [
      ['catering', 2],
      ['lechonero', 1],
    ],
  );
  assert.deepEqual(servicesWithCards(S, null), []);
});

test('🔑 a shop stays together, in the shops\' order, and a page never splits a shop', () => {
  const rows = [{ vendorProfileId: 'b' }, { vendorProfileId: 'a' }, { vendorProfileId: 'z' }];
  const cards = [c('a', 'lechonero', '1', 500), c('a', 'catering', '2', 900), c('b', 'catering', '3'), c('a', 'catering', '4', 400)];
  const clusters = clusterCards(rows, cards, S.map((s) => s.key));
  assert.deepEqual(
    clusters.map((x) => [x.row.vendorProfileId, x.cards.map((k) => k.serviceId)]),
    [
      ['b', ['3']],
      ['a', ['4', '2', '1']], // service order, then cheapest first
    ],
    'z has no card and is not drawn',
  );
  const page = pageOfClusters(clusters, 2);
  assert.equal(page.shown.length, 2, 'the 2nd card falls in shop a — the page runs to its end');
  assert.equal(page.shownCards, 4);
  assert.equal(pageOfClusters(clusters, 1).shown.length, 1);
  // hidden services leave; a shop with every card hidden leaves.
  const onlyLechon = clusterCards(rows, cards, S.map((s) => s.key), (k) => k.service === 'lechonero');
  assert.deepEqual(onlyLechon.map((x) => x.row.vendorProfileId), ['a']);
});

test('a typed service name (≥ 3 letters) lands on it; anything else is a search', () => {
  assert.equal(matchServiceQuery('lech', S)?.key, 'lechonero');
  assert.equal(matchServiceQuery('halal', S)?.key, 'halal_catering');
  assert.equal(matchServiceQuery('le', S), null);
  assert.equal(matchServiceQuery('Kusina ni Ate', S), null);
});

test('⇅ Price bands are the category\'s own thirds; Rating; an unpriced card is in no band', () => {
  const cards = [100, 200, 300, 400, 500, 600].map((p, i) => c(`s${i}`, 'catering', `${i}`, p));
  const bands = priceBands(cards);
  assert.deepEqual(bands, { low: 300, high: 500 });
  const shop = { rating: 4.6, reviewCount: 10 };
  assert.equal(passesFindFilters(cards[0] as FindCardRow, shop, { ...FIND_FILTERS_OFF, price: 'low' }, bands), true);
  assert.equal(passesFindFilters(cards[5] as FindCardRow, shop, { ...FIND_FILTERS_OFF, price: 'low' }, bands), false);
  assert.equal(passesFindFilters(c('x', 'catering', 'x'), shop, { ...FIND_FILTERS_OFF, price: 'mid' }, bands), false);
  assert.equal(passesFindFilters(cards[0] as FindCardRow, shop, { price: 'any', rating: '4.5' }, bands), true);
  assert.equal(passesFindFilters(cards[0] as FindCardRow, { rating: 4.2, reviewCount: 3 }, { price: 'any', rating: '4.5' }, bands), false);
  assert.equal(priceBands(cards.slice(0, 2)), null, 'too few priced cards to cut honest bands');
});

test('the words: "cards", the services scope, and the ✎ count', () => {
  assert.equal(cardsWord(1), '1 card');
  assert.equal(cardsWord(19), '19 cards');
  const listed = S.slice(0, 3);
  assert.equal(servicesScopeWords(listed, []), 'All 3 services');
  assert.equal(servicesScopeWords(listed, ['catering']), '2 of 3 services');
  assert.equal(servicesScopeWords(listed, ['catering', 'halal_catering']), 'Lechonero');
  assert.equal(pencilWords(listed, []), null);
  assert.equal(pencilWords(listed, ['catering']), '2 of 3');
});

test('🔑 Best for your event: performers only, one card per shop, at most ten — none → nothing', () => {
  const rows = Array.from({ length: 14 }, (_, i) => ({ vendorProfileId: `p${i}`, compatScore: i, rating: 4, distanceKm: 1 }));
  const cards = rows.flatMap((r) => [c(r.vendorProfileId, 'catering', `${r.vendorProfileId}-1`), c(r.vendorProfileId, 'lechonero', `${r.vendorProfileId}-2`)]);
  const all = new Set(rows.map((r) => r.vendorProfileId));
  const best = bestForYourEvent(rows, cards, all, () => true);
  assert.equal(best.length, 10);
  assert.equal(best[0]?.row.vendorProfileId, 'p13', 'highest match first');
  assert.equal(new Set(best.map((b) => b.row.vendorProfileId)).size, 10, 'one card per shop');
  assert.deepEqual(bestForYourEvent(rows, cards, new Set(), () => true), [], 'no performer → no strip');
  assert.deepEqual(
    bestForYourEvent(rows, cards, new Set(['p1']), (k) => k.service === 'lechonero').map((b) => b.card.serviceId),
    ['p1-2'],
    'a hidden service is hidden here too',
  );
});
