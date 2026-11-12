/**
 * 🏅 The shop page's hero badges are the circular image badges, in one spaced row (owner, 12 Nov 2026: "Circles +
 * spacing"). Before, the long pills sat inline in a block with 0 px between them, touching the (DEMO ONLY) ⓘ and the
 * "New to Setnayan" chip. Same drawing as Discover's shop card (#7493): `badgeImageOf` → `ImageBadge`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const page = readFileSync(join(process.cwd(), 'app/v/[slug]/page.tsx'), 'utf8');

test('the hero badges sit in one flex row with a gap', () => {
  const start = page.indexOf('data-shop-hero-badges=""');
  assert.ok(start > 0, 'the hero badge row is gone');
  assert.match(page.slice(start, start + 120), /className="flex flex-wrap items-center gap-2"/);
  const row = page.slice(start, page.indexOf('<ShopSinceLine', start));
  for (const b of ['badge={verifiedBadge()}', 'performancePills.map', 'badge={ratingPill!}']) {
    assert.ok(row.includes(b), `${b} left the spaced row`);
  }
});

test('the shop page draws circles, never the long pill', () => {
  assert.doesNotMatch(page, /<ShopBadgePill\b/, 'the shop page draws the long pill again');
  assert.match(page, /<ImageBadge \{\.\.\.badgeImageOf\(badge\)\}/);
});
