/**
 * one-badge-list.test.ts — ONE badge list, read by every surface that counts or names the Toolkit's badges
 * (controller, walk 24 Nov, fix 5: "make both surfaces read the SAME list, with no typed numbers… Delete the second
 * list and don't pick a winner by hand").
 *
 * On live 179fc0e the Toolkit said "6 badges" (it counted the badge shelf: Setnayan Verified + the five) while
 * /for-suppliers said "5 badges" (it counted `SHOP_BADGE_KEYS`). The list is the shelf's own, `SHELF_BADGE_KEYS`:
 *   (1) the shelf draws exactly that list;
 *   (2) the Toolkit's count, /for-suppliers' count and its "See all" sheet read it, and agree;
 *   (3) no source passes the five-key list where the Toolkit's badges are counted, and no file hand-types the five
 *       keys outside their one home, `lib/badge-tiers.ts`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { SHOP_BADGE_KEYS } from '@/lib/badge-tiers';
import { SHELF_BADGE_KEYS, VERIFIED_TILE_TITLE, shopBadgeShelf } from '@/lib/shop-badge-shelf';
import { toolkitCounts } from '@/lib/supplier-store';
import { toolkitCodeParts } from '@/lib/supplier-toolkit-count';
import { toolkitShelves } from '@/app/for-suppliers/_components/supplier-front-data';

const WEB = join(__dirname, '..');

test('(1) the shelf draws the one list', () => {
  assert.deepEqual(SHELF_BADGE_KEYS, ['verified', ...SHOP_BADGE_KEYS]);
  const drawn = shopBadgeShelf({ counts: null, verified: null, granted: null }).map((t) => t.key);
  assert.deepEqual([...drawn].sort(), [...SHELF_BADGE_KEYS].sort(), 'the badge shelf draws a list of its own');
});

test('(2) the Toolkit, /for-suppliers and its sheet count the same badges', () => {
  // The Toolkit counts what the shelf draws (store-screens `listFacts`: the tiles' keys).
  const shelfKeys = shopBadgeShelf({ counts: null, verified: true, granted: null }).map((t) => t.key);
  const toolkit = toolkitCounts({ papicCapture: false, badges: shelfKeys }).badges;
  const forSuppliers = toolkitCodeParts().badges;
  const sheet = toolkitShelves(false).find((s) => s.key === 'badges');
  assert.ok(sheet, 'anti-vacuity: the sheet has no badge shelf');
  assert.equal(toolkit, SHELF_BADGE_KEYS.length);
  assert.equal(forSuppliers, toolkit, `/for-suppliers counts ${forSuppliers} badges, the Toolkit ${toolkit}`);
  assert.deepEqual(sheet.rows.map((r) => r.key), [...SHELF_BADGE_KEYS], 'the sheet names a different badge list');
  assert.equal(sheet.rows[0]?.name, VERIFIED_TILE_TITLE);
});

function sources(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === '.next' || f.startsWith('.')) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) sources(p, out);
    else if (/\.tsx?$/.test(f) && !/\.(test|spec)\.tsx?$/.test(f) && !/\.generated\./.test(f)) out.push(p);
  }
  return out;
}

test('(3) no second list: nothing counts the five keys as the Toolkit badges, nothing hand-types them', () => {
  const files = [...sources(join(WEB, 'app')), ...sources(join(WEB, 'lib'))];
  assert.ok(files.length > 500, 'anti-vacuity: the source walk found too few files');
  const fiveTyped = /'completed_bookings',\s*'five_star_reviews',\s*'gifts_given',\s*'trusted_by',\s*'invites'/;
  const countsFive = /\b(?:toolkitItems|toolkitCounts)\(\{[^}]*badges:\s*SHOP_BADGE_KEYS\b/;
  const bad: string[] = [];
  for (const f of files) {
    const rel = relative(WEB, f).split('\\').join('/');
    const src = stripComments(readFileSync(f, 'utf8'));
    if (rel !== 'lib/badge-tiers.ts' && fiveTyped.test(src)) bad.push(`${rel}: hand-types the five badge keys`);
    if (countsFive.test(src)) bad.push(`${rel}: counts the Toolkit's badges from SHOP_BADGE_KEYS, not SHELF_BADGE_KEYS`);
  }
  assert.deepEqual(bad, []);
});
