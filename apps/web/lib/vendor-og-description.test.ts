/**
 * vendor-og-description.test.ts — the share card's "what they do · city" line (shop share card v2, 21 Nov 2026).
 *
 * Only the parts that are true — never a "0", a raw null or an empty claim (row-3838). The v2 card drops the tagline
 * (it shows under the picture) and the word "Verified" (the seal and the top line say it).
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { composeVendorTradeLine } from './vendor-og-description';

test('category · city, in that order', () => {
  const line = composeVendorTradeLine({ services: ['live_band'], location_city: ' Cebu City ' });
  assert.ok(line);
  assert.match(line, / · Cebu City$/, 'the city is trimmed and comes last');
  assert.doesNotMatch(line, /\bundefined\b|\bnull\b/);
});

test('the v2 line never says "Verified" — the seal and the top line say it now', () => {
  const line = composeVendorTradeLine({ services: ['dj'], location_city: 'Davao City' });
  assert.doesNotMatch(line ?? '', /Verified/);
});

test('a missing part is left out, not printed empty', () => {
  assert.equal(composeVendorTradeLine({ services: [], location_city: 'Davao City' }), 'Davao City');
  const noCity = composeVendorTradeLine({ services: ['dj'], location_city: '   ' });
  assert.ok(noCity && !noCity.includes('·'), 'no city → the category alone, no dangling dot');
});

test('nothing true to say → no line at all (null), never a stand-in', () => {
  assert.equal(composeVendorTradeLine({ services: null, location_city: null }), null);
});
