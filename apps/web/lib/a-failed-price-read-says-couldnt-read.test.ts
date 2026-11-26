/**
 * a-failed-price-read-says-couldnt-read.test.ts — final check, area 3: the money rows, display only.
 *
 * CLAUDE.md §1: a failed read shows "Couldn't read", never ₱0, "Free" or empty. Each page below drew a failed
 * catalogue / order / methods read as a missing price, "not on sale", "part of Event Pro", "Get" again, or
 * "No e-gift methods yet". Nothing here changes an amount, a plan, who may pay, or which row is read:
 * `readV2Sku` reads the same row `formatV2Sku` always read, and only adds whether the read failed.
 *
 *   I-01 E-Gifts methods · E-03 Maker Event Pro price · E-13 Our story price · I-03 Save the Date prices ·
 *   M-02 Keep full resolution price · M-03 Thank-You film price · S-01 add-on About price + order · I-02 address refusal
 *
 * 🔒 Source assertions on the comment-stripped files; each fails when its fix is reverted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { PRICE_UNREAD } from './php';

const D = join(process.cwd(), 'app/dashboard/[eventId]');
const read = (rel: string) => stripComments(readFileSync(join(D, rel), 'utf8'));

test('the one "Couldn\'t read" price sentence', () => {
  assert.equal(PRICE_UNREAD, 'Couldn’t read the price');
});

test('readV2Sku tells a failed read from a missing row; formatV2Sku reads through it', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'lib/v2/sku-catalog-v2.ts'), 'utf8'));
  assert.match(src, /if \(error\) \{\s*console\.error\([^;]*\);\s*return \{ record: null, readFailed: true \};/);
  assert.match(src, /if \(!data\) return \{ record: null, readFailed: false \};/);
  assert.match(src, /return \(await readV2Sku\(sku\)\)\.record;/);
});

test('E-03 · the Maker says it could not read the Event Pro price', () => {
  const src = read('launch/page.tsx');
  assert.match(src, /readV2Sku\('COUPLE_WEBSITE_PRO'\)\.catch\(\(\) => \(\{ record: null, readFailed: true \}\)\)/);
  assert.match(src, /const proPriceLabel = proRead\.readFailed \? PRICE_UNREAD :/);
});

test('E-13 · Our story says it could not read the Event Pro price', () => {
  const src = read('website/our-story/page.tsx');
  assert.match(src, /readV2Sku\('COUPLE_WEBSITE_PRO'\)/);
  assert.match(src, /: !storeShell && proRead\.readFailed \? PRICE_UNREAD : null;/);
});

test('I-03 · Save the Date: a failed read never claims the opening is part of Event Pro', () => {
  const src = read('studio/save-the-date/page.tsx');
  assert.match(src, /const openingsPriceUnread = openingsStandaloneSellable && openingsRead\.readFailed;/);
  // The unread branch comes BEFORE the price branch and the "part of Event Pro" fallback.
  const unread = src.indexOf('openingsPriceUnread ? (');
  const claim = src.indexOf('The cinematic opening is part of Event Pro');
  assert.ok(unread > 0 && claim > unread, 'the unread branch must be checked before the bundle-only claim');
  assert.match(src, /: websiteProRead\.readFailed \? PRICE_UNREAD : null;/);
});

test('M-02 · Keep full resolution says it could not read the price, not a bare icon', () => {
  const src = read('memories/_components/memories-settings.tsx');
  assert.match(src, /const priceUnread = Boolean\(priceRes\.error\);/);
  assert.match(src, /\) : priceUnread \? \(\s*<span role="status"[^>]*>\s*\{PRICE_UNREAD\}/);
});

test('M-03 · the Thank-You film says it could not read the price, not "isn\'t on sale"', () => {
  assert.match(read('memories/thank-you/page.tsx'), /priceUnread: sellability === 'sellable' && skuRead\.readFailed,/);
  const maker = read('memories/thank-you/_components/thank-you-maker.tsx');
  const unread = maker.indexOf('checkout.priceCentavos == null && checkout.priceUnread');
  const notOnSale = maker.indexOf('isn&rsquo;t on sale right now');
  assert.ok(unread > 0 && notOnSale > unread, 'the unread line must be checked before "isn\'t on sale"');
});

test('S-01 · About: a failed price read says so, and a failed order read never offers "Get" again', () => {
  const src = read('studio/_components/addon-detail-view.tsx');
  assert.match(src, /skuRead\.readFailed && !entry\.variablePricing \? PRICE_UNREAD : null;/);
  assert.match(src, /\.then\(\(r\) => \(\{ row: r\.data, readFailed: Boolean\(r\.error\) \}\)\)/);
  assert.match(src, /const orderUnread = orderRead\.readFailed && !isFree;/);
  assert.match(src, /const cta = orderUnread \? \(/);
});

test('I-01 · E-Gifts: a refused methods read says so, with no add form', () => {
  const src = read('pabuya/page.tsx');
  assert.match(src, /const \{ methods, read: methodsRead \} = await readEgiftMethods\(supabase, eventId\);/);
  assert.match(src, /\{!methodsRead \? \(\s*<ReadRefusedNotice what="your E-Gift methods" \/>\s*\) : \(\s*<PabuyaManager/);
  assert.doesNotMatch(src, /fetchEgiftMethods\(/);
});

test('I-02 · the custom-address refusal is a sentence, and an unknown key is never printed', () => {
  const src = read('invitation/page.tsx');
  assert.match(src, /needs_custom_address: '[^']+',/);
  assert.match(src, /SLUG_ERROR_COPY\[slugErrorKey\] \?\? SLUG_ERROR_FALLBACK/);
  assert.doesNotMatch(src, /decodeURIComponent\(slugErrorKey\)/);
});

test('E-13 (owner ruling, Add 45) · a failed plan read says "We couldn\'t check your plan" — no upsell from it', async () => {
  const { PLAN_UNREAD } = await import('./php');
  assert.equal(PLAN_UNREAD, 'We couldn’t check your plan, try again.');
  const page = read('website/our-story/page.tsx');
  assert.equal((page.match(/\.catch\(\(\) => \{\s*planReadFailed = true;\s*return false;\s*\}\)/g) ?? []).length, 2);
  assert.match(page, /planUnread=\{planReadFailed\}/);
  assert.match(page, /planUnread: planReadFailed,/);
  const line = read('website/our-story/_components/love-story-pro-line.tsx');
  // The unread branch returns BEFORE the offer (the link to Event Pro) is drawn.
  const unread = line.indexOf('if (planUnread)');
  const offer = line.indexOf('LOVE_STORY_PRO_CTA}');
  assert.ok(unread > 0 && offer > unread, 'a failed plan read must return before the upsell');
});
