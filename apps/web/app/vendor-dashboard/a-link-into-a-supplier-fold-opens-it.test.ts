/**
 * A LINK INTO A SUPPLIER FOLD OPENS IT — re-pointed 2026-10-14 (step 5) from
 * `shop/a-link-into-a-shop-panel-opens-it.test.ts` (AREA-VENDOR, 2026-09-19).
 *
 * The old guard held My Shop's four panels to one promise: a link into a panel
 * (`#gallery-media`, `#website`) lands on it OPEN, not on a fold shut to height 0
 * — Instagram's OAuth callback and Performance's "Add recent photos" had both
 * landed a supplier on a closed panel that held the very thing they came for.
 * The panels became Your details, Your page and Your collections; the promise is
 * the same, now kept by the shared `Fold`'s `anchor` (an address ending in
 * `#<anchor>` opens it, on arrival and on every hash change).
 *
 * Every door is checked from where it is DECLARED (the route, the constant, the
 * recommendation), so moving an anchor without its link turns this red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { buildGrowthRecs } from '@/lib/vendor-growth-recs';
import { PAYMENT_OPTIONS_HREF } from './_components/payout-method-nudge';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Which file holds the folds for each supplier screen. */
const SCREEN_FOLDS: Readonly<Record<string, string>> = {
  '/vendor-dashboard/profile': 'app/vendor-dashboard/profile/_components/details-screen.tsx',
  '/vendor-dashboard/website': 'app/vendor-dashboard/website/_components/page-parts.tsx',
  '/vendor-dashboard/collections': 'app/vendor-dashboard/collections/_components/collections-list.tsx',
};

/** `/vendor-dashboard/profile#docs` lands on a fold that carries `anchor="docs"`. */
function landsOnAFold(href: string): void {
  const [path, hash] = href.split('#');
  assert.ok(hash, `${href} carries no anchor`);
  const file = SCREEN_FOLDS[path!.split('?')[0]!];
  assert.ok(file, `${href} is not one of the supplier fold screens`);
  assert.match(src(file), new RegExp(`anchor="${hash}"`), `${href}: nothing on ${path} carries anchor="${hash}"`);
}

test('the shared Fold opens on its anchor — on arrival and on every hash change', () => {
  const fold = src('app/_components/fold.tsx');
  assert.match(fold, /window\.location\.hash !== `#\$\{anchor\}`/, 'the Fold never reads the address');
  assert.match(fold, /addEventListener\('hashchange'/, 'the Fold ignores a later hash change');
  assert.match(fold, /id=\{anchor\}/, 'the Fold does not carry its anchor as an id');
});

test('Instagram’s OAuth callback lands on Your collections › Add photos, open', () => {
  const route = src('app/api/vendor/instagram/callback/route.ts');
  const path = route.match(/SHOP_PATH\s*=\s*['"`]([^'"`]+)['"`]/)?.[1];
  const hash = route.match(/IG_SECTION_HASH\s*=\s*['"`]([^'"`]+)['"`]/)?.[1];
  assert.ok(path && hash, 'the callback’s landing is not declared');
  landsOnAFold(`${path}${hash}`);
  // …and that page reads the result the callback carries.
  assert.match(src('app/vendor-dashboard/collections/page.tsx'), /sp\.ig_connected/, 'the Instagram result is never shown');
});

test('"Add recent photos" goes to the gallery, open', () => {
  const rec = buildGrowthRecs(null).find((r) => r.key === 'add_photos');
  assert.ok(rec, 'no add_photos recommendation');
  landsOnAFold(rec.ctaHref);
});

/** A forwarding stub's target: `/vendor-dashboard/profile${query ? `?${query}` : ''}#<anchor>`. */
const REDIRECT_INTO_DETAILS = /\/vendor-dashboard\/profile\$\{query \? `\?\$\{query\}` : ''\}#(\w+)/;

test('every link the code writes into Your details lands on its fold', () => {
  landsOnAFold(PAYMENT_OPTIONS_HREF);
  for (const [file, re] of [
    ['app/vendor-dashboard/verify/page.tsx', REDIRECT_INTO_DETAILS],
    ['app/vendor-dashboard/payment-options/page.tsx', REDIRECT_INTO_DETAILS],
    ['app/vendor-dashboard/branches/page.tsx', REDIRECT_INTO_DETAILS],
    ['lib/vendor-first-steps.ts', /'\/vendor-dashboard\/profile#(\w+)'/],
    ['lib/verified-badge-sweep.ts', /'\/vendor-dashboard\/profile#(\w+)'/],
  ] as const) {
    const m = src(file).match(re);
    assert.ok(m, `${file} no longer links into Your details`);
    landsOnAFold(`/vendor-dashboard/profile#${m[1]}`);
  }
});

test('the rows that hand off to Your page land on their part', () => {
  const details = src('app/vendor-dashboard/profile/_components/details-screen.tsx');
  const shop = src('app/vendor-dashboard/shop/page.tsx');
  for (const s of [details, shop]) {
    for (const m of s.matchAll(/href="(\/vendor-dashboard\/(?:website|profile|collections)#[\w-]+)"/g)) landsOnAFold(m[1]!);
  }
});

test('Your page says "Couples can see it" only when couples can', () => {
  assert.match(src('app/vendor-dashboard/website/page-data.ts'), /const live = isShopLive\(/, 'live is not decided by isShopLive');
  assert.match(
    src('app/vendor-dashboard/website/_components/page-parts.tsx'),
    /\{d\.live \? 'Couples can see it' : 'Not shown yet'\}/,
    'the face prints its state regardless of what couples see',
  );
});
