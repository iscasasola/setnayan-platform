/**
 * An empty shop shelf says so in one plain line, and offers the supplier a door.
 *
 * Owner, DECISION_LOG 2026-09-29 "LANE 2 §2C" (1): with the two trial shops
 * marked `is_demo`, "Discover's Shops shelf and the marketplace show nothing
 * until a real supplier joins" — accepted, on the condition (builder brief,
 * 2026-09-30) that the empty state reads well: a plain line + "Open your shop".
 *
 * 🔑 AND A FAILED READ NEVER READS AS "NONE" — the disease CLAUDE.md records
 * seven fixes for. `liveShopCount` is null only when the count read failed, so
 * the "no supplier yet" sentence is tied to `=== 0`, never to an empty list.
 *
 * SABOTAGE (run once, 2026-09-30): `liveShopCount === 0` → `!liveShopCount`
 * (a failed read would say "none") → RED; drop the /open-shop door from the
 * empty /explore view → RED; restore "The first shops" as the zero heading → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the front door shelf: plain heading and line when empty, and never "none" on a failed read', () => {
  const feed = code('app/_components/frontdoor/front-door-feed.tsx');
  assert.match(feed, /shape\.shopsHeading === 'first-shops'\s*\?\s*'The first shops'\s*:\s*'Shops'/,
    'an empty shelf must not be headed "The first shops"');
  assert.match(feed, /liveShopCount === 0\s*\?\s*'No supplier has opened a shop yet\.'/,
    'the "none yet" sentence must be tied to a MEASURED zero, not to an empty list');
  assert.match(feed, /couldn.t load/, 'a failed read must say so');
  assert.match(feed, /href="\/open-shop"/, 'the shelf keeps its "Open your shop" door');
});

test('the empty /explore view: one plain line and an "Open your shop" door', () => {
  const explore = code('app/(shell)/explore/page.tsx');
  const catalog = explore.slice(explore.indexOf('async function CatalogView('));
  assert.ok(catalog.length > 1000, 'precondition: CatalogView was found');
  assert.match(catalog, /No supplier has opened a shop yet/);
  assert.match(catalog, /<Link href="\/open-shop"[^>]*>\s*Open your shop/);
  // CatalogView renders only on a MEASURED zero — never on a failed count.
  assert.match(explore, /const marketplaceIsEmpty = liveShopCount === 0;/);
  assert.match(explore, /if \(isLandingView && marketplaceIsEmpty\)/);
});
