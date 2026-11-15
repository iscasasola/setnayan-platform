/**
 * WHEN Discover (`/`) shows its supplier view, and the addresses that keep you in it — `lib/discover-suppliers.ts`.
 *
 * DECISION_LOG 2026-11-12 "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED"; owner: *"find suppliers needs to be also
 * inside discover already. they do not need to have their own page"*.
 *
 * Held here (pure, real assertions — no regex over source):
 *   (c) THE `q` RULE — `q` alone is Discover's own search; any supplier parameter opens the supplier view, and the
 *       one search box then carries the view's parameters so `q` narrows it;
 *   · every "stay in the view" address (Clear all, All categories) keeps the view open with its mark;
 *   · a category pick replaces any folder/tile scope, keeps every other filter and starts at page 1.
 *
 * Sabotage (2026-11-12): `opensSupplierView` changed to also count `q` → (c) red; `discoverSupplierHref` without the
 * mark → "Clear all stays in the view" red; `categoryPickHref` keeping `page` → the category test red. Each restored.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  DISCOVER_SUPPLIER_PARAM_KEYS,
  categoryPickHref,
  discoverSupplierHref,
  opensSupplierView,
  supplierSearchCarry,
} from './discover-suppliers';

test('(c) `q` alone is Discover’s own search — it does not open the supplier view', () => {
  assert.equal(opensSupplierView({}), false);
  assert.equal(opensSupplierView({ q: 'catering' }), false);
  assert.equal(opensSupplierView(new URLSearchParams('q=catering')), false);
  // An empty value is not a parameter: `/?category=` is the plain page.
  assert.equal(opensSupplierView({ category: '' }), false);
  assert.equal(opensSupplierView({ city: '   ' }), false);
});

test('(c) any supplier parameter opens the supplier view — and `q` then narrows it', () => {
  for (const k of DISCOVER_SUPPLIER_PARAM_KEYS) {
    assert.equal(opensSupplierView({ [k]: 'x' }), true, `?${k}= no longer opens the supplier view`);
  }
  assert.equal(opensSupplierView({ q: 'lechon', category: 'catering' }), true);
  // The one search box carries the open view's parameters (never `page`, never `q` itself, never an empty value).
  assert.deepEqual(supplierSearchCarry({ q: 'lechon', category: 'catering', city: 'Makati', page: '3', faith: '' }), [
    ['category', 'catering'],
    ['city', 'Makati'],
  ]);
  // An array parameter (`?city=a&city=b`) is read as its first value, as the pipeline reads it.
  assert.deepEqual(supplierSearchCarry({ city: ['Makati', 'Taguig'] }), [['city', 'Makati']]);
});

test('Clear all / "See all" stay in the supplier view (the mark is added only when nothing else is left)', () => {
  assert.equal(discoverSupplierHref(new URLSearchParams()), '/?browse=1');
  assert.equal(discoverSupplierHref(new URLSearchParams('q=lechon')), '/?q=lechon&browse=1');
  assert.equal(discoverSupplierHref(new URLSearchParams('category=catering')), '/?category=catering');
  assert.equal(discoverSupplierHref(new URLSearchParams('from=plan')), '/?from=plan');
});

test('a category pick replaces the folder/tile scope, keeps the other filters, starts at page 1', () => {
  assert.equal(
    categoryPickHref('?folder=food&tile=catering&page=4&city=Makati&browse=1&q=lechon', 'caterer'),
    '/?city=Makati&q=lechon&category=caterer',
  );
  // "All categories" drops the scope and stays in the view.
  assert.equal(categoryPickHref('?category=caterer&page=2', null), '/?browse=1');
  assert.equal(categoryPickHref('category=caterer&city=Makati', null), '/?city=Makati');
});
