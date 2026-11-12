/**
 * 🃏 A FIND CARD OPENS THE SHIPPED GROWN CARD — never a Find-only drawing.
 *
 * Owner, 2026-11-13, rejecting a full-screen supplier sheet built for Find: "We have a full screen of a supplier card
 * that expands all the information of that card. That is not the one." That card is SERVICE CARD GROWN
 * (`app/v/[slug]/_components/service-details-sheet.tsx`), and the shop page's `?service=` address is the door that
 * already raises it with the shop page's own `toServiceCard` props — the marketplace card uses the same door.
 *
 * Pinned here: the bench card carries that address, a withheld supplier loses it with its name, and Find's door
 * follows it before it ever opens the Find sheet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { withholdCardNames, type BenchServiceCard } from '@/lib/bench-service-card';

const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

const CARD: BenchServiceCard = {
  name: 'Grazing table',
  priceText: 'from ₱18,000',
  discountBadge: null,
  includesLine: null,
  notIncluded: [],
  givesSetnayanGift: false,
  coverUrl: null,
  detailsHref: '/lechon-co?service=S89S-ABCDEFGHJK',
};

test('a withheld supplier loses the address with its name (an address names a shop)', () => {
  const out = withholdCardNames({ v1: CARD, v2: CARD }, ['v1']);
  assert.equal(out.v1!.detailsHref, null);
  assert.equal(out.v2!.detailsHref, CARD.detailsHref);
});

test('the bench card address is the shop page `?service=` door, and only when the grown card is on', () => {
  const src = read('lib/bench-service-cards.ts');
  assert.match(src, /detailsHref:\s*row\.public_id\?\.trim\(\)\s*\?\s*serviceCardAddress\(/);
  assert.match(src, /serviceDetailsEnabled\(\)\s*\?\s*fetchShopSlugs\(/);
});

test("Find's door follows the address before it opens the Find sheet — and never for a withheld name", () => {
  const src = read('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
  const at = src.indexOf('open: (target) => {');
  assert.ok(at > 0, 'the sheet door decides per card');
  const body = src.slice(at, at + 300);
  assert.match(body, /target\.nameWithheld \? null : \(target\.card\?\.detailsHref \?\? null\)/);
  assert.ok(body.indexOf('router.push(href)') < body.indexOf('setSheetTarget(target)'), 'the grown card wins');
});

test('Find draws no card view of its own — the supplier sheet stays the bottom sheet it shipped as', () => {
  const src = read('app/dashboard/[eventId]/vendors/_components/supplier-sheet.tsx');
  assert.doesNotMatch(src, /<Sheet[^>]*\bfull\b/);
  assert.doesNotMatch(src, /data-sheet-walk/);
});
