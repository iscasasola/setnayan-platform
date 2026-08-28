/**
 * GUARD — one trade, many names (C2, 2026-08-28).
 *
 * Pins the three claims the whole feature stands on:
 *   1. an unreviewed alias answers nobody;
 *   2. an alias whose trade was merged into another follows the forward,
 *      exactly like every other reader of service-merge-forward.ts;
 *   3. an alias whose trade is no longer visible (retired, or the forward
 *      lands somewhere that also is not visible) renders NOTHING — never a
 *      stale trade to a supplier.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  reviewedAliasesByLiveTrade,
  normalisePhrase,
  type TradeAliasRow,
} from './service-trade-aliases';
import type { MergeForwardMap } from './service-merge-forward';

test('ANCHOR — normalisePhrase is the SAME function ask-the-admin.ts exports, not a second one', async () => {
  const { normalisePhrase: fromAdmin } = await import('./admin-map/ask-the-admin');
  assert.equal(normalisePhrase, fromAdmin, 'service-trade-aliases.ts re-exports a DIFFERENT function');
  assert.equal(normalisePhrase('  Sorbetes   CART '), 'sorbetes cart');
});

test('an unreviewed alias (reviewed_at NULL) answers nobody', () => {
  const rows: TradeAliasRow[] = [
    { phrase: 'sorbetero', canonical_service: 'sorbetes_cart', reviewed_at: null },
  ];
  const out = reviewedAliasesByLiveTrade(rows, {}, new Set(['sorbetes_cart']));
  assert.equal(out.size, 0, 'an unreviewed alias made it into the search index');
});

test('a reviewed alias for a still-live trade IS returned', () => {
  const rows: TradeAliasRow[] = [
    { phrase: 'sorbetero', canonical_service: 'sorbetes_cart', reviewed_at: '2026-08-28T00:00:00Z' },
  ];
  const out = reviewedAliasesByLiveTrade(rows, {}, new Set(['sorbetes_cart']));
  assert.deepEqual(out.get('sorbetes_cart'), ['sorbetero']);
});

test('an alias for a trade later MERGED into another follows the forward', () => {
  // sorbetes_cart was merged into ice_cream_cart — the alias must land on
  // the LIVE key, not the tombstoned one, exactly as service-merge-forward
  // resolves every other stored key in this repo.
  const rows: TradeAliasRow[] = [
    { phrase: 'sorbetero', canonical_service: 'sorbetes_cart', reviewed_at: '2026-08-28T00:00:00Z' },
  ];
  const forwards: MergeForwardMap = { sorbetes_cart: 'ice_cream_cart' };
  const out = reviewedAliasesByLiveTrade(rows, forwards, new Set(['ice_cream_cart']));
  assert.deepEqual(out.get('ice_cream_cart'), ['sorbetero']);
  assert.equal(out.has('sorbetes_cart'), false, 'the alias stayed on the tombstoned key');
});

test('an alias whose resolved trade is NOT currently visible renders nothing, silently', () => {
  // Retired after the alias row was written, and never merged anywhere —
  // no forward exists, so it resolves to itself, which is not in liveKeys.
  const rows: TradeAliasRow[] = [
    { phrase: 'sorbetero', canonical_service: 'retired_trade', reviewed_at: '2026-08-28T00:00:00Z' },
  ];
  const out = reviewedAliasesByLiveTrade(rows, {}, new Set(['sorbetes_cart', 'ice_cream_cart']));
  assert.equal(out.size, 0, 'a dangling alias rendered instead of falling through silently');
});

test('a merge chain that lands on a trade ALSO not visible still drops silently', () => {
  const rows: TradeAliasRow[] = [
    { phrase: 'x', canonical_service: 'a', reviewed_at: '2026-08-28T00:00:00Z' },
  ];
  const forwards: MergeForwardMap = { a: 'b' }; // b was itself retired, no forward from b
  const out = reviewedAliasesByLiveTrade(rows, forwards, new Set(['c']));
  assert.equal(out.size, 0);
});

test('two reviewed aliases for the same live trade both survive', () => {
  const rows: TradeAliasRow[] = [
    { phrase: 'sorbetero', canonical_service: 'sorbetes_cart', reviewed_at: '2026-08-28T00:00:00Z' },
    { phrase: 'ice cream vendor', canonical_service: 'sorbetes_cart', reviewed_at: '2026-08-28T00:00:01Z' },
  ];
  const out = reviewedAliasesByLiveTrade(rows, {}, new Set(['sorbetes_cart']));
  assert.deepEqual(out.get('sorbetes_cart')?.sort(), ['ice cream vendor', 'sorbetero']);
});

test('a mix of reviewed, unreviewed and dangling rows filters to exactly the survivors', () => {
  const rows: TradeAliasRow[] = [
    { phrase: 'sorbetero', canonical_service: 'sorbetes_cart', reviewed_at: '2026-08-28T00:00:00Z' },
    { phrase: 'not yet', canonical_service: 'sorbetes_cart', reviewed_at: null },
    { phrase: 'gone', canonical_service: 'retired_thing', reviewed_at: '2026-08-28T00:00:00Z' },
  ];
  const out = reviewedAliasesByLiveTrade(rows, {}, new Set(['sorbetes_cart']));
  assert.deepEqual([...out.entries()], [['sorbetes_cart', ['sorbetero']]]);
});
