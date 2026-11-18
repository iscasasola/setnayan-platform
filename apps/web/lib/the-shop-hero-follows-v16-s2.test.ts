/**
 * 🖼 THE VERIFIED SHOP'S HERO FOLLOWS v16 — SLICE S2 (owner-approved 15 Nov 2026; drawing
 * `prototypes/shop_website_two_looks_2026-11-15/site.src.html` `.hero .slides/.dots/.hall/.bento` and `#lb`).
 * One test per claim; each was sabotaged to red.
 *
 * Run: npx tsx --test lib/the-shop-hero-follows-v16-s2.test.ts   (from apps/web)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { WEB } from '@/lib/design-rules-scan';
import { HERO_PHOTO_COUNT } from '@/lib/shop-hero-photos';

const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PAGE = src('app/v/[slug]/page.tsx');
const HERO = src('app/v/[slug]/_components/shop-hero.tsx');
const GAL = src('app/v/[slug]/_components/shop-hero-gallery.tsx');

// Sabotage: slice the photos to 6 / drop the scroll-snap / stop the dots following the swipe → red.
test('phone: the first five photos are swipeable slides, with dots that follow the swipe', () => {
  assert.equal(HERO_PHOTO_COUNT, 5, 'the drawing draws `ph.slice(0,5)`');
  assert.match(GAL, /const lead = photos\.slice\(0, HERO_PHOTO_COUNT\);/);
  assert.match(GAL, /data-shop-hero-slides=""[\s\S]{0,200}snap-x snap-mandatory overflow-x-auto/);
  assert.match(GAL, /setDot\(Math\.round\(el\.scrollLeft \/ el\.clientWidth\)\)/);
  assert.match(GAL, /i === dot \? 'bg-page' : 'bg-page\/35'/);
  assert.doesNotMatch(GAL, /setInterval|setTimeout/, 'a hero photo moves by itself (photos never move on a clock)');
});

// Sabotage: type a number into the pill / show it with one photo → red.
test('"All N photos" counts the real photos, and opens the viewer at the first', () => {
  assert.match(GAL, /const allLabel = `All \$\{formatCount\(total\)\} photos`;/);
  assert.match(GAL, /const total = photos\.length;/);
  assert.equal((GAL.match(/onClick=\{\(\) => show\(0\)\}[\s\S]{0,300}data-shop-hero-all=""/g) ?? []).length, 2, 'one pill per layout');
  assert.match(PAGE, /gallery=\{\s*heroGalleryPhotos\.length >= 2 \? \(/, 'the gallery draws with one photo');
});

// Sabotage: draw the mosaic with 3 photos / drop a photo button / leave the copy on the photo at lg → red.
test('desktop: a full five make the mosaic, each a button, with the name below on the page’s ground', () => {
  assert.match(PAGE, /bento=\{heroGalleryPhotos\.length >= HERO_PHOTO_COUNT\}/);
  assert.match(GAL, /grid-cols-\[2fr_1fr_1fr\] grid-rows-\[230px_230px\]/);
  assert.match(GAL, /\{lead\.map\(\(p, i\) => \(\s*<button[\s\S]{0,120}onClick=\{\(\) => show\(i\)\}/);
  assert.match(HERO, /const mosaic = !!gallery && bento && !sample;/);
  assert.match(HERO, /mosaic \? 'lg:h-auto lg:overflow-visible lg:bg-page lg:text-ink'/);
  assert.match(HERO, /mosaic \? 'sm:px-8 lg:static/);
});

// Sabotage: import the viewer statically / draw a home-made lightbox / pass a toolbar → red.
test('a tap opens the SHARED photo viewer (✕ top left, "N of M · shop", ‹ ›, swipe, Esc), fetched only on the tap', () => {
  assert.match(GAL, /dynamic\(\(\) => import\('@\/app\/_components\/gallery\/photo-viewer'\)\.then\(\(m\) => m\.PhotoViewer\)/);
  assert.doesNotMatch(GAL, /^import[^;]*gallery\/(photo-viewer|gallery-lightbox)/m, 'the viewer is in the page’s first load');
  assert.match(GAL, /<LazyPhotoViewer[\s\S]{0,300}at=\{at\}\s*total=\{total\}\s*album=\{shopName\}\s*onMove=\{show\}/);
  assert.doesNotMatch(GAL, /role="dialog"|createPortal/, 'a second, home-made lightbox');
});

// Sabotage: count without the `count` gate / use another door → red.
test('each photo shown is one view, through the portfolio’s ONE door, never for the shop’s own previews', () => {
  assert.match(GAL, /if \(count && p\) void recordVendorProfileView\(\{ vendorProfileId, photoKey: p\.key \}\);/);
  assert.match(PAGE, /count=\{!isDemoVendor && teamPreview === null\}\s*bento=/);
});

// Sabotage: put the chosen hero photo anywhere but first / show photos the shop hid → red.
test('the photos are the shop’s own portfolio, its chosen hero first, and none when it hides the portfolio', () => {
  assert.match(PAGE, /const heroGalleryPhotos = showPortfolio\s*\?/);
  assert.match(PAGE, /return lead \? \[lead, \.\.\.portfolioPhotos\.filter\(\(p\) => p !== lead\)\] : \[\.\.\.portfolioPhotos\];/);
  assert.match(PAGE, /portfolioPhotos\.find\(\(p\) => p\.key === microsite\.heroPhotoKey\)/);
});

// Sabotage: a raw hex or rgba in the gallery / a plain <img> or next/image for a supplier photo → red.
test('the mark is never cropped off and every colour is a token', () => {
  const marked = (GAL.match(/<MarkedPhoto /g) ?? []).length;
  assert.equal(marked, 2, 'every hero photo display is a MarkedPhoto (slides + mosaic)');
  assert.doesNotMatch(GAL, /<img\b|from 'next\/image'/);
  assert.doesNotMatch(GAL, /#[0-9a-fA-F]{3,8}\b|rgba?\(/);
});

// Sabotage: render the gallery for the sample frame / drop the single-photo fallback → red.
test('without a gallery (one photo, the sample frame) the hero is exactly as before', () => {
  assert.match(HERO, /\{gallery \?\? \(\s*<div className=\{`absolute inset-x-0 -bottom-\[6%\] -top-\[6%\] -z-20 \$\{m\.heroDrift\}`\}>/);
  assert.match(HERO, /sample \? '' : mosaic \? .* : 'lg:h-\[640px\]'/);
});
