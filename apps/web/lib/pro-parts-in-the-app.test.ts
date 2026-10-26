/**
 * 💎🍎 EVENT HUB PRO IN THE iPHONE APP — SOLD WHOLE (owner 2026-10-26, "just have the upgrade event hub pro"; it
 * retires the 2026-10-22 "part by part in the app" build, PR3, which this file used to hold).
 *
 * Flag-dark: nothing here lights up without the one IAP gate (`SetnayanIAP/2` + the owner's switch). The properties:
 *
 *   1. the retired standalone Animated Monogram READS AS Logo & QR — in the ownership chain (both directions) and in
 *      the cap (what its owners paid counts at the part's web value) — and the monogram page sells the part only while
 *      its catalogue row is on sale, else Event Hub Pro whole;
 *   2. the Apply sheet, where Apple sells, is the ONE-UNLOCK sheet — "Unlock Pro and Apply", no part named;
 *   3. the server refuses every part in the app, refuses "Everything" once any part is owned, and an owned Pro;
 *   4. Apple's page sells Event Hub Pro alone, at StoreKit's own `displayPrice` — never a part, never a typed ₱.
 *
 * Run: cd apps/web && node --import tsx --test lib/pro-parts-in-the-app.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { HUB_PART_PAID_CODES, HUB_PARTS, hubOwnershipFrom, hubPartOfPaidCode, type HubPartId } from './hub-parts';
import { SKU_OWNERSHIP_ALIASES } from './entitlements';
import { applySheetButtons, applySheetParts } from './apply-sheet-parts';
import type { HubProEffectView } from './hub-pro-effect-view';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(src(rel));

/* ── 1 · the monogram is Logo & QR ─────────────────────────────────────── */

test('the retired Animated Monogram reads as Logo & QR — in the chain, both ways', () => {
  assert.ok(SKU_OWNERSHIP_ALIASES.ANIMATED_MONOGRAM?.includes('COUPLE_HUB_PART_LOGO_QR'), 'a Logo & QR owner lost the monogram');
  assert.ok(SKU_OWNERSHIP_ALIASES.ANIMATED_MONOGRAM?.includes('COUPLE_WEBSITE_PRO'), 'Full Pro lost the monogram');
  assert.ok(SKU_OWNERSHIP_ALIASES.COUPLE_HUB_PART_LOGO_QR?.includes('ANIMATED_MONOGRAM'), 'a monogram owner does not own Logo & QR');
});

test('the cap counts a paid monogram as Logo & QR, at the part’s web value', () => {
  assert.ok(HUB_PART_PAID_CODES.includes('ANIMATED_MONOGRAM'));
  assert.equal(hubPartOfPaidCode('ANIMATED_MONOGRAM'), 'logo_qr');
  assert.equal(hubPartOfPaidCode('COUPLE_HUB_PART_STYLE'), 'style');
  assert.equal(hubPartOfPaidCode('LIVE_STUDIO'), null);
  const prices = new Map(HUB_PARTS.map((p) => [p.sku, p.size === 'big' ? 1000 : 500]));
  const paid = ['ANIMATED_MONOGRAM', 'COUPLE_HUB_PART_REVEAL'].map(hubPartOfPaidCode).filter((p): p is HubPartId => p !== null);
  const own = hubOwnershipFrom({ fullHeld: false, partHeld: (id) => paid.includes(id), paidParts: paid, prices, fullPrice: 5000 });
  assert.equal(own.paidPhp, 1500);
  assert.ok(own.parts.has('logo_qr'));
  // The resolver reads the paid codes through the one mapper — never the bare part SKUs (which would drop the monogram).
  const resolver = code('lib/couple-website-pro.ts');
  assert.match(resolver, /eventSkuLinesFor\(supabase, eventId, HUB_PART_PAID_CODES, HUB_PARTS_ORDER_KEY\)/);
  assert.match(resolver, /\.map\(\(r\) => hubPartOfPaidCode\(r\.service_key\)\)/);
});

test('the monogram page sells the Logo & QR part only while it is on sale — else Event Hub Pro whole', () => {
  const page = code('app/dashboard/[eventId]/monogram/animated-monogram-upgrade.tsx');
  assert.match(page, /hubPart\('logo_qr'\)\.sku/);
  assert.doesNotMatch(page, /serviceKey=["']ANIMATED_MONOGRAM["']/);
  // The catalogue is the one switch: the part when its row is on sale, Full Pro otherwise — never a typed choice.
  assert.match(page, /catalogue\?\.onSale\.has\(SKU_CODE\)[\s\S]{0,200}serviceKey: SKU_CODE[\s\S]{0,200}serviceKey: FULL_PRO_SKU/);
  assert.equal((page.match(/serviceKey=\{sale\.serviceKey\}/g) ?? []).length, 2, 'a monogram buy button still names a fixed code');
});

/* ── 2 · the sheet, where Apple sells ──────────────────────────────────── */

const fx = (id: string, part: HubPartId): HubProEffectView =>
  ({ id, part, what: id, where: 'Hero', jump: { kind: 'look' }, removable: true }) as HubProEffectView;

test('the app hands the Apply sheet no part pricing — it is the one-unlock sheet', () => {
  const bar = code('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  // The one place the sheet's `pricing` is built: never in the app, never in the store shell.
  assert.match(bar, /pricing=\{\s*!storeShell && !appleIap && partPricePhp/);
  assert.doesNotMatch(bar, /appleStore/, 'the bar still builds an Apple parts sheet');
  // No pricing → no part groups, no part buttons: the shipped "Unlock Pro and Apply".
  assert.equal(applySheetParts([fx('a', 'motion')], null), null);
  assert.equal(applySheetButtons(null, null), null);
  const sheet = code('app/dashboard/[eventId]/website/_components/apply-pro-sheet.tsx');
  assert.doesNotMatch(sheet, /appleStore|everythingOffered/, 'the sheet still has an Apple parts branch');
  assert.match(sheet, /Unlock Pro and Apply/);
});

/* ── 3 · the server refuses ─────────────────────────────────────────────── */

test('the server refuses every part in the app, Everything once any part is owned, and an owned Pro', () => {
  const a = code('lib/iap/iap-actions.ts');
  // A part product is no longer a product at all (`RETIRED_HUB_PART_PRODUCT_IDS`): the start refuses it as unknown.
  assert.match(a, /const product = iapProductById\(input\.productId\);[\s\S]{0,120}if \(!product \|\| !eventId\) return startRefusal\('unavailable'\);/);
  assert.doesNotMatch(a, /event-hub-part/, 'the app still knows a part product kind');
  assert.match(a, /product\.kind === 'event-hub-pro'[\s\S]{0,200}if \(own\.full\) return startRefusal\('owned'\);\s*if \(own\.parts\.size > 0 \|\| own\.paidPhp > 0\) return startRefusal\('not_on_sale'\);/);
});

/* ── 4 · Apple's page ───────────────────────────────────────────────────── */

test('Apple’s page sells Event Hub Pro alone, and not to an event that holds a part', () => {
  const page = code('app/dashboard/[eventId]/apple-pro/page.tsx');
  assert.match(page, /eventHubOwnership\(ent, eventId, 'owned'\)/);
  assert.doesNotMatch(page, /isHubPartId|iapProductForServiceKey|search\.buy/, 'Apple’s page still reads a part to sell');
  assert.match(page, /if \(own && \(own\.parts\.size > 0 \|\| own\.paidPhp > 0\)\) redirect\(back\);/);
  assert.match(page, /<AppleProScreen eventId=\{eventId\} back=\{back\} \/>/);
});

test('Apple’s page prices Event Hub Pro from StoreKit — no part, no typed ₱', () => {
  const screen = code('app/_components/iap/apple-pro-screen.tsx');
  assert.match(screen, /iapProductForServiceKey\('COUPLE_WEBSITE_PRO'\)/);
  assert.match(screen, /map\?\.get\(PRO\.productId\)\?\.displayPrice/);
  assert.doesNotMatch(screen, /AppleProParts|parts\.map/, 'Apple’s page still sells parts');
  assert.doesNotMatch(screen, /₱\s*\d/, 'a typed price in the Apple page');
});
