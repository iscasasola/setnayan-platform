/**
 * ⚠🌐 THE UNVERIFIED SHOP FOLLOWS v16 S6 — ONE WEBSITE, ITS CONTENT LIMITED, ITS MARKINGS EVERYWHERE (owner 15 Nov,
 * DECISION_LOG "AN UNVERIFIED SHOP HAS THE SAME WEBSITE AS A VERIFIED ONE …": the verified layout; no blue check, no
 * Check a date, reviews collected but hidden with no rating, no exact address; "Not yet verified" markings throughout —
 * photo stamp, band under the name, every photo and service card, side card, dock line, footer — "each opening one
 * explain sheet"). The drawing: `prototypes/shop_website_two_looks_2026-11-15/site.src.html` § NOT VERIFIED.
 * One test per claim; each sabotage named above it turns it red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { WEB } from '@/lib/design-rules-scan';
import {
  NOT_VERIFIED_STAMP,
  NOT_YET_VERIFIED_EXPLAIN,
  NOT_YET_VERIFIED_SIDE_LIST,
  NOT_YET_VERIFIED_TAG,
  REVIEWS_HELD,
} from '@/lib/not-yet-verified-markings';

const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = src('app/v/[slug]/page.tsx');
const TAG = src('app/v/[slug]/_components/not-yet-verified-tag.tsx');
const SIDE = src('app/v/[slug]/_components/shop-side-card.tsx');
const GALLERY = src('app/v/[slug]/_components/services-gallery.tsx');
const QUOTE = src('app/v/[slug]/_components/shop-quote.tsx');
const PHOTOS = src('app/v/[slug]/_components/portfolio-photo-tiles.tsx');

// Sabotage: gate <ShopHero> or the columns on verification again → red.
test('one website: every shop wears the hero, the two columns and the side card', () => {
  assert.equal((PAGE.match(/<ShopHero\b/g) ?? []).length, 1);
  assert.doesNotMatch(PAGE, /\{\w+ \? \(\s*<ShopHero|\{\w+ \? <ShopHero|cinematicHero|SHOP_CALM_COLUMN_CLASS/);
  assert.match(PAGE, /data-shop-columns=""\s*className=\{SHOP_COLUMNS_CLASS\}/);
  assert.doesNotMatch(PAGE, /\{\w+ \? \(\s*<ShopSideCard/, 'the side card is gated again');
});

// Sabotage: show the blue check, a month, the rating chip, the map/directions/web address or the reviews unverified → red.
test('the content an unverified shop leaves out: blue check, Check a date, rating + reviews, exact address, web address', () => {
  assert.match(PAGE, /verified=\{vendor\.verification_state === 'verified'\}/, 'the top bar check is not verified-only');
  assert.match(PAGE, /month=\{isVerifiedShop \? thisMonth : null\}/);
  assert.match(PAGE, /verifiedLine=\{isVerifiedShop \? sideCardVerifiedLine\(/);
  assert.match(PAGE, /\{isVerifiedShop &&\s*viewerTierCaps\.reviewStarsCounted &&/, 'the rating chip shows for an unverified shop');
  assert.match(PAGE, /\{isVerifiedShop \? \(\s*<ReviewsSection\b/, 'the reviews show for an unverified shop');
  assert.match(PAGE, /data-shop-reviews-held=""[\s\S]{0,500}\{REVIEWS_HELD\.title\}[\s\S]{0,40}\{REVIEWS_HELD\.body\}/);
  for (const el of ['ShopReachMap', 'DirectionsMenu']) {
    assert.match(PAGE, new RegExp(`\\{isVerifiedShop \\? \\(\\s*<${el}\\b`), `${el} is drawn for an unverified shop`);
  }
  assert.match(PAGE, /\{isVerifiedShop \? <ShopAddresses /);
  assert.match(PAGE, /\{isVerifiedShop && bookable \? \(\s*<ShopCanDoPanel\b/);
  assert.equal(REVIEWS_HELD.title, 'Shown once Setnayan verifies this shop');
});

// Sabotage: a marking that is its own text/span instead of the shared tag, or a second sheet → red.
test('ONE tag, ONE sheet: every marking is `NotYetVerifiedTag`, which opens the shipped house Sheet with the drawing’s words', () => {
  assert.equal(NOT_YET_VERIFIED_TAG, 'Not yet verified');
  assert.equal(NOT_VERIFIED_STAMP, 'Not verified');
  assert.match(TAG, /import \{ Sheet \} from '@\/app\/_components\/sheet';/);
  assert.match(TAG, /<Sheet open onClose=\{\(\) => setOpen\(false\)\} labelledById=\{titleId\} title=\{NOT_YET_VERIFIED_EXPLAIN\.title\}>/);
  assert.match(TAG, /NOT_YET_VERIFIED_EXPLAIN\.points\.map/);
  assert.deepEqual(NOT_YET_VERIFIED_EXPLAIN.points.map((p) => p.head), ['What Setnayan checks', 'You can still book', 'Until then', 'Once verified']);
  assert.match(TAG, /text-warn-800/, 'the tag left the warn tokens');
  for (const [name, code] of [['page', PAGE], ['side card', SIDE], ['gallery', GALLERY], ['tray', QUOTE]] as const) {
    assert.doesNotMatch(code, />\s*Not yet verified\s*</, `${name} types the tag instead of using NotYetVerifiedTag`);
  }
});

// Sabotage: drop any one marking (hero, band, slot, services note, card stamp, photos note, About, side card, dock, footer) → red.
test('the markings, where the drawing puts them', () => {
  assert.match(PAGE, /marker=\{isVerifiedShop \? undefined : <NotYetVerifiedTag \/>\}/, 'the hero’s stamp');
  assert.match(PAGE, /data-shop-not-verified-band="">\s*<NotYetVerifiedNotice \/>/, 'the band under the name');
  assert.match(PAGE, /data-shop-not-verified-slot="">\s*<NotYetVerifiedTag pill=\{false\}/, 'the Awards slot opens the sheet');
  assert.match(PAGE, /notVerified=\{!isVerifiedShop\}/, 'the services are not told');
  assert.match(PAGE, /\{notVerified \? \(\s*<NotYetVerifiedTag className="-mt-2">\{NOT_YET_VERIFIED_SERVICES_NOTE\}<\/NotYetVerifiedTag>/, 'the services note');
  assert.match(GALLERY, /\{notVerified \? <NotYetVerifiedTag label=\{NOT_VERIFIED_STAMP\} \/> : null\}/, 'every service card’s stamp');
  assert.match(PAGE, /notVerified=\{!isVerifiedShop\}\s*\/>\s*\{featuredVideos/, 'the photos are not stamped');
  assert.match(PHOTOS, /\{notVerified \? \(\s*<em[^>]*data-photo-not-verified="">\s*\{NOT_VERIFIED_STAMP\}/, 'every photo’s stamp');
  assert.match(PAGE, /\{isVerifiedShop \? null : \(\s*<NotYetVerifiedTag>\{NOT_YET_VERIFIED_PHOTOS_NOTE\}<\/NotYetVerifiedTag>/, 'the photos note');
  assert.match(PAGE, /data-shop-what-verified-adds=""/, 'What Verified adds');
  assert.match(SIDE, /data-side-card-not-verified="">\s*<NotYetVerifiedTag \/>[\s\S]{0,200}NOT_YET_VERIFIED_SIDE_LIST\.map/, 'the side card');
  assert.match(QUOTE, /data-quote-tray-not-verified="">\s*<NotYetVerifiedTag>\{NOT_YET_VERIFIED_SIDE_LIST\[0\]\}<\/NotYetVerifiedTag>/, 'the dock line');
  assert.match(PAGE, /data-shop-footer-not-verified="">\s*<NotYetVerifiedTag \/>/, 'the footer');
  assert.deepEqual([...NOT_YET_VERIFIED_SIDE_LIST], ['Papers not checked by Setnayan', 'No reviews shown until verified', 'Book and pay through Setnayan']);
});

// Sabotage: index an unverified shop, or let Where print the street → red.
test('still hidden from search, and Where is the city alone', () => {
  assert.match(PAGE, /\.\.\.\(notYetVerified \? \{ robots: \{ index: false, follow: false \} \} : \{\}\)/);
  assert.match(PAGE, /const where = shopWhere\([\s\S]*?isVerifiedShop,\s*\);/);
});
