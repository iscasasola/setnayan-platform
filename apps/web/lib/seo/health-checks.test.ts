/**
 * Unit tests for the SEO/GEO daily health checks. Pure-function coverage — the
 * cron just wires the live catalogs (platform_retail_catalog_v2 +
 * vendor_billing_catalog, both in pesos) + the served llms.txt into these.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { skuBackedLiterals } from '@/lib/public-price-literals';

import {
  runSeoHealthChecks,
  pesoFigure,
  llmsBody,
  KNOWN_PUBLIC_ROUTES,
  MUST_BE_IN_SITEMAP,
  bookingFeeFigures,
  type CatalogRow,
} from './health-checks';

const retail = (sku_code: string, price_php: number): CatalogRow => ({
  sku_code,
  price_php,
  source: 'retail',
});
const vendor = (sku_code: string, price_php: number): CatalogRow => ({
  sku_code,
  price_php,
  source: 'vendor',
});

test('pesoFigure renders a PHP amount as a comma-grouped peso figure', () => {
  assert.equal(pesoFigure(0), '₱0');
  assert.equal(pesoFigure(499), '₱499');
  assert.equal(pesoFigure(1299), '₱1,299');
  assert.equal(pesoFigure(74999), '₱74,999');
});

test('llmsBody strips the changelog footer', () => {
  const raw = 'body ₱499 here\nThis file was last refreshed on 2026-01-01 — old ₱3,999.';
  const body = llmsBody(raw);
  assert.ok(body.includes('₱499'));
  assert.ok(!body.includes('₱3,999'));
});

test('a fully-consistent surface reports no missing prices and passes coverage', () => {
  const llmsText = 'Setnayan AI ₱799. Patiktok ₱1,499. Pro vendor ₱24,999.';
  const catalog = [
    retail('SETNAYAN_AI', 799),
    retail('PATIKTOK_COMPILER', 1499),
    retail('CUSTOM_QR', 0), // free SKU renders as prose, never as a ₱-figure
    vendor('pro_vendor_annual', 24999), // vendor figure IS quoted → not orphan
  ];
  const res = runSeoHealthChecks({ llmsText, catalog, env: {} });
  assert.equal(res.priceDrift.filter((d) => d.kind === 'missing').length, 0);
  assert.equal(res.priceDrift.filter((d) => d.kind === 'orphan').length, 0);
  assert.ok(res.findings.some((f) => f.check === 'llms.txt price coverage' && f.status === 'ok'));
});

test('a repriced RETAIL SKU whose new price is absent from llms.txt is flagged missing', () => {
  const llmsText = 'Live Studio Desktop ₱2,499 per day.'; // copy still shows old figure
  const catalog = [retail('PANOOD_SYSTEM', 2999)]; // repriced to ₱2,999
  const res = runSeoHealthChecks({ llmsText, catalog, env: {} });
  const missing = res.priceDrift.filter((d) => d.kind === 'missing');
  assert.equal(missing.length, 1);
  assert.equal(missing[0]?.figure, '₱2,999');
  assert.ok(res.findings.some((f) => f.check === 'llms.txt price coverage' && f.status === 'fail'));
  assert.ok(res.counts.fail >= 1);
});

test('a VENDOR micro-SKU absent from llms.txt is NOT flagged missing (copy omits it by design)', () => {
  const llmsText = 'Setnayan AI ₱799.';
  const catalog = [
    retail('SETNAYAN_AI', 799),
    vendor('vendor_extra_seat', 250), // micro-SKU, not quoted in llms — must NOT fail
    vendor('vendor_custom_base', 8999), // custom-plan component — must NOT fail
  ];
  const res = runSeoHealthChecks({ llmsText, catalog, env: {} });
  assert.equal(res.priceDrift.filter((d) => d.kind === 'missing').length, 0);
});

test('an orphan figure in llms.txt (no active SKU, retail or vendor) is a warn, not a fail', () => {
  const llmsText = 'Setnayan AI ₱799. Papic Ltd caps at ₱15,000/day. A retired thing was ₱9,876.';
  const catalog = [retail('SETNAYAN_AI', 799)];
  const res = runSeoHealthChecks({ llmsText, catalog, env: {} });
  const orphan = res.priceDrift.filter((d) => d.kind === 'orphan');
  assert.ok(orphan.some((d) => d.figure === '₱9,876'));
  assert.ok(orphan.some((d) => d.figure === '₱15,000')); // legit cap, still surfaced as a warn
  assert.ok(res.findings.some((f) => f.check === 'llms.txt orphan figures' && f.status === 'warn'));
});

test('a link to an unknown route is flagged as a possible dead route', () => {
  const llmsText =
    'Browse at https://www.setnayan.com/explore and the ghost https://www.setnayan.com/venues here.';
  const res = runSeoHealthChecks({ llmsText, catalog: [], env: {} });
  const routeCheck = res.findings.find((f) => f.check === 'llms.txt route validity');
  assert.equal(routeCheck?.status, 'fail');
  assert.ok(routeCheck?.detail.includes('/venues'));
  assert.ok(KNOWN_PUBLIC_ROUTES.has('/v/'));
});

test('missing verification tokens and empty sameAs are owner-action warns', () => {
  const res = runSeoHealthChecks({ llmsText: '', catalog: [], env: {} });
  assert.ok(res.findings.some((f) => f.check === 'verification tokens' && f.status === 'warn'));
  assert.ok(res.findings.some((f) => f.check === 'Organization.sameAs' && f.status === 'warn'));

  const configured = runSeoHealthChecks({
    llmsText: '',
    catalog: [],
    env: {
      googleSiteVerification: 'g-token',
      bingSiteVerification: 'b-token',
      orgSameAs: ['https://facebook.com/setnayan'],
    },
  });
  assert.ok(configured.findings.some((f) => f.check === 'verification tokens' && f.status === 'ok'));
  assert.ok(configured.findings.some((f) => f.check === 'Organization.sameAs' && f.status === 'ok'));
});

test('Google DNS-TXT verification counts as configured without the env var', () => {
  const res = runSeoHealthChecks({
    llmsText: '',
    catalog: [],
    env: { googleDnsTxtVerified: true, bingSiteVerification: 'b-token' },
  });
  const finding = res.findings.find((f) => f.check === 'verification tokens');
  assert.equal(finding?.status, 'ok');
  assert.ok(finding?.detail.includes('DNS-TXT'));
});

// ── Check 5 · hardcoded public price literals ──────────────────────────────
// This is the runtime half of the two-part guard around peso figures typed into
// marketing source. CI (lib/public-price-literals.test.ts) can only prove a
// literal is DECLARED; only this check, which sees the live catalog, can prove
// it is still TRUE. The negative case matters most — a check nobody has watched
// fail is decorative, which is precisely how llms.txt drifted for three weeks.

test('a declared literal that no longer matches its SKU FAILS, naming file + SKU', () => {
  // The inventory holds no SKU-backed figure since 2026-11-04 (the demo's two were deleted, not re-typed), so the
  // check is fed a planted one — a check nobody has watched fail is decorative.
  const literals = [
    { file: 'app/_components/app-store/studio-card-demo.tsx', literal: '₱500', sku: 'COUPLE_HUB_PART_LOGO_QR', reason: 'planted' },
  ];
  const catalog: CatalogRow[] = [{ sku_code: 'COUPLE_HUB_PART_LOGO_QR', price_php: 1750, source: 'retail' }];

  const res = runSeoHealthChecks({ llmsText: '', catalog, env: {}, literals });
  const check = res.findings.find((f) => f.check === 'hardcoded public price literals');

  assert.equal(check?.status, 'fail');
  assert.ok(check?.detail.includes('COUPLE_HUB_PART_LOGO_QR'), 'must name the drifted SKU');
  assert.ok(check?.detail.includes('studio-card-demo'), 'must name the file to edit');
  assert.ok(check?.detail.includes('₱1,750'), 'must state the real catalog price');
});

test('literals that match the catalog pass', () => {
  const catalog: CatalogRow[] = skuBackedLiterals().map((l) => ({
    sku_code: l.sku,
    price_php: Number(l.literal.replace(/[₱,]/g, '')),
    source: 'retail',
  }));
  const res = runSeoHealthChecks({ llmsText: '', catalog, env: {} });
  assert.equal(
    res.findings.find((f) => f.check === 'hardcoded public price literals')?.status,
    'ok',
  );
});

test('a SKU absent from the catalog is Check-1 territory, not a literal failure', () => {
  // Empty catalog ⇒ nothing to compare against. The literal check must stay
  // quiet rather than report every declared figure as drifted.
  const res = runSeoHealthChecks({ llmsText: '', catalog: [], env: {} });
  assert.equal(
    res.findings.find((f) => f.check === 'hardcoded public price literals')?.status,
    'ok',
  );
});

// ── Build 6 Lane K · the checks that keep answer engines on today's product ──

// SABOTAGE: drop `row.advertised !== false` from the retail loop → RED.
test('an on-sale but UNLISTED retail SKU is never reported missing (Patiktok is unlisted on purpose)', () => {
  const catalog: CatalogRow[] = [{ sku_code: 'PATIKTOK_COMPILER', price_php: 2490, source: 'retail', advertised: false }];
  const res = runSeoHealthChecks({ llmsText: 'Nothing about it here.', catalog, env: {} });
  assert.equal(res.priceDrift.filter((d) => d.kind === 'missing').length, 0);
});

// SABOTAGE: stop adding `nonSkuFigures` / ₱0 to the allowance → RED. Measured in prod 2026-11-10: "orphan ₱100,000,
// ₱50, ₱0" every day — the booking-fee band, its minimum, and "Free — ₱0".
test('the booking-fee figures and ₱0 are true figures, not orphans', () => {
  const llmsText = 'Free — ₱0. A booking fee of 5% of the first ₱100,000, then 1%, minimum ₱50.';
  const res = runSeoHealthChecks({
    llmsText,
    catalog: [],
    env: {},
    nonSkuFigures: bookingFeeFigures({ tier1LimitPhp: 100_000, minPhp: 50 }),
  });
  assert.deepEqual(res.priceDrift, []);
  assert.deepEqual(bookingFeeFigures(null), []);
});

// SABOTAGE: delete Check 6 → RED.
test('a served llms.txt that lost a saved AI answer FAILS, naming the question', () => {
  const res = runSeoHealthChecks({
    llmsText: '**Is there an app?** Yes.',
    catalog: [],
    env: {},
    requiredQuestions: ['Is there an app?', 'Do you take a commission?'],
  });
  const f = res.findings.find((x) => x.check === 'llms.txt answers what AI gets wrong');
  assert.equal(f?.status, 'fail');
  assert.ok(f?.detail.includes('Do you take a commission?'));
  assert.ok(!f?.detail.includes('Is there an app?'));
});

// SABOTAGE: delete Check 7 → RED.
test('a retired plan or product name in the served file FAILS (Enterprise · Event Hub Pro · tokens)', () => {
  for (const text of ['Upgrade to Enterprise.', 'Buy the Pro Event Hub.', 'Top up your token wallet.']) {
    const res = runSeoHealthChecks({ llmsText: text, catalog: [], env: {} });
    assert.equal(res.findings.find((x) => x.check === 'llms.txt retired names')?.status, 'fail', text);
  }
  const clean = runSeoHealthChecks({ llmsText: 'Free · Verified · Solo · Pro · Ultra.', catalog: [], env: {} });
  assert.equal(clean.findings.find((x) => x.check === 'llms.txt retired names')?.status, 'ok');
});

// SABOTAGE: delete Check 8, or drop '/for-coordinators' from MUST_BE_IN_SITEMAP → RED.
test('a front page missing from the served sitemap FAILS; an unread sitemap skips the check', () => {
  const some = MUST_BE_IN_SITEMAP.filter((p) => p !== '/for-coordinators');
  const res = runSeoHealthChecks({ llmsText: '', catalog: [], env: {}, sitemapPaths: some });
  const f = res.findings.find((x) => x.check === 'sitemap coverage');
  assert.equal(f?.status, 'fail');
  assert.ok(f?.detail.includes('/for-coordinators'));
  const all = runSeoHealthChecks({ llmsText: '', catalog: [], env: {}, sitemapPaths: [...MUST_BE_IN_SITEMAP] });
  assert.equal(all.findings.find((x) => x.check === 'sitemap coverage')?.status, 'ok');
  const skipped = runSeoHealthChecks({ llmsText: '', catalog: [], env: {} });
  assert.equal(skipped.findings.find((x) => x.check === 'sitemap coverage'), undefined);
});

test('the coordinator front page is a known public route', () => {
  assert.ok(KNOWN_PUBLIC_ROUTES.has('/for-coordinators'));
});
