/**
 * 🔒 FREE FILES STAY PRIVATE — the guard (owner-locked 22 Nov 2026; spec § ★ J; DECISION_LOG "SUPPLIER PLAN
 * ANTI-ABUSE RULES LOCKED" (8)).
 *
 *   1. THE RULE, BY BEHAVIOUR — a verified shop's files are public as before; a not-yet-verified shop's are a short
 *      signed link for a signed-in viewer and nothing for a stranger; an unread state is never public.
 *   2. WHOSE FILE — the shop is read off the key every upload path writes, and nothing else is mistaken for one.
 *   3. THE LINK IS SHORT — the media signer a Free file goes through hands out a URL that dies within the TTL window.
 *   4. THE SIGNER — a Free file never reaches the public host or the 24 h signer; a withheld file is never signed.
 *   5. THE SURFACES — the public shop page, its link-preview card, the couple's Suppliers tab, the bench cards and the
 *      supplier sheet all route a shop's files through the rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { stableSigningWindow } from './r2-stable-sign';
import {
  FREE_SHOP_FILE_TTL_SECONDS,
  ownShopServe,
  serveForFileRef,
  shopFileServe,
  shopIdOfFileRef,
  shopIdsOfFileRefs,
  storedFileKey,
  type ShopFileServe,
} from './free-shop-files';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const FREE = '0b8f6a52-6f3e-4c1e-9a0b-1c2d3e4f5a6b';
const VERIFIED = '7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f';
const FREE_COVER = `r2://setnayan-media/vendors/${FREE}/services/1f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b-cover.jpg`;
const VERIFIED_COVER = `r2://setnayan-media/vendors/${VERIFIED}/services/2f2e3d4c-5b6a-4978-8a9b-0c1d2e3f4a5b-cover.jpg`;

/* ── 1 · THE RULE ──────────────────────────────────────────────────────────────────────────────────────────────── */

test('a verified shop is public to everyone — its card photos render exactly as before', () => {
  assert.equal(shopFileServe('verified', { signedIn: false }), 'public');
  assert.equal(shopFileServe('verified', { signedIn: true }), 'public');
});

test('a Free (not verified) shop: a short link inside the app, nothing for a stranger', () => {
  for (const state of ['unverified', 'pending_review', 'rejected', 'demoted']) {
    assert.equal(shopFileServe(state, { signedIn: true }), 'in_app', state);
    assert.equal(shopFileServe(state, { signedIn: false }), 'withheld', state);
  }
});

test('an unread or junk verification state is never public (fail closed)', () => {
  for (const state of [undefined, null, '', 'VERIFIED', ' verified', 1, true]) {
    assert.notEqual(shopFileServe(state, { signedIn: false }), 'public', String(state));
    assert.equal(shopFileServe(state, { signedIn: false }), 'withheld', String(state));
  }
});

test('ownShopServe carries the shop and its serve (lower-cased id)', () => {
  assert.deepEqual(ownShopServe(FREE.toUpperCase(), 'unverified', { signedIn: true }), { shopId: FREE, serve: 'in_app' });
  assert.deepEqual(ownShopServe(VERIFIED, 'verified', { signedIn: false }), { shopId: VERIFIED, serve: 'public' });
});

/* ── 2 · WHOSE FILE ────────────────────────────────────────────────────────────────────────────────────────────── */

test('the shop is read off every key shape a supplier upload is filed under', () => {
  assert.equal(shopIdOfFileRef(FREE_COVER), FREE);
  assert.equal(shopIdOfFileRef(`vendors/${FREE}/portfolio/a.jpg`), FREE, 'a bare key (uploadPublicAsset)');
  assert.equal(shopIdOfFileRef(`r2://setnayan-media/vendors/${FREE.toUpperCase()}/logo/x.png`), FREE);
  assert.equal(shopIdOfFileRef(`r2://setnayan-thread-files/supplier-files/${FREE}/ev/x.pdf`), FREE);
  assert.equal(shopIdOfFileRef(`r2://setnayan-thread-files/vendor-payment-qr/${FREE}/qr.png`), FREE);
  assert.equal(shopIdOfFileRef(`r2://setnayan-media/vendor-originals/${FREE}/x.jpg`), FREE);
});

test('nothing else is mistaken for a shop’s file', () => {
  for (const v of [
    null,
    undefined,
    '',
    'r2://setnayan-media/papic/seat-1/x.jpg',
    'r2://setnayan-media/vendors/lab/services/x.jpg',
    `r2://setnayan-media/events/${FREE}/x.jpg`,
    `r2://setnayan-media/x/vendors/${FREE}/a.jpg`,
    `https://pub-x.r2.dev/vendors/${FREE}/a.jpg`,
    `/vendors/${FREE}/a.jpg`,
    'r2://setnayan-media/',
    42,
  ]) {
    assert.equal(shopIdOfFileRef(v), null, String(v));
  }
  assert.equal(storedFileKey('r2://setnayan-media/a/b.jpg'), 'a/b.jpg');
  assert.deepEqual(shopIdsOfFileRefs([FREE_COVER, VERIFIED_COVER, FREE_COVER, null, 'papic/x']).sort(), [FREE, VERIFIED].sort());
});

test('serveForFileRef: not a shop file is untouched; a shop nobody read is withheld', () => {
  const serves = new Map<string, ShopFileServe>([
    [FREE, 'withheld'],
    [VERIFIED, 'public'],
  ]);
  assert.equal(serveForFileRef(VERIFIED_COVER, serves), 'public', 'a verified shop’s card photo still renders');
  assert.equal(serveForFileRef(FREE_COVER, serves), 'withheld');
  assert.equal(serveForFileRef(FREE_COVER, new Map()), 'withheld', 'an unread shop is never public');
  assert.equal(serveForFileRef('r2://setnayan-media/papic/seat-1/x.jpg', new Map()), 'public', 'not a shop file');
});

/* ── 3 · THE LINK IS SHORT ─────────────────────────────────────────────────────────────────────────────────────── */

test('a Free file’s link lives minutes, not a day — even through the media bucket’s stable-address signer', () => {
  assert.ok(FREE_SHOP_FILE_TTL_SECONDS > 0 && FREE_SHOP_FILE_TTL_SECONDS <= 15 * 60, 'short-lived: at most 15 minutes');
  for (const now of [0, 1_700_000_000_000, 1_700_000_449_999, 1_700_000_899_999]) {
    const { expiresIn } = stableSigningWindow(FREE_SHOP_FILE_TTL_SECONDS, now);
    assert.ok(expiresIn <= FREE_SHOP_FILE_TTL_SECONDS * 1.5, `expires in ${expiresIn}s`);
  }
});

/* ── 4 · THE SIGNER ────────────────────────────────────────────────────────────────────────────────────────────── */

const SIGNER = code('lib/supplier-file-sign.server.ts');
const fnBody = (src: string, name: string) => {
  const at = src.indexOf(`function ${name}(`);
  assert.ok(at >= 0, `${name} is missing`);
  const next = src.indexOf('\nexport ', at + 1);
  const nextLocal = src.indexOf('\nasync function ', at + 1);
  const ends = [next, nextLocal].filter((i) => i > at);
  return src.slice(at, ends.length ? Math.min(...ends) : undefined);
};

test('a Free file is signed short, and never through the public host or the long signer', () => {
  const body = fnBody(SIGNER, 'signFreeShopFile');
  assert.match(body, /ttlSeconds: FREE_SHOP_FILE_TTL_SECONDS/, 'the short TTL is what it signs with');
  assert.match(body, /displayUrlForStoredAsset\(ref, ttl\)/, 'the media bucket: the public-only signer, at the short TTL');
  assert.match(body, /displayUrlForPrivateStoredAsset\(ref, \{ bucket: folder\.bucket, prefixes: \[`\$\{folder\.root\}\/\$\{shop\}\/`\] \}, ttl\)/, 'a private folder: only its own shop');
  for (const banned of [/publicUrlForStoredAsset/, /publicUrlFor\(/, /stableDisplayUrlForStoredAsset/, /displayLogoUrl/, /presignDisplayUrl/]) {
    assert.doesNotMatch(body, banned, `a Free file must never reach ${banned}`);
  }
  // a legacy absolute URL could be our own permanent public address — never passed through (storedFileKey → null)
  assert.match(body, /const key = storedFileKey\(value\);\s*if \(!key\) return null;/);
  assert.equal(storedFileKey(`https://pub-x.r2.dev/vendors/${FREE}/a.jpg`), null);
});

test('withheld is never signed, public is the surface’s own resolver, in_app is the short signer', () => {
  for (const name of ['shopFileUrl', 'ownShopFileUrl']) {
    const body = fnBody(SIGNER, name);
    const pub = body.indexOf("=== 'public') return publicUrl(value)");
    const held = body.indexOf("=== 'withheld') return null");
    const sign = body.indexOf('return signFreeShopFile(');
    assert.ok(pub > 0 && held > 0 && sign > held, `${name}: public → resolver, withheld → null, then the short signer`);
    assert.equal(body.match(/publicUrl\(/g)?.length, 1, `${name}: the public resolver is reached on the public branch only`);
  }
});

test('the shops of other people’s pages are read in ONE query and a failed read publishes nothing', () => {
  const body = fnBody(SIGNER, 'readShopFileServes');
  assert.match(body, /\.from\('vendor_profiles'\)\s*\.select\('vendor_profile_id, verification_state'\)\s*\.in\('vendor_profile_id', ids\)/);
  assert.match(body, /if \(error\) \{[\s\S]*?return out;/, 'a failed read returns the empty map (→ withheld)');
});

/* ── 5 · THE SURFACES ──────────────────────────────────────────────────────────────────────────────────────────── */

test('the public shop page draws every one of its own files through the rule', () => {
  const page = code('app/v/[slug]/page.tsx');
  assert.match(page, /const ownShop = ownShopServe\(vendor\.vendor_profile_id, vendor\.verification_state, \{/);
  assert.match(page, /signedIn: shopIsVerified\(vendor\.verification_state\) \? false : await viewerIsSignedIn\(\)/);
  // every direct signer call on the page sits inside the rule's public resolver — none on its own
  const calls = [...page.matchAll(/displayUrlForStoredAsset\(([^)]*)\)/g)];
  assert.ok(calls.length >= 6, 'the page signs its files');
  for (const m of calls) {
    const before = page.slice(Math.max(0, m.index! - 120), m.index!);
    assert.match(before, /(ownShopFileUrl|shopFileUrl)\([^;]*\((\w+)\) => $/, `a bare signer call: ${m[0]}`);
    assert.match(m[1] ?? '', /^\w$/, `the resolver signs only the value the rule hands it: ${m[0]}`);
  }
  assert.doesNotMatch(page, /publicUrlForStoredAsset\(/, 'no permanent public address on the shop page');
  for (const call of [
    /resolveDisplayUrl\(vendor\.logo_url, ownShop\)/,
    /resolveServiceShowcaseMedia\(activeServices, ownShop\)/,
    /resolveServiceCoverUrls\(activeServices, ownShop\)/,
    /resolvePortfolioPhotos\([^;]*, ownShop\)/,
    /resolvePortfolioUrls\(\[cover\.heroKey\], ownShop\)/,
    /readShopWork\(admin, \{[^}]*own: ownShop \}\)/,
    /readShopFileServes\(trustedBy\.map\(\(v\) => v\.logoRef\)/,
  ]) {
    assert.match(page, call, String(call));
  }
});

test('the shop’s work albums follow the shop’s serve when the page passes it', () => {
  const work = code('lib/card-portfolio-albums.server.ts');
  assert.match(work, /args\.own\s*\?\s*ownShopFileUrl\(n\.page_ref, args\.own,/);
  assert.match(work, /args\.own \? ownShopFileUrl\(m\.r2_ref, args\.own,/);
});

test('a link preview (a stranger, a permanent address) never draws a Free shop’s logo', () => {
  const og = code('app/api/og/v/[slug]/route.tsx');
  assert.match(og, /ownShopServe\(vendor\.vendor_profile_id, vendor\.verification_state, \{ signedIn: false \}\)/);
  assert.match(og, /ownShopFileUrl\(vendor\.logo_url, own,/);
  // The share card's cover photo (shop share card v2) follows the same serve: withheld for a Free shop.
  assert.match(og, /readVendorCardFacts\(vendor, own\)/);
  const facts = code('lib/social/vendor-card-facts.server.ts');
  assert.match(facts, /if \(own\.serve === 'withheld'\) return null;/);
  assert.match(facts, /ownShopFileUrl\(key, own,/);
  assert.doesNotMatch(facts, /await displayUrlForStoredAsset\(key\)/);
});

test('the couple’s signed-in screens never hand out a Free shop’s permanent address', () => {
  const bench = code('lib/bench-service-cards.ts');
  assert.match(bench, /readShopFileServes\(photoRefs, \{ signedIn: true \}, admin\)/);
  assert.doesNotMatch(bench, /publicUrlForStoredAsset\(/, 'the public resolver is passed to the rule, never called bare');

  const sheet = code('lib/supplier-sheet-read.ts');
  assert.match(sheet, /ownShopServe\(vendorProfileId, profile\.verification_state, \{ signedIn: true \}\)/);
  assert.doesNotMatch(sheet, /publicUrlForStoredAsset\(/);

  const tab = code('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(tab, /readShopFileServes\(svcRows\.map\(\(r\) => r\.primary_photo_r2_key\), \{ signedIn: true \}\)/);
  assert.match(tab, /await shopFileUrl\(row\.primary_photo_r2_key, svcServes, publicUrlForStoredAsset\)/);
});
