/**
 * 🔒 DISCOVER'S SHOP CARD WEARS THE SHOP (owner 10 Nov, DECISION_LOG "DISCOVER'S SHOP CARD — APPROVED", prototype
 * `shop-card` v3). Before: the logo was stretched into the big tile and cropped by `.fd-thumb img`'s cover rule, the
 * circle always drew initials, `TAXONOMY_MAP` (the code constant) answered "Setnayan supplier" for any service it did
 * not know, and " · verified" was a word instead of the pill.
 *
 *   1. The big picture is the SHOP'S COVER — the one shared rule (`shopCoverKey`) through the hero's own reader.
 *   2. The circle wears the LOGO when there is one, shown whole; the logo is no longer in the tile.
 *   3. The category line comes from the LIVE taxonomy — never `TAXONOMY_MAP`.
 *   4. At most 2 pills, Verified first; an unread fact wears none. The badge stats are read once per table per shelf.
 *   5. The search hit draws THE shelf's card, not a copy.
 *   6. The event card's host circle shows a photo only under the consent rule.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { coverIsYourPagePick, shopCoverKey } from '@/lib/supplier-hero';
import { CARD_BADGE_CAP, cardBadges, shopBadges, type ShopBadgeFacts } from '@/lib/shop-badges';
import { hostPhotoRef, type DiscoverHost } from '@/lib/discover-events-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const src = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const DATA = src('app/_components/frontdoor/data.ts');
const FEED = src('app/_components/frontdoor/front-door-feed.tsx');
const RESULTS = src('app/_components/frontdoor/front-door-results.tsx');
const CSS = readFileSync(join(HERE, 'front-door.css'), 'utf8');
const SHOP_CARD = FEED.slice(FEED.indexOf('export function ShopCard('), FEED.indexOf('export function FrontDoorFeed'));

test('ShopCard is found where the guards expect it', () => {
  assert.ok(SHOP_CARD.length > 200, 'ShopCard moved — re-anchor this guard');
});

/* ── 1 · the cover ─────────────────────────────────────────────────────────────────────────────────────────────── */

test('the cover rule: Your page’s pick while it is on the portfolio, else the first photo, else none', () => {
  assert.equal(shopCoverKey(['a', 'b', 'c'], 'b'), 'b');
  assert.equal(shopCoverKey(['a', 'b'], 'gone'), 'a', 'a pick removed from the portfolio must not come back');
  assert.equal(shopCoverKey(['a', 'b'], null), 'a');
  assert.equal(shopCoverKey([], 'b'), null);
  assert.equal(shopCoverKey(null, null), null);
  assert.equal(coverIsYourPagePick(['a', 'b'], 'b'), true);
  assert.equal(coverIsYourPagePick(['a', 'b'], 'gone'), false);
});

test('the card’s picture comes from the shared cover rule, through the hero’s own reader', () => {
  assert.match(DATA, /heroPicture\(shopCoverKey\(/, 'data.ts must resolve the cover as heroPicture(shopCoverKey(…), services)');
  assert.doesNotMatch(DATA, /portfolio\[0\]|portfolio_r2_keys\)?\??\[0\]/, 'a second "first photo" rule in data.ts');
  assert.doesNotMatch(DATA, /heroPlaceholderUrl|displayUrlForCatalogueArt/, 'the placeholder chain is heroPicture’s, not a copy');
  // Shop's own hero asks the same function, so the two can never disagree.
  const shop = src('app/vendor-dashboard/shop/page.tsx');
  assert.match(shop, /shopCoverKey\(portfolio, own\?\.microsite_hero_photo_key\)/);
  assert.doesNotMatch(shop, /portfolio\.includes\(own\.microsite_hero_photo_key\)/, 'the inline rule is back on Shop');
  // The tile draws the cover, and says "Sample photo" for a placeholder.
  assert.match(SHOP_CARD, /<img src=\{s\.cover\.url\}/);
  assert.match(SHOP_CARD, /s\.cover\.sample \? <span className="fd-sample">Sample photo<\/span>/);
});

/* ── 2 · the logo ──────────────────────────────────────────────────────────────────────────────────────────────── */

test('the circle uses the logo when there is one — and the logo is not in the tile', () => {
  const tile = SHOP_CARD.slice(SHOP_CARD.indexOf('fd-thumb fd-thumb-shop'), SHOP_CARD.indexOf('fd-imeta'));
  assert.ok(tile.length > 0, 'tile not found');
  assert.doesNotMatch(tile, /logoUrl/, 'the logo is back in the big tile, where `.fd-thumb img` crops it');
  const meta = SHOP_CARD.slice(SHOP_CARD.indexOf('fd-imeta'));
  assert.match(
    meta,
    /s\.logoUrl \? \(\s*<span className="fd-ava fd-ava-logo"[^>]*>\s*(?:\{[^}]*\}\s*)?<img src=\{s\.logoUrl\}/,
    'the circle must draw the logo when there is one',
  );
  assert.match(meta, /initialsOf\(s\.name\)/, 'initials stay for a shop with no logo');
  // Shown WHOLE: contain, on the light ground — never `cover` on the logo.
  const rule = CSS.match(/\.fd-ava-logo img \{([^}]*)\}/);
  assert.ok(rule, '.fd-ava-logo img rule is gone');
  assert.match(rule![1]!, /object-fit:\s*contain/);
  assert.doesNotMatch(CSS, /\.fd-ava-logo img[^{]*\{[^}]*object-fit:\s*cover/, 'something crops the logo');
  assert.match(CSS, /\.fd-ava-logo \{[^}]*background:\s*var\(--fd-logo-ground\)/);
  // The ground has a dark value too (html.dark .fd).
  assert.equal((CSS.match(/--fd-logo-ground:/g) ?? []).length, 2, '--fd-logo-ground needs a light and a dark value');
});

/* ── 3 · the category line ─────────────────────────────────────────────────────────────────────────────────────── */

test('the category line never reads TAXONOMY_MAP — it reads the live taxonomy', () => {
  assert.doesNotMatch(DATA, /TAXONOMY_MAP|WEDDING_FOLDER_LABEL|from '@\/lib\/taxonomy'/, 'data.ts reads the code constant');
  assert.match(DATA, /getTaxonomy\(\)/);
  assert.doesNotMatch(DATA, /Setnayan supplier/, 'the stand-in word is back');
  assert.doesNotMatch(SHOP_CARD, /· verified/, 'the pill replaced the " · verified" text');
  assert.match(SHOP_CARD, /\[s\.folderLabel, s\.city\]\.filter\(Boolean\)\.join\(' · '\)/);
});

/* ── 4 · the pills ─────────────────────────────────────────────────────────────────────────────────────────────── */

const facts = (f: Partial<ShopBadgeFacts>): ShopBadgeFacts => ({
  verified: false,
  completedEvents: 0,
  trusted: { trusted_avg_rating: 0, trusted_review_count: 0 },
  inBusinessSinceYear: null,
  awards: [],
  nowYear: 2026,
  ...f,
});

test('at most 2 pills, Verified first, then the highest other in shopBadges order', () => {
  assert.equal(CARD_BADGE_CAP, 2);
  const all = facts({
    verified: true,
    completedEvents: 57,
    trusted: { trusted_avg_rating: 4.9, trusted_review_count: 32 },
    inBusinessSinceYear: 2019,
    awards: ['Most Booked'],
  });
  const pills = cardBadges(all);
  assert.equal(pills.length, 2);
  assert.equal(pills[0]!.key, 'verified');
  assert.equal(pills[1]!.key, shopBadges(all)[1]!.key, 'the second pill is shopBadges’ own next one');
  // Not verified → the highest other leads.
  assert.equal(cardBadges({ ...all, verified: false })[0]!.kind, 'milestone');
  // Years alone (Rondo, 2020).
  assert.deepEqual(cardBadges(facts({ inBusinessSinceYear: 2020 })).map((b) => b.line2), ['IN BUSINESS']);
  // Unread facts wear nothing — never a zero.
  assert.deepEqual(cardBadges(facts({ completedEvents: null, trusted: null })), []);
});

test('the card draws the pills with the shipped ShopBadgePill, read once per table per shelf', () => {
  assert.match(SHOP_CARD, /s\.badges\.map\(\(b\) => \(\s*<ShopBadgePill key=\{b\.key\} badge=\{b\} size="xs" ground="auto" \/>/);
  assert.match(DATA, /badges: cardBadges\(/);
  assert.match(DATA, /readShopBadgeFactsForShops\(/, 'the shelf must batch its badge reads');
  assert.doesNotMatch(DATA, /readShopBadgeFacts\(/, 'a per-shop badge read crept back into the shelf');
  // Verified is still the one predicate.
  assert.match(DATA, /hasVerifiedBadge\(\{/);
  // Batched: the reader asks each stats table with `.in(...)`, once.
  const server = src('lib/shop-badges.server.ts');
  const many = server.slice(server.indexOf('export async function readShopBadgeFactsForShops'), server.indexOf('export async function readUnreviewedCount'));
  for (const table of ['vendor_public_completed_events_stats', 'vendor_trusted_review_stats', 'vendor_spotlight_awards']) {
    assert.equal((many.match(new RegExp(`'${table}'`, 'g')) ?? []).length, 1, `${table} is read more than once`);
  }
  assert.equal((many.match(/\.in\('vendor_profile_id', ids\)/g) ?? []).length, 3);
  // The demo marker stays.
  assert.match(SHOP_CARD, /s\.isDemo \? <SampleMarker \/> : null/);
});

/* ── 5 · one card ──────────────────────────────────────────────────────────────────────────────────────────────── */

test('the search hit draws the shelf’s own card', () => {
  assert.match(
    RESULTS,
    /function ShopHitCard\(\{ s \}: \{ s: FrontDoorShop \}\) \{\s*return <ShopCard s=\{s\} href=\{withShopArrival\(s\.href, \{ src: SHOP_ARRIVAL_SRC\.search \}\)\} \/>;/,
  );
  assert.doesNotMatch(RESULTS, /fd-shoplogo|s\.folderLabel|s\.logoUrl/, 'a second shop card is drawn in the results');
});

/* ── 6 · the host circle ───────────────────────────────────────────────────────────────────────────────────────── */

test('the host circle wears a photo only on your own event or a public profile', () => {
  const hosts: DiscoverHost[] = [
    { userId: 'pub', name: 'Ana Reyes', publicSlug: 'ana', photoRef: 'r2://ana' },
    { userId: 'me', name: null, publicSlug: null, photoRef: 'r2://me' },
    { userId: 'priv', name: null, publicSlug: null, photoRef: null },
  ];
  assert.equal(hostPhotoRef({ host: { name: 'Ana Reyes', slug: 'ana' }, relation: 'connected' }, hosts, 'me'), 'r2://ana');
  assert.equal(hostPhotoRef({ host: null, relation: 'you' }, hosts, 'me'), 'r2://me');
  assert.equal(hostPhotoRef({ host: null, relation: null }, hosts, 'me'), null, 'a stranger’s event with no public host');
  assert.equal(hostPhotoRef({ host: null, relation: 'you' }, hosts, null), null, 'signed out is never “you”');

  const loader = src('lib/discover-events.ts');
  assert.match(
    loader,
    /photoRef: \(isPublic \|\| \(me !== null && u\.user_id === me\)\) && !u\.deleted_at \? \(u\.profile_photo_url \?\? null\) : null/,
    'readHosts must keep a private host’s photo ref off the card',
  );
  assert.match(loader, /renderableImageSrc\(await displayUrlForStoredAsset\(ref\)/, 'sign it the way People to follow does');
  const card = src('app/_components/frontdoor/discover-event-card.tsx');
  assert.match(card, /card\.hostPhotoUrl \? \(\s*<span className="fd-ava fd-ava-photo"[^>]*>\s*(?:\{[^}]*\}\s*)?<img src=\{card\.hostPhotoUrl\}/);
});
