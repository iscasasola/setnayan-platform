/**
 * a-shops-link-preview-never-breaks.test.ts — E1 (2026-09-11).
 *
 * Owner: "a universal representation of a vendor that they will be proud of
 * to share to the public." Before this route, a shop's og:image was a
 * presigned R2 URL that expired 24h after the share, or — for a shop with no
 * logo — nothing at all.
 *
 * `satori` cannot render in this local install (see `lib/social/profile-
 * card.tsx`'s own history — its visual is verified on the Vercel preview,
 * not locally), so this is the established pattern for this codebase's OG
 * cards: source-scan the route + the page's metadata wiring for the exact
 * gates and wiring that must be present, and unit-test the pure description
 * logic directly.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ROUTE = 'app/api/og/v/[slug]/route.tsx';
const PAGE = 'app/v/[slug]/page.tsx';

test('the route reuses fetchVendor from the page, not a second hand-rolled query', () => {
  const src = read(ROUTE);
  assert.match(
    src,
    /import\s*\{\s*fetchVendor\s*\}\s*from\s*'@\/app\/v\/\[slug\]\/page'/,
    'a duplicated query would silently fall out of sync with the page\'s own select + legacy fallback',
  );
  assert.doesNotMatch(
    src,
    /\.from\('vendor_profiles'\)/,
    'the route must not run its own vendor_profiles query',
  );
});

test('the route 302s to the brand card for a hidden, archived, or demo shop', () => {
  const src = read(ROUTE);
  assert.match(src, /isPubliclyVisible\(vendor\.public_visibility\)/, 'must reuse the page\'s own visibility check');
  assert.match(src, /vendor\.is_demo === true/, 'must reuse the page\'s own demo gate');
  assert.match(
    src,
    /Response\.redirect\(DEFAULT_OG, 302\)/,
    'a hidden/demo/missing shop must fall back to the static brand card, never render the real one',
  );
});

test('the route never leaks the hidden business_name — it uses the hybrid-anonymity resolver', () => {
  const src = read(ROUTE);
  assert.match(
    src,
    /resolveVendorDisplayName\(/,
    'the card\'s name must come from the SAME anonymity-respecting resolver the page title uses',
  );
  assert.doesNotMatch(
    src,
    /displayName:\s*vendor\.business_name/,
    'must never hand the raw business_name straight to the card',
  );
});

test('the logo is read through the public-bucket-only signer, never a raw ref', () => {
  const src = read(ROUTE);
  assert.match(
    src,
    /displayUrlForStoredAsset\(vendor\.logo_url\)/,
    'a logo ref naming a private bucket must be refused, not signed — displayUrlForStoredAsset ' +
      'routes through lib/site-media-ref.ts\'s publicBucketServeRef for exactly this reason',
  );
});

test('the card is served as image/png, and a render failure still returns a card', () => {
  const src = read(ROUTE);
  assert.match(src, /'Content-Type':\s*'image\/png'/, 'must serve PNG, per the DONE bar');
  assert.match(
    src,
    /catch\s*\{\s*\n?\s*return Response\.redirect\(DEFAULT_OG, 302\);/,
    'any thrown error (bad slug, render failure) must still resolve to a card, never a 500',
  );
});

test('the shop page points og:image, twitter:image and the structured-data image at the permanent route — never the raw expiring logo URL', () => {
  const src = read(PAGE);
  // vendorMetadataBySlug builds ONE permanent URL and feeds it to BOTH
  // openGraph.images and twitter.images (DRY, not three separate literals).
  assert.match(
    src,
    /const ogImageUrl = `\$\{siteUrl\}\/api\/og\/v\/\$\{vendor\.business_slug \?\? slug\}`;/,
    'vendorMetadataBySlug must build the permanent OG-card URL',
  );
  assert.match(src, /openGraph:\s*\{[\s\S]*?images:\s*\[ogImage\]/, 'openGraph.images must use the permanent card');
  assert.match(src, /twitter:\s*\{[\s\S]*?images:\s*\[ogImageUrl\]/, 'twitter.images must use the permanent card');
  // The LocalBusiness JSON-LD `image` field — a separate render function
  // (renderVendorBySlug), so it necessarily builds its own literal, but it
  // must point at the same route, not the raw presigned logo URL.
  assert.match(
    src,
    /image:\s*`\$\{SITE_URL\}\/api\/og\/v\/\$\{vendor\.business_slug \?\? slug\}`/,
    'the structured-data image must point at the permanent OG-card route',
  );
  // The old failure mode: a raw presigned URL (X-Amz-Expires) handed straight
  // to a social card. If this text ever reappears in the openGraph/twitter/
  // JSON-LD wiring, the 24h-breakage bug is back.
  assert.doesNotMatch(
    src,
    /images:\s*\[\s*\{\s*\n?\s*url:\s*logoDisplayUrl/,
    'openGraph.images must not be built straight from the raw (expiring) presigned logo URL again',
  );
  assert.doesNotMatch(
    src,
    /image:\s*logoDisplayUrl \?\?/,
    'the structured-data image must not fall back to the raw (expiring) presigned logo URL',
  );
});
