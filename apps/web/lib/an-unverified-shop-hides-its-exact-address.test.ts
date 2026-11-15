/**
 * 📍 AN UNVERIFIED SHOP'S PAGE SHOWS ITS CITY, NEVER ITS STREET — DECISION_LOG 2026-11-15 "AN UNVERIFIED SHOP HAS THE SAME
 * WEBSITE AS A VERIFIED ONE" (*"no exact address"*); prototype `shop_website_two_looks_2026-11-15/site.html` prints the
 * city and "the exact address shows once verified", no pin, no Get directions.
 *
 * W1 Walk A, 15 Nov: an unverified shop's page printed "Banawe Street, Quezon City" with a pinned map and Get
 * directions, while verified Liwanag showed "Pasig City".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { EXACT_ADDRESS_ONCE_VERIFIED, shopWhere } from './shop-page-plan';

const PLACE = { latitude: 14.63, longitude: 121.0, address: 'Banawe Street, Quezon City', city: 'Quezon City' };

test('1 · unverified: city only — no map, no directions, the street nowhere', () => {
  const w = shopWhere(PLACE, false);
  assert.equal(w.has, true);
  assert.equal(w.map, false, 'an unverified shop draws a pinned map');
  assert.equal(w.directionsQuery, null, 'an unverified shop offers directions');
  assert.equal(w.addressNote, EXACT_ADDRESS_ONCE_VERIFIED);
  assert.doesNotMatch(JSON.stringify(w), /Banawe/, 'the street leaks out of shopWhere');
  assert.equal(shopWhere({ ...PLACE, city: null }, false).has, false, 'a street with no city gives an unverified shop a Where');
});

test('2 · verified: the map and directions stay', () => {
  const w = shopWhere(PLACE, true);
  assert.deepEqual([w.has, w.map, w.directionsQuery, w.addressNote], [true, true, 'Banawe Street, Quezon City', null]);
});

test('3 · the page’s unverified Where section draws no map, no directions and no hq_address', () => {
  const page = stripComments(readFileSync(join(process.cwd(), 'app/v/[slug]/page.tsx'), 'utf8'));
  assert.match(page, /const where = shopWhere\([\s\S]*?cinematicHero,\s*\);/, 'the page does not ask shopWhere with the verified look');
  const at = page.indexOf('{cinematicHero || !hasWhere ? null : (');
  assert.ok(at > 0, 'the unverified Where section moved');
  const section = page.slice(at, page.indexOf('</section>', at));
  assert.doesNotMatch(section, /<ShopReachMap|<DirectionsMenu|hq_address|hq_latitude/, 'the unverified Where section shows the street or its pin');
  assert.match(section, /\{where\.addressNote\}/, 'the unverified Where section does not say the address shows once verified');
  // Every other hq_address use on the page sits behind the verified look.
  for (const m of page.matchAll(/query=\{vendor\.hq_address/g)) {
    const before = page.slice(Math.max(0, (m.index ?? 0) - 400), m.index);
    assert.match(before, /\{cinematicHero \? \(\s*<DirectionsMenu[^>]*$/, 'Get directions with the street is drawn outside the verified look');
  }
});
