/**
 * 💎🍎 EVENT HUB PRO, PART BY PART — IN THE iPHONE APP 1.1 (owner 2026-10-22, "yes to all"; PR3 of the build).
 *
 * Flag-dark: nothing here lights up without the one IAP gate (`SetnayanIAP/2` + the owner's switch). The properties:
 *
 *   1. the retired standalone Animated Monogram READS AS Logo & QR — in the ownership chain (both directions) and in
 *      the cap (what its owners paid counts at the part's web value);
 *   2. the Apply sheet, where Apple sells, names the parts with NO web figure, and offers "Everything" only while the
 *      event owns nothing;
 *   3. the server refuses "Everything" once any part is owned, and refuses a part the event already holds;
 *   4. Apple's page sells the asked parts one after another at StoreKit's own `displayPrice` — never a typed ₱.
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
import { applySheetButtons, applySheetParts, type ApplySheetPricing } from './apply-sheet-parts';
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

test('the monogram page sells the Logo & QR part, not the retired standalone', () => {
  const page = code('app/dashboard/[eventId]/monogram/animated-monogram-upgrade.tsx');
  assert.match(page, /hubPart\('logo_qr'\)\.sku/);
  assert.doesNotMatch(page, /serviceKey=["']ANIMATED_MONOGRAM["']/);
});

/* ── 2 · the sheet, where Apple sells ──────────────────────────────────── */

const fx = (id: string, part: HubPartId): HubProEffectView =>
  ({ id, part, what: id, where: 'Hero', jump: { kind: 'look' }, removable: true }) as HubProEffectView;

function apple(parts: HubPartId[], paidPhp = 0): ApplySheetPricing {
  return { partPricePhp: {}, fullPricePhp: null, ownership: { full: false, parts, paidPhp, fullPricePhp: null }, appleStore: true };
}

test('the app sheet names the parts with no figure; "Everything" only while nothing is owned', () => {
  const effects = [fx('a', 'motion'), fx('m', 'music')];
  const fresh = applySheetButtons(applySheetParts(effects, apple([])), apple([]));
  assert.ok(fresh, 'the app sheet drew no buttons (a missing web price must not blank it)');
  assert.equal(fresh!.appleStore, true);
  assert.equal(fresh!.everythingOffered, true);
  assert.equal(fresh!.subtotalPhp, 0);
  assert.equal(fresh!.restPhp, 0);
  assert.deepEqual(fresh!.partIds, ['motion', 'music']);
  const holding = applySheetButtons(applySheetParts(effects, apple(['style'], 1000)), apple(['style'], 1000));
  assert.equal(holding!.everythingOffered, false, '"Everything" offered in the app to an event that owns a part');
  assert.deepEqual(holding!.ownedNames, ['Style']);
});

test('the web sheet always offers everything', () => {
  const web: ApplySheetPricing = {
    partPricePhp: { motion: 1000 },
    fullPricePhp: 5000,
    ownership: { full: false, parts: ['style'], paidPhp: 1000, fullPricePhp: 5000 },
  };
  const b = applySheetButtons(applySheetParts([fx('a', 'motion')], web), web);
  assert.equal(b!.everythingOffered, true);
  assert.equal(b!.appleStore, undefined);
});

test('the app sheet writes no figure and gates the Everything button on everythingOffered', () => {
  const sheet = code('app/dashboard/[eventId]/website/_components/apply-pro-sheet.tsx');
  assert.match(sheet, /everythingOffered/);
  assert.match(sheet, /Billed by Apple to your Apple account\./);
  const bar = code('app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx');
  assert.match(bar, /appleIap\s*\?[\s\S]{0,200}partPricePhp: \{\}, fullPricePhp: null,[\s\S]{0,120}appleStore: true/);
});

/* ── 3 · the server refuses ─────────────────────────────────────────────── */

test('the server refuses Everything once any part is owned, and an owned part', () => {
  const a = code('lib/iap/iap-actions.ts');
  assert.match(a, /product\.kind === 'event-hub-part'[\s\S]{0,200}eventOwnsHubPart\(admin, eventId, part\)\)\) return startRefusal\('owned'\)/);
  assert.match(a, /product\.kind === 'event-hub-pro'[\s\S]{0,200}if \(own\.full\) return startRefusal\('owned'\);\s*if \(own\.parts\.size > 0 \|\| own\.paidPhp > 0\) return startRefusal\('not_on_sale'\);/);
});

/* ── 4 · Apple's page ───────────────────────────────────────────────────── */

test('Apple’s page drops owned parts and hides Everything once a part is owned', () => {
  const page = code('app/dashboard/[eventId]/apple-pro/page.tsx');
  assert.match(page, /eventHubOwnership\(ent, eventId, 'owned'\)/);
  assert.match(page, /\.filter\(isHubPartId\)\.filter\(\(id\) => !own\?\.parts\.has\(id\)\)/);
  assert.match(page, /if \(parts\.length === 0 && \(owned\.length > 0 \|\| \(own\?\.paidPhp \?\? 0\) > 0\)\) redirect\(back\);/);
});

test('Apple’s page prices each part from StoreKit and buys them one after another — no typed ₱', () => {
  const screen = code('app/_components/iap/apple-pro-screen.tsx');
  assert.match(screen, /loadAppStoreProducts\(parts\.map\(\(p\) => p\.productId\)\)/);
  assert.match(screen, /map\?\.get\(p\.productId\)\?\.displayPrice/);
  assert.match(screen, /for \(const p of left\) \{[\s\S]{0,120}await buyWithApple\(\{ eventId, productId: p\.productId \}\)/);
  assert.doesNotMatch(screen, /₱\s*\d/, 'a typed price in the Apple page');
});
