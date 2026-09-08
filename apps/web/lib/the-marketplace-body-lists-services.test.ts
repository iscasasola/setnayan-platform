/**
 * THE MARKETPLACE BODY LISTS SERVICES, AND HAS ONE SEARCH BAR.
 *
 * ── WHY (owner, 2026-09-08) ────────────────────────────────────────────────
 * Two complaints on one screenshot:
 *   *"i still do not see the service cards"* — the grid drew one card per
 *   VENDOR and picked a service to stand for the shop, so Saysay's ₱40,000
 *   Host Mc card was nowhere while its ₱35,000 Live Band card stood in for the
 *   whole shop. `lib/marketplace-service-cards.ts` was built EARLIER THE SAME
 *   DAY to kill exactly that, and nothing imported it.
 *
 *   *"why are there 2 search bar when i explicitly said use the search bar on
 *   top"* — a regression I shipped an hour earlier: rendering `<CatalogView>`
 *   under the results to keep the category breadth also dragged its
 *   `ExploreSearchHero` down with it.
 *
 * 🔑 A COMPONENT IS NOT A SECTION. CatalogView is a whole landing — hero,
 * search, folder strip. Reaching for it to reuse one of its parts brings all of
 * them, and the part that showed up uninvited was a second search field. That
 * is the lesson worth keeping, and it is why the assertion below is about
 * WHERE CatalogView may render, not about the search bar's markup.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const explore = stripComments(
  readFileSync(join(HERE, '..', 'app', '(shell)', 'explore', 'page.tsx'), 'utf8'),
);

test('the body renders SERVICE cards from the shared query', () => {
  assert.match(
    explore,
    /fetchMarketplaceServiceCards\(/,
    'the marketplace stopped using the shared service-card query — it is back ' +
      'to drawing one card per vendor and guessing which service stands for the shop',
  );
  assert.match(explore, /<ServiceCardView\b/, 'the shared service card is no longer rendered');
  assert.match(
    explore,
    /toServiceCard\(/,
    'the card is being built by hand instead of the one shared builder',
  );
});

test('a FAILED service read degrades to the vendor grid, never to an empty page', () => {
  // The module THROWS rather than returning [] precisely so a broken read
  // cannot render as "no suppliers match". The caller must therefore catch and
  // fall back — `serviceCards === null` means "could not load", and the page
  // shows what it shipped yesterday instead of a convincing lie.
  assert.match(
    explore,
    /fetchMarketplaceServiceCards\([\s\S]{0,120}?\.catch\(\(\) => null\)/,
    'the service-card read is no longer caught — a failure now renders as an ' +
      'empty marketplace, which is the exact failure-as-emptiness class this ' +
      'repo has shipped seven fixes for',
  );
  assert.match(
    explore,
    /serviceCards !== null \? \(/,
    'the fallback branch is gone — a failed read has nothing to fall back to',
  );
});

test('CatalogView renders as the landing, never underneath the results', () => {
  // The regression, pinned by SHAPE rather than by counting search inputs: a
  // second <CatalogView> below the grid is what dragged a second search hero
  // onto the page. One render site only — the early return for a genuinely
  // empty marketplace.
  const renders = explore.match(/<CatalogView\b/g) ?? [];
  assert.equal(
    renders.length,
    1,
    `CatalogView is rendered ${renders.length} times. It is a whole landing — ` +
      'hero, search bar and folder strip — not a section you can park under the ' +
      'results. A second render site is a second search bar.',
  );
});

test('the one render site is the empty-marketplace branch', () => {
  const at = explore.indexOf('<CatalogView');
  const emptyBranch = explore.indexOf('isLandingView && marketplaceIsEmpty');
  assert.ok(emptyBranch > -1, 'the empty-marketplace branch is gone');
  assert.ok(
    at > emptyBranch,
    'CatalogView no longer renders from the empty-marketplace branch — it has ' +
      'moved somewhere that will bring its search hero with it',
  );
});
