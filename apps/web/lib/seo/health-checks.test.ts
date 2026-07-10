/**
 * Unit tests for the SEO/GEO daily health checks. Pure-function coverage — the
 * cron just wires the live catalogs (platform_retail_catalog_v2 +
 * vendor_billing_catalog, both in pesos) + the served llms.txt into these.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  runSeoHealthChecks,
  pesoFigure,
  llmsBody,
  KNOWN_PUBLIC_ROUTES,
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
