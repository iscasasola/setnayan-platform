/**
 * the-inquire-sheet-picks-only-what-was-tapped.test.ts — Build 5 F4, the shop page's Inquire pop-up.
 *
 * Lane W walk 2 (plan `supplier_build_5_2026-11-10/00-BUILD-5-PLAN.md`, Step 0 rows 25–26) on SetnaProd, whose three
 * cards are all not live, so every service is listed by its kind (`k:<key>`):
 *   25 · the sheet opened with Mobile bar ON though only Photo booth was meant — `open()` fell back to `services[0]`
 *        whenever no tapped id matched a row (the shop's own Inquire button, or a card that is not a row);
 *   26 · Photo booth read "Price on request" though its (not yet live) card is ₱14,999.
 * And the supplier's badge read "1 new inquiries".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  inquireOpeningPicks,
  inquireRowNote,
  inquireServiceList,
  PRICE_ON_REQUEST,
  PRICE_WHEN_LIVE,
} from '@/lib/shop-inquire';
import { vendorCustomersBadge } from '@/lib/nav-badges';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const SETNAPROD = inquireServiceList(
  [],
  ['mobile_bar', 'pabati', 'day_of_coordinator', 'photo_booth', 'photoman'],
  (k) => `name-of-${k}`,
  ['mobile_bar', 'photo_booth', 'photoman'],
);

test('25 · nothing is picked unless the couple tapped it — never the first service by default', () => {
  assert.deepEqual(inquireOpeningPicks(SETNAPROD, undefined), [], 'the shop’s own Inquire button preselects a service');
  assert.deepEqual(inquireOpeningPicks(SETNAPROD, ['card-not-a-row']), [], 'an unmatched tap falls back to the first service');
  assert.deepEqual(inquireOpeningPicks(SETNAPROD, ['k:photo_booth']), ['k:photo_booth']);
  assert.deepEqual(inquireOpeningPicks(SETNAPROD, ['k:photo_booth', 'k:pabati', 'k:photo_booth']), ['k:photo_booth', 'k:pabati']);

  const sheet = stripComments(readFileSync(join(WEB, 'app', 'v', '[slug]', '_components', 'inquire-sheet.tsx'), 'utf8'));
  assert.match(sheet, /setChosen\(inquireOpeningPicks\(services, picks\)\)/);
  assert.doesNotMatch(sheet, /services\[0\]/, 'the pop-up picks the first service for them again');
});

test('26 · a kind with a priced card that is not live says so — “Price on request” only where there is no price', () => {
  const note = (key: string) => inquireRowNote(SETNAPROD.find((s) => s.category === key)!);
  assert.equal(note('photo_booth'), PRICE_WHEN_LIVE);
  assert.equal(note('mobile_bar'), PRICE_WHEN_LIVE);
  assert.equal(note('pabati'), PRICE_ON_REQUEST);
  // A live card's own price always wins.
  assert.equal(inquireRowNote({ serviceId: 'c', label: 'Booth', price: 'from ₱14,999', category: 'photo_booth' }), 'from ₱14,999');

  const page = stripComments(readFileSync(join(WEB, 'app', 'v', '[slug]', 'page.tsx'), 'utf8'));
  assert.match(
    page,
    /hidePricesPublicly\s*\?\s*\[\]\s*:\s*allServices\.filter\(\(s\) => !s\.is_active && s\.starting_price_php !== null && s\.starting_price_php > 0\)/,
    'the shop page no longer tells the pop-up which kinds have a priced card waiting (or ignores a shop that hides prices)',
  );
});

test('“1 new inquiry” — one count, one noun', () => {
  assert.equal(vendorCustomersBadge(1, 1)?.label, '1 new inquiry · 1 unread thread');
  assert.equal(vendorCustomersBadge(3, 0)?.label, '3 new inquiries · 0 unread threads');
});
