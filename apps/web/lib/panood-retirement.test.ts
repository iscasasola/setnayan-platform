/**
 * ⭐ THE CAST RETIREMENT — closing the ₱500 grandfather-alias arbitrage
 * (owner-directed 2026-07-26 · migration 20271005100000_retire_panood_system_cast.sql).
 *
 * THE HOLE. Wave 6 added `SKU_OWNERSHIP_ALIASES.LIVE_STUDIO = [PANOOD_SYSTEM,
 * PANOOD_SYSTEM_MOBILE]` so an existing Cast buyer keeps what they bought when the
 * unified controller lands. That alias is a READ rule — it does not care whether the
 * order that trips it is historical or placed thirty seconds ago. So while
 * PANOOD_SYSTEM stayed sellable at ₱2,500, ANY new buyer collected the ₱2,999 unified
 * Live Studio entitlement through it. ₱500 off, available to everyone, with no code
 * path anywhere that noticed.
 *
 * THE FIX is one catalog flag, and these tests hold the three things that make it work:
 *
 *   1. THE MONEY  — the SKU is retired in the catalog, and checkout refuses a retired
 *                   SKU BEFORE any charge resolver runs.
 *   2. NO FAKE DOOR — the surface that sold it hides its BUY control when the SKU is
 *                   not sellable, while still letting an existing owner into the room.
 *   3. THE ALIAS SURVIVES — retirement must not strand a historical buyer or a comped
 *                   grant. Ownership reads `orders` and comp grants, never the catalog.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';

import { SKU_OWNERSHIP_ALIASES, eventSkuActive } from './entitlements';
import { PANOOD_PAID_SKUS } from './panood-watermark';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(HERE, rel), 'utf8');
const MIGRATIONS = resolve(HERE, '../../../supabase/migrations');

/* ── 1 · THE MONEY ──────────────────────────────────────────────────────────── */

test('a migration retires PANOOD_SYSTEM in the retail catalog', () => {
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'));
  const hits = files.filter((f) => {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    return /UPDATE\s+public\.platform_retail_catalog_v2[\s\S]*?SET\s+is_active\s*=\s*FALSE[\s\S]*?WHERE\s+service_code\s*=\s*'PANOOD_SYSTEM'/i.test(
      sql,
    );
  });
  assert.ok(
    hits.length > 0,
    'no migration flips PANOOD_SYSTEM is_active=FALSE — the ₱500 alias arbitrage is still open',
  );
});

test('the retirement PRESERVES the row (never DELETE) — order rows reference service codes', () => {
  const files = readdirSync(MIGRATIONS).filter((f) => f.includes('retire_panood_system'));
  assert.equal(files.length, 1, 'exactly one Cast-retirement migration');
  const sql = readFileSync(join(MIGRATIONS, files[0]!), 'utf8');
  assert.ok(
    !/DELETE\s+FROM\s+public\.platform_retail_catalog_v2/i.test(sql),
    'is_active=false is the only sanctioned retirement (owner 2026-06-08)',
  );
  assert.ok(
    /is_active IS DISTINCT FROM FALSE/i.test(sql),
    'guarded so a re-run is a no-op',
  );
});

test('checkout REFUSES a retired SKU, and does so before any charge resolver', () => {
  const src = read('../app/dashboard/[eventId]/checkout/actions.ts');
  const gate = src.indexOf('resolveServiceSellability(serviceKey)');
  assert.ok(gate > 0, 'submitOrderAction stopped asking whether the SKU is sellable');
  assert.match(
    src.slice(gate, gate + 400),
    /sellability === 'retired'[\s\S]*?ok: false/,
    "a 'retired' SKU must return ok:false, not fall through to pricing",
  );
  // ORDER MATTERS: filtering inside a resolver would turn "charged its real price"
  // into "charged whatever the browser sent" (the resolver's own null-means-trust-the-
  // client fallback). The reject has to come first.
  // SEC-7 folded the individual resolvers into one authority call; the ordering
  // invariant is unchanged and still the point.
  const resolver = src.indexOf('resolveOrderChargeCentavos(');
  assert.ok(resolver > 0, 'the server-side charge authority is gone from checkout');
  assert.ok(gate < resolver, 'the retirement gate must run BEFORE the charge resolvers');
});

/* ── 2 · NO FAKE DOOR ───────────────────────────────────────────────────────── */

test('the Cast studio page gates its BUY control on live sellability', () => {
  const src = read('../app/dashboard/[eventId]/studio/panood/page.tsx');
  assert.ok(
    src.includes('resolveServiceSellability(PANOOD_SKU_CODE)'),
    'the page must ask the catalog, not hardcode the retirement (so it self-heals and reverses)',
  );
  assert.match(
    src,
    /const multicamSellable = sellability === 'sellable'/,
    "only 'sellable' may show a buy path — 'retired' / 'error' / 'unknown' must not",
  );
  assert.match(
    src,
    /secondary: showMulticamCta \? multicamCta : undefined/,
    'the hero must drop the upgrade control when it is not sellable',
  );
  // The price table is a buy surface too — quoting ₱/day for something checkout
  // refuses is the same fake door minus the click.
  assert.match(src, /plans: multicamSellable \? \[freePlanRow, multicamPlanRow\] : \[freePlanRow\]/);
});

test('⚠ it hides the BUY, never the LAUNCH — an existing Cast buyer keeps their room', () => {
  const src = read('../app/dashboard/[eventId]/studio/panood/page.tsx');
  assert.match(
    src,
    /const showMulticamCta = stateCtx\.state !== 'add' \|\| multicamSellable/,
    'AddOnStateCta is both the buy sheet AND the owner\'s "Open control room" chip; '
      + 'only the add (buy) state may be gated, or a paying buyer is stranded',
  );
});

test('the home pricing payload quotes NO per-day rate — the table is gone entirely', () => {
  // Was: "the home pricing table DROPS the Live Studio row instead of falling back
  // to ₱2,500". That table (PricingData.groups) was deleted 2026-07-30 — nothing
  // had rendered it since the 2026-07-04 overlay redesign, and the Papic rows in
  // it had drifted into three false claims while unwatched. The Live Studio
  // protection this test exists for is now structural rather than conditional:
  // there is no row to quote a retired ₱/day rate on. Both halves still assert,
  // because a resurrected table is exactly where the fake door would come back.
  const src = read('../app/_components/home/pricing-data.ts');
  assert.ok(
    !/PANOOD_SYSTEM/.test(src),
    'a hardcoded fallback would keep advertising a price checkout now refuses',
  );
  assert.ok(
    !/\/day/.test(src.replace(/\/\*[\s\S]*?\*\//g, '')),
    'this payload feeds the Setnayan AI price + vendor tiers only; a per-day rate '
      + 'here renders nowhere, so nothing catches it when the SKU behind it retires',
  );
});

/* ── 3 · THE ALIAS SURVIVES THE RETIREMENT ──────────────────────────────────── */

/** Minimal stub: `owned` = service_keys with a live paid order; comp/internal off. */
function ownedBy(owned: Set<string>, comp = false): SupabaseClient {
  let keys: string[] | null = null;
  const q: Record<string, unknown> = {
    from: () => q,
    select: () => q,
    eq: () => q,
    not: () => q,
    in(col: string, vals: unknown) {
      if (col === 'service_key' && Array.isArray(vals)) keys = vals as string[];
      return q;
    },
    then(onOk: (v: unknown) => unknown) {
      const hit = keys?.some((k) => owned.has(k)) ?? false;
      keys = null;
      return Promise.resolve({ data: hit ? [{ status: 'paid' }] : [], error: null }).then(onOk);
    },
    rpc: (fn: string) =>
      Promise.resolve({
        data: fn === 'event_has_comp_for_sku' ? comp : false,
        error: null,
      }),
  };
  return q as unknown as SupabaseClient;
}

test('a historical PANOOD_SYSTEM order STILL confers LIVE_STUDIO after retirement', async () => {
  // Retirement is a CATALOG flag. Ownership reads `orders`, so nothing about it moves.
  assert.equal(
    await eventSkuActive(ownedBy(new Set(['PANOOD_SYSTEM'])), 'evt_cast', 'LIVE_STUDIO'),
    true,
    'retiring the SKU must not revoke an entitlement anybody already holds',
  );
  assert.equal(
    await eventSkuActive(ownedBy(new Set(['PANOOD_SYSTEM_MOBILE'])), 'evt_mob', 'LIVE_STUDIO'),
    true,
  );
});

test('a COMPED LIVE_STUDIO grant still resolves after retirement', async () => {
  assert.equal(
    await eventSkuActive(ownedBy(new Set(), true), 'evt_comp', 'LIVE_STUDIO'),
    true,
    'comp grants never consult the catalog — an admin gift survives a SKU retirement',
  );
});

test('the alias is UNCHANGED — this PR retires a row, it does not rewrite ownership', () => {
  assert.deepEqual(SKU_OWNERSHIP_ALIASES.LIVE_STUDIO, [...PANOOD_PAID_SKUS]);
  assert.deepEqual([...PANOOD_PAID_SKUS], ['PANOOD_SYSTEM', 'PANOOD_SYSTEM_MOBILE']);
});

test('DESIGN PIN: ownership never reads the retail catalog, so retirement cannot revoke', () => {
  const src = read('./entitlements.ts');
  assert.ok(
    !src.includes('platform_retail_catalog_v2'),
    'if a gate ever starts filtering on is_active, retiring a SKU would silently '
      + 'strip the feature from everyone who already bought it',
  );
});
