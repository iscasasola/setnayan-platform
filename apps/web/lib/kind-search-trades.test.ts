/**
 * GUARD — the card maker's search finds a live trade, ranked, and never
 * repeats one the shop already has on screen.
 *
 * Written for C1 (2026-08-28): the kind sheet only ever matched the ~46
 * legacy department pills. Measured: 51 live trades — generator hire, tent
 * rental, sorbetes carts, bridesmaid dresses among them — had no word of
 * their own in that list. This is the acceptance test for that gap closing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { rankTradeMatches, type TradeMatch } from './kind-search-trades';
import { MIN_QUERY_LEN } from './taxonomy-search-rank';

const TRADES: TradeMatch[] = [
  { key: 'generator_rental', label: 'Generator Rental', branch: 'Outdoor', standing: 'open' },
  { key: 'tent_rental', label: 'Tent / Outdoor-Cover Rental', branch: 'Outdoor', standing: 'open' },
  { key: 'sorbetes_cart', label: 'Sorbetes Cart', branch: 'Food Cart', standing: 'open' },
  { key: 'ice_cream_cart', label: 'Ice Cream Cart', branch: 'Food Cart', standing: 'open' },
  { key: 'photo_booth', label: 'Photo Booth', branch: 'Photo Booth', standing: 'open' },
  { key: 'pabati', label: 'Pabati', branch: 'Photo Booth', standing: 'covered' },
  {
    key: 'funeral_home',
    label: 'Funeral Home',
    branch: 'Funeral Home',
    standing: 'locked',
    why: 'Your plan covers one kind of business. Upgrade to list under another.',
  },
];

test('ANCHOR — the fixture is real, not accidentally empty', () => {
  assert.ok(TRADES.length >= 5, 'the fixture shrank — every assertion below would be vacuous');
});

test('a query shorter than the minimum finds nothing — delegated to the shared ranker', () => {
  assert.deepEqual(rankTradeMatches(TRADES, 'g', new Set()), []);
  assert.ok(MIN_QUERY_LEN === 2, 'the shared minimum moved; this file assumed 2');
});

test('a trade with no word in the legacy list is now findable by its own name', () => {
  // The exact measured gap: "generator" had no word that meant it anywhere
  // in the maker before this. It must be found on its own trade name.
  const rows = rankTradeMatches(TRADES, 'generator', new Set());
  assert.ok(rows.some((r) => r.key === 'generator_rental'), `"generator" missed it: ${JSON.stringify(rows)}`);
});

test('"photobooth" written as one word still reaches the trade — the ranker, not a rebuilt one', () => {
  const rows = rankTradeMatches(TRADES, 'photobooth', new Set());
  assert.ok(
    rows.some((r) => r.key === 'photo_booth'),
    'the squashed-spelling tier stopped working through this wrapper — a second matcher would not carry it',
  );
});

test('a trade already shown in the coverage band is excluded, even though it matches', () => {
  // "pabati" already renders as a pressable pill in "What you already do";
  // the search band must not show it a second time.
  const withoutExclusion = rankTradeMatches(TRADES, 'pabati', new Set());
  assert.ok(withoutExclusion.some((r) => r.key === 'pabati'), 'fixture sanity: pabati matches its own name');

  const excluded = rankTradeMatches(TRADES, 'pabati', new Set(['pabati']));
  assert.ok(
    !excluded.some((r) => r.key === 'pabati'),
    'a trade already on screen in the coverage band was shown a second time in the search results',
  );
});

test('excluding one key never hides a different eligible trade that also matches', () => {
  // Both "Food Cart" trades match "cart"; excluding one must not exclude
  // the other, and must not shrink below the true eligible count.
  const rows = rankTradeMatches(TRADES, 'cart', new Set(['ice_cream_cart']));
  assert.ok(rows.some((r) => r.key === 'sorbetes_cart'), 'the untouched match disappeared alongside the excluded one');
  assert.ok(!rows.some((r) => r.key === 'ice_cream_cart'), 'the excluded trade still rendered');
});

test('a locked trade is returned WITH its standing and reason — never bare', () => {
  // The obvious-and-wrong version returns {key,label} only, which is what
  // rankTaxonomyOptions gives back. This wrapper must hand the STANDING back
  // on the same object — never make the caller re-derive it, and never
  // silently drop it.
  const rows = rankTradeMatches(TRADES, 'funeral', new Set());
  const hit = rows.find((r) => r.key === 'funeral_home');
  assert.ok(hit, '"funeral" stopped finding the funeral home trade');
  assert.equal(hit!.standing, 'locked');
  assert.equal(typeof hit!.why, 'string');
  assert.ok(hit!.why!.length > 0, 'a locked trade lost its reason on the way through the wrapper');
});

test('the branch rides along, so two similar trades can be told apart', () => {
  const rows = rankTradeMatches(TRADES, 'cart', new Set());
  for (const r of rows) {
    assert.ok(typeof r.branch === 'string' && r.branch.length > 0, `${r.key} lost its branch`);
  }
});

test('the result is capped', () => {
  const many: TradeMatch[] = Array.from({ length: 20 }, (_, i) => ({
    key: `k${i}`,
    label: `Extra Thing ${i}`,
    branch: 'Extra',
    standing: 'open' as const,
  }));
  const rows = rankTradeMatches(many, 'extra', new Set(), 4);
  assert.equal(rows.length, 4);
});

test('filtering happens before ranking, so an excluded top match never crowds out a real one', () => {
  // If exclusion were applied AFTER slicing to the limit, excluding the
  // single best match could return one fewer result than the true eligible
  // count instead of backfilling from the rest of the ranked list.
  const rows = rankTradeMatches(TRADES, 'cart', new Set(['sorbetes_cart']), 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.key, 'ice_cream_cart');
});
