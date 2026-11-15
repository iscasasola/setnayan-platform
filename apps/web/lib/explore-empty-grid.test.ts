/**
 * /explore's empty grid says what it measured, and names the live shops the grid leaves out.
 *
 * Live walk 2026-11-01: the front door showed SetnaProd under "The first shops"; /explore, under the SAME heading,
 * said "No suppliers have published their Setnayan profile yet." Production (read-only, that day): one shop passes
 * `LIVE_SHOP_GATE` — SetnaProd — with 0 active services, so B2 (`vendor-inquirable-gate.ts`) rightly keeps it off the
 * grid. The sentence was the lie. See `lib/explore-empty-grid.ts`.
 *
 * Held here:
 *   1 · the unfiltered empty lines never claim that nobody has published — at any count;
 *   2 · a live shop with no active service is named, linked at its bare-root address; one with a service is not
 *       (the grid already shows it); a row with no name or slug is skipped, not drawn as a broken link;
 *   3 · the page wires it: the unfiltered lines come from `unfilteredEmptyGridCopy`, the old sentence is gone, and
 *       the shops are read under the one live gate and filtered by the same inquirable set the grid uses.
 *
 * Sabotage (2026-11-01): `app/(shell)/explore/page.tsx` restored from main → test 3 red (tests 1–2 hold the helper itself).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { shopsStillSettingUp, unfilteredEmptyGridCopy } from './explore-empty-grid';

const PAGE = stripComments(readFileSync(join(__dirname, '..', 'app', '(shell)', 'explore', '_lib', 'marketplace-view.tsx'), 'utf8')); // 2026-11-12: the marketplace pipeline moved from explore/page.tsx to _lib/marketplace-view.tsx (shared with Discover)

test('1 · the empty grid never says nobody has published', () => {
  for (const n of [0, 1, 3]) {
    const { line, sub } = unfilteredEmptyGridCopy(n);
    assert.doesNotMatch(`${line} ${sub}`, /published|No suppliers/i, `count ${n}: "${line} ${sub}"`);
    assert.equal(line, 'No services listed yet.');
  }
  assert.match(unfilteredEmptyGridCopy(1).sub, /^This supplier has opened their shop/);
  assert.match(unfilteredEmptyGridCopy(2).sub, /^These suppliers have opened their shops/);
  assert.match(unfilteredEmptyGridCopy(0).sub, /Check back soon/);
});

test('2 · a live shop with no active service is named; one with a service, or no slug, is not', () => {
  const live = [
    { vendor_profile_id: 'setnaprod', business_name: 'SetnaProd', business_slug: 'setnaprod' },
    { vendor_profile_id: 'has-service', business_name: 'Listed', business_slug: 'listed' },
    { vendor_profile_id: 'no-slug', business_name: 'No Slug', business_slug: null },
    { vendor_profile_id: 'no-name', business_name: '  ', business_slug: 'x' },
  ];
  assert.deepEqual(shopsStillSettingUp(live, ['has-service']), [{ name: 'SetnaProd', href: '/setnaprod' }]);
  assert.deepEqual(shopsStillSettingUp([], []), []);
});

test('3 · /explore wires it — the old sentence is gone and the shops come from the live gate minus the grid', () => {
  assert.doesNotMatch(PAGE, /No suppliers have published/, 'the unmeasured sentence is back on /explore');
  const empty = PAGE.slice(PAGE.indexOf('function EmptyState('));
  assert.match(empty, /unfilteredEmptyGridCopy\(stillSettingUp\.length\)\.line/, 'the unfiltered line must come from the helper');
  assert.match(empty, /unfilteredEmptyGridCopy\(stillSettingUp\.length\)\.sub/, 'the unfiltered sub-line must come from the helper');
  assert.match(empty, /stillSettingUp\.map\(/, 'the shops still setting up must be listed');
  assert.match(PAGE, /stillSettingUp=\{stillSettingUp\}/, 'the page must hand the shops to EmptyState');
  const read = PAGE.slice(PAGE.indexOf('let stillSettingUp'), PAGE.indexOf('let stillSettingUp') + 900);
  assert.match(read, /\.match\(LIVE_SHOP_GATE\)/, 'the shops must be read under the one live gate');
  assert.match(read, /shopsStillSettingUp\(liveRows \?\? \[\], inquirableVendorIds\)/, 'and filtered by the grid\'s own inquirable set');
});
