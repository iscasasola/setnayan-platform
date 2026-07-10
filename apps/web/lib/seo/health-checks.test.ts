/**
 * Unit tests for the SEO/GEO daily health checks. Pure-function coverage — the
 * cron just wires the live catalog + served llms.txt into these.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  runSeoHealthChecks,
  formatPeso,
  llmsBody,
  KNOWN_PUBLIC_ROUTES,
  type CatalogRow,
} from './health-checks';

function sku(over: Partial<CatalogRow> & { sku_code: string; price_centavos: number }): CatalogRow {
  return {
    display_name: over.sku_code,
    is_active: true,
    purchaser_role: 'couple',
    ...over,
  };
}

test('formatPeso renders centavos as a comma-grouped peso figure', () => {
  assert.equal(formatPeso(0), '₱0');
  assert.equal(formatPeso(49900), '₱499');
  assert.equal(formatPeso(129900), '₱1,299');
  assert.equal(formatPeso(7499900), '₱74,999');
});

test('llmsBody strips the changelog footer', () => {
  const raw = 'body ₱499 here\nThis file was last refreshed on 2026-01-01 — old ₱3,999.';
  const body = llmsBody(raw);
  assert.ok(body.includes('₱499'));
  assert.ok(!body.includes('₱3,999'));
});

test('a fully-consistent surface reports no missing prices and passes coverage', () => {
  const llmsText = 'Setnayan AI ₱799. Cinematic Reveal ₱1,499.';
  const catalog = [
    sku({ sku_code: 'setnayan_ai', price_centavos: 79900 }),
    sku({ sku_code: 'cinematic_reveal', price_centavos: 149900 }),
    // free SKU renders as prose, never as a ₱-figure → not required in copy
    sku({ sku_code: 'custom_qr', price_centavos: 0 }),
    // retired SKU must NOT be required in the copy
    sku({ sku_code: 'old_sde', price_centavos: 349900, is_active: false }),
  ];
  const res = runSeoHealthChecks({ llmsText, catalog, env: {} });
  assert.equal(res.priceDrift.filter((d) => d.kind === 'missing').length, 0);
  assert.ok(
    res.findings.some((f) => f.check === 'llms.txt price coverage' && f.status === 'ok'),
  );
});

test('a repriced SKU whose new price is absent from llms.txt is flagged missing', () => {
  const llms = 'Live Studio Desktop ₱2,499 per day.'; // copy still shows old figure
  const catalog = [sku({ sku_code: 'live_studio_desktop', price_centavos: 299900 })]; // repriced to ₱2,999
  const res = runSeoHealthChecks({ llmsText: llms, catalog, env: {} });
  const missing = res.priceDrift.filter((d) => d.kind === 'missing');
  assert.equal(missing.length, 1);
  assert.equal(missing[0]?.figure, '₱2,999');
  assert.ok(res.findings.some((f) => f.check === 'llms.txt price coverage' && f.status === 'fail'));
  assert.equal(res.counts.fail >= 1, true);
});

test('an orphan figure in llms.txt (no active SKU) is a warn, not a fail', () => {
  const llms = 'Setnayan AI ₱799. A retired thing was ₱9,876 once.';
  const catalog = [sku({ sku_code: 'setnayan_ai', price_centavos: 79900 })];
  const res = runSeoHealthChecks({ llmsText: llms, catalog, env: {} });
  const orphan = res.priceDrift.filter((d) => d.kind === 'orphan');
  assert.ok(orphan.some((d) => d.figure === '₱9,876'));
  assert.ok(res.findings.some((f) => f.check === 'llms.txt orphan figures' && f.status === 'warn'));
});

test('a link to an unknown route is flagged as a possible dead route', () => {
  const llms =
    'Browse at https://www.setnayan.com/explore and the ghost https://www.setnayan.com/venues here.';
  const catalog: CatalogRow[] = [];
  const res = runSeoHealthChecks({ llmsText: llms, catalog, env: {} });
  const routeCheck = res.findings.find((f) => f.check === 'llms.txt route validity');
  assert.equal(routeCheck?.status, 'fail');
  assert.ok(routeCheck?.detail.includes('/venues'));
  // a concrete vendor slug collapses to the '/v/' anchor and stays valid
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
