/**
 * The "Moodboard library" tool card on the shop-tools shelf must show for any
 * shop whose services reach a mood-board slot — not stylist/decorators alone.
 *
 * ── WHY THIS EXISTS (MB17) ──────────────────────────────────────────────────
 * MB11 widened the moodboard-library PAGE and its server ACTION to every
 * supplying trade via `lib/moodboard-library-access.ts`. It did not widen the
 * only LINK to that page: `shopOwnerIsStylist()` here still read
 * `services.includes('reception_decor')`, so the card stayed stylist-only
 * while the page and the save behind it had already opened for everyone. A
 * florist, cake maker or gown designer could only reach the page by typing
 * `/vendor-dashboard/moodboard-library` — the gate opened and the signage did
 * not, which is indistinguishable from never having shipped.
 *
 * 🔑 Anchored on the SHOP-TOOLS RENDER (`shopToolShelves`, the function whose
 * output actually reaches JSX), not on a string search over the file — a
 * source guard that just greps for the href cannot see whether the card was
 * conditioned on the right predicate or the old one.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shopToolShelves } from './shop-tool-shelves';
import { moodboardLibraryAccessForProfile } from '@/lib/moodboard-library-access';
import type { VendorProfileRow } from '@/lib/vendor-profile';

function fakeProfile(services: string[]): VendorProfileRow {
  return { services } as unknown as VendorProfileRow;
}

function couplesSeeHrefs(hasAccess: boolean): string[] {
  const shelves = shopToolShelves(hasAccess);
  const shelf = shelves.find((s) => s.key === 'couples-see');
  assert.ok(shelf, 'the couples-see shelf must exist');
  return shelf!.tools.map((t) => t.href);
}

test('a shop whose only service is bridal_gown_custom gets the moodboard-library card', () => {
  const access = moodboardLibraryAccessForProfile(fakeProfile(['bridal_gown_custom']));
  assert.equal(access.allowed, true, 'a gown designer supplies the bride slot and should be allowed');

  const hrefs = couplesSeeHrefs(access.allowed);
  assert.ok(
    hrefs.includes('/vendor-dashboard/moodboard-library'),
    'the rendered shelf must include the moodboard-library card for a gown designer',
  );
});

test('a shop with no supplying trade does not get the moodboard-library card', () => {
  const access = moodboardLibraryAccessForProfile(fakeProfile(['disputes_only_trade_that_supplies_nothing']));
  assert.equal(access.allowed, false, 'a trade with no mood-board slot must be refused');

  const hrefs = couplesSeeHrefs(access.allowed);
  assert.ok(
    !hrefs.includes('/vendor-dashboard/moodboard-library'),
    'the rendered shelf must NOT include the moodboard-library card when access is refused',
  );
});
