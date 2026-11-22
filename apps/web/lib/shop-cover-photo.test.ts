/**
 * shop-cover-photo.test.ts — the ONE rule for the photo that leads a shop (its page's hero and its share card).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { SHOP_PORTFOLIO_READ, shopCoverChoice, shopPortfolioKeys } from './shop-cover-photo';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, '..', rel), 'utf8'));

test('the chosen hero leads when the plan’s picks render and it is not unlisted', () => {
  const none = new Set<string>();
  assert.deepEqual(shopCoverChoice({ heroPhotoKey: 'h', proPicksRender: true, showPortfolio: true, unlisted: none }), { heroKey: 'h', portfolioLeads: true });
  assert.equal(shopCoverChoice({ heroPhotoKey: 'h', proPicksRender: false, showPortfolio: true, unlisted: none }).heroKey, null);
  assert.equal(shopCoverChoice({ heroPhotoKey: 'h', proPicksRender: true, showPortfolio: true, unlisted: new Set(['h']) }).heroKey, null);
});

test('a hidden portfolio never leads', () => {
  assert.equal(shopCoverChoice({ heroPhotoKey: null, proPicksRender: true, showPortfolio: false, unlisted: new Set() }).portfolioLeads, false);
});

test('the portfolio keys: unlisted left out, first 12, order kept', () => {
  const keys = Array.from({ length: 20 }, (_, i) => `k${i}`);
  const shown = shopPortfolioKeys(keys, new Set(['k0', 'k3']));
  assert.equal(shown.length, SHOP_PORTFOLIO_READ);
  assert.deepEqual(shown.slice(0, 3), ['k1', 'k2', 'k4']);
  assert.deepEqual(shopPortfolioKeys(null, new Set()), []);
});

test('the shop page and the share card both choose through this one rule — never a second copy', () => {
  const page = read('app/v/[slug]/page.tsx');
  assert.match(page, /shopCoverChoice\(\{/, 'the page’s hero must come from shopCoverChoice');
  assert.match(page, /resolvePortfolioPhotos\(shopPortfolioKeys\(/, 'the page’s portfolio read must use shopPortfolioKeys');
  assert.match(page, /cover\.portfolioLeads \?/, 'the page’s fallback to the first portfolio photo follows the rule');
  const card = read('lib/social/vendor-card-facts.server.ts');
  assert.match(card, /shopCoverChoice\(\{/);
  assert.match(card, /shopPortfolioKeys\(/);
});
