/**
 * `/vendor-dashboard/activities` can be reached by a person.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * The page shipped 2026-07-28 with **no doorway anywhere in the repo**: no
 * `<Link>`, no `router.push`, no `redirect`, no nav-config entry, no
 * route-builder, no registry key. The only two mentions of its path outside its
 * own folder were docblock comments in `/vendor-dashboard/lines`.
 *
 * A host wrote the segments he runs — his ceremony intro, his game, his toast —
 * into a page he could only open by typing the URL.
 *
 * 🔑 THE TELL WAS THE ASYMMETRY, not the absence. `/vendor-dashboard/repertoire`
 * is its deliberately-identical sibling (both files say so) and had FIVE
 * doorways. One of a matched pair having none is the signal; a lone route with
 * no inbound link usually is not.
 *
 * ⚠ DELIBERATELY NARROW. A blanket "every route must be linked" check would fire
 * on the seven redirect stubs kept alive for old bookmarks, on deep-link-only
 * routes reached by QR, and on dynamic segments — all correct, all unlinked. A
 * guard that cries wolf teaches its reader to skim past the one time it is
 * right, which this repo has already paid for three times in one day. So this
 * asserts one specific pair that must stay symmetric.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';

const HERE = dirname(new URL(import.meta.url).pathname);
const WEB = join(HERE, '../../..');

// MB17: the tool-card list (and these two hrefs) moved out of page.tsx into
// this sibling pure-data module — see shop-tool-shelves.ts's own docblock.
const SHOP = join(WEB, 'app/vendor-dashboard/shop/shop-tool-shelves.ts');
const NAV = join(WEB, 'app/vendor-dashboard/_components/vendor-bottom-nav.tsx');

test('the segments page is linked from the shop, like its sibling', () => {
  const shop = readFileSync(SHOP, 'utf8');
  assert.ok(
    shop.includes("href: '/vendor-dashboard/activities'"),
    'The shop link list is the doorway. Without an entry here a host cannot ' +
      'reach his own segments page except by typing the URL.',
  );
  // The sibling must still be there too — if someone removes repertoire's entry,
  // this pair has stopped being a pair and the reasoning above no longer holds.
  assert.ok(
    shop.includes("href: '/vendor-dashboard/repertoire'"),
    'repertoire lost its doorway — re-check whether activities still belongs here',
  );
});

test('the nav tab lights on the segments page, like its sibling', () => {
  const nav = readFileSync(NAV, 'utf8');
  assert.ok(
    nav.includes("'/vendor-dashboard/activities'"),
    'Without this the tab goes unlit while a host is standing on the page — he ' +
      'cannot tell which section he is in.',
  );
  assert.ok(
    nav.includes("'/vendor-dashboard/repertoire'"),
    'repertoire left the activeMatch list — the pair is no longer symmetric',
  );
});
