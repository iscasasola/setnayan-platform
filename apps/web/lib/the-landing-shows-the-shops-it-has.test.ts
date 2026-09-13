/**
 * THE MARKETPLACE LANDING SHOWS THE SHOPS IT HAS.
 *
 * ── WHY (owner, 2026-09-08) ────────────────────────────────────────────────
 * *"entering on this page should automatically show service cards already. why
 * don't I see any"* — on `/explore`, with two shops live.
 *
 * The landing rendered the category taxonomy INSTEAD of vendors, and its own
 * comment carried the reason: the catalog "replaces the bare empty-state that
 * previously rendered when ZERO VENDORS satisfied the publishing gate". Written
 * for an empty marketplace, and never revisited once one wasn't. The failure
 * mode is the one this repo has shipped seven fixes for — a page that renders
 * emptiness it does not have — except here it was a decision rather than a bug,
 * which is why nothing caught it.
 *
 * These tests hold the two halves that must not drift back:
 *   1. the landing asks the DATABASE whether the marketplace is empty, rather
 *      than assuming it; and
 *   2. it never calls a handful of shops "Trending".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { LIVE_SHOP_GATE, countLiveShops } from '@/lib/live-shops';
import { TRENDING_MIN_LIVE_SHOPS } from '@/lib/front-door-composition';

const HERE = dirname(fileURLToPath(import.meta.url));
const explore = stripComments(
  readFileSync(join(HERE, '..', 'app', '(shell)', 'explore', 'page.tsx'), 'utf8'),
);

test('the landing decides emptiness from the database, not from an assumption', () => {
  assert.match(
    explore,
    /countLiveShops\(admin\)/,
    'the landing stopped counting live shops — it is assuming again',
  );
  assert.match(
    explore,
    /isLandingView && marketplaceIsEmpty/,
    'the catalog-only branch no longer requires the marketplace to be empty',
  );
});

test('a FAILED count falls back to the catalog, never to "no shops"', () => {
  // null ⇒ read failed. `marketplaceIsEmpty` must be true only for a real 0,
  // so a broken count renders yesterday's behaviour instead of telling a
  // visitor the marketplace is empty when it is not.
  assert.match(
    explore,
    /marketplaceIsEmpty\s*=\s*liveShopCount === 0/,
    'emptiness is no longer an exact 0 — a null (failed) read may now be ' +
      'treated as an empty marketplace, which is a false statement to the visitor',
  );
});

test('"Trending" is never said below the owner\'s threshold', () => {
  assert.match(
    explore,
    /TRENDING_MIN_LIVE_SHOPS/,
    'the landing heading stopped using the shared threshold',
  );
  assert.match(explore, /'The first shops'/, 'the honest heading is gone');
  // The number itself must not be typed here — it is the owner's to move, in
  // one place. (12 today; the assertion is about where it lives, not its value.)
  assert.ok(
    !new RegExp(`>=\\s*${TRENDING_MIN_LIVE_SHOPS}\\b`).test(explore),
    'the threshold is hard-coded into the landing instead of imported',
  );
});

test('the live-shop gate is the real one, not the legacy is_published', () => {
  assert.deepEqual(LIVE_SHOP_GATE, {
    public_visibility: 'verified',
    verification_state: 'verified',
  });
  // Measured in prod 2026-09-08: both shops are public_visibility='verified'
  // while one is is_published=false. Counting the legacy way reports 1 where
  // the marketplace shows 2 — and 0 where it shows 1, which is what would make
  // this page apologise for emptiness it does not have.
  assert.ok(
    !Object.keys(LIVE_SHOP_GATE).includes('is_published'),
    'the legacy is_published column is back in the live-shop gate',
  );
});

test('countLiveShops returns null on a failed read — never 0', async () => {
  const rejecting = {
    from: () => ({
      select: () => ({ match: async () => ({ count: null, error: new Error('nope') }) }),
    }),
  };
  assert.equal(await countLiveShops(rejecting as never), null);

  const throwing = {
    from: () => {
      throw new Error('client exploded');
    },
  };
  assert.equal(await countLiveShops(throwing as never), null);

  const ok = {
    from: () => ({ select: () => ({ match: async () => ({ count: 7, error: null }) }) }),
  };
  assert.equal(await countLiveShops(ok as never), 7);
});
