/**
 * no-typed-live-numbers.test.ts — the 2026-10-02 prototype value-leak sweep,
 * pinned so none of it grows back.
 *
 * Source: Setnayan/PROTOTYPE_VALUE_LEAKS_2026-10-02.md. The leaks were not
 * copied sentences; they were typed SNAPSHOTS and pre-filled DEFAULTS — a tile
 * that read "34 changes · 52%" as if live, a form pre-filled with ₱15,000, a
 * fallback price that rendered whenever a catalogue read came back empty.
 *
 * Peso literals in the dashboards are already held by
 * `public-price-literals.test.ts`; this file holds the SHAPES that guard cannot
 * see (a typed percentage, a defaultValue, a `?? 1000` fallback).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = process.cwd();
const code = (rel: string) =>
  readFileSync(join(WEB, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

test('the manpower cash amount starts EMPTY and a blank is refused, not defaulted', () => {
  const drawer = code('app/dashboard/[eventId]/manpower/_components/post-gig-drawer.tsx');
  assert.ok(!/defaultValue=/.test(drawer), 'the gig form pre-fills a value');
  assert.match(drawer, /name="cash_amount_php"[\s\S]*?required/);
  const action = code('app/vendor-dashboard/manpower/actions.ts');
  assert.ok(!/1_?500_?000/.test(action), 'a blank amount is stored as a typed default again');
  assert.match(action, /Enter the cash amount/);
});

test('no manpower note types the gig amount', () => {
  for (const f of [
    'app/dashboard/[eventId]/manpower/page.tsx',
    'app/vendor-dashboard/manpower/surface.tsx',
  ]) {
    assert.ok(!/₱\s*15,?000/.test(code(f)), `${f} types the gig amount`);
  }
});

test('the DSLR row prices from the catalogue and only while the row is active', () => {
  const page = code('app/dashboard/[eventId]/studio/papic/page.tsx');
  assert.match(page, /service_code', 'CAMERA_BRIDGE'/);
  assert.match(page, /cameraBridgeRow\?\.is_active/);
  assert.match(page, /pricePhp: number \| null/);
});

test('the seat-limit message reads the live seat fee', () => {
  const src = code('app/vendor-dashboard/team/actions.ts');
  assert.ok(!/Add a seat \(₱/.test(src), 'the seat fee is typed in the message');
  assert.match(src, /Add a seat \(\$\{formatPhp\(await fetchSeatFeePhp\(supabase\)\)\}/);
});

test('the onboarding promo label is rendered from the one constant', () => {
  const shell = code('app/onboarding/wedding/_components/onboarding-shell.tsx');
  assert.ok(!/const ONBOARDING_PROMO\b/.test(shell), 'the shell holds its own promo constant');
  assert.ok(!/−\s*\d+%\s*onboarding promo/.test(shell), 'the promo label types its own percentage');
  assert.match(shell, /Math\.round\(pricing\.promo \* 100\)/);
  const pricing = code('app/onboarding/wedding/_components/onboarding-pricing.ts');
  assert.equal((pricing.match(/const ONBOARDING_PROMO\b/g) ?? []).length, 1);
});

test('supplier tier prices have NO typed fallback — unreadable is null', () => {
  const src = code('lib/v2-catalog.ts');
  const start = src.indexOf('export const getVendorPrices');
  const body = src.slice(start, src.indexOf('export const getCustomerSkuPrice'));
  assert.ok(start > 0 && body.length > 200, 'could not locate getVendorPrices');
  assert.ok(!/₱\s*\d/.test(body), 'getVendorPrices types a peso figure');
  assert.ok(!/\?\?\s*\d{3,}/.test(body), 'getVendorPrices falls back to a typed number');
  assert.ok(!/fmt\([^)]*,\s*'/.test(body), 'fmt() takes a typed fallback string again');
});

test('the admin tiles count the audit log — and never print a typed number', () => {
  const tile = code('app/admin/_components/what-you-change.tsx');
  assert.ok(!/\b\d+\s+changes?\b/.test(tile), 'a tile types a change count');
  const lib = code('lib/admin/what-you-change.ts');
  assert.match(lib, /from\('admin_audit_log'\)/);
});
