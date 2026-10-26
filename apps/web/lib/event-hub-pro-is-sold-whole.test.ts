/**
 * ⛔💎 EVENT HUB PRO IS SOLD WHOLE (owner 2026-10-26: "just have the upgrade event hub pro" → "i mean no more by part
 * as well on the website"). It retires the SALE of the eleven parts of 2026-10-22 — never their ownership: a part
 * already paid for keeps working and still counts toward the cap.
 *
 * ONE SWITCH: each part's `platform_retail_catalog_v2.is_active`, read as `hubPartPrices().onSale`. Off → no surface
 * offers a part, and the server refuses a part order. The properties:
 *
 *   1. the catalogue has every part OFF sale (the latest migration that touches them says so, and refuses otherwise);
 *   2. every part price a surface reads goes through `onSale` — a read that skips it would sell a retired part
 *      (`formatV2Sku` never looks at `is_active`, which is how the Monogram and Panood pages kept a ₱500 part button);
 *   3. with no part on sale the Event Hub Pro page sells Everything alone, the parts only as the list of what it opens;
 *   4. with no part on sale /pricing draws no "Everything / Just the parts you need" dropdown — a dropdown of one.
 *
 * (The iPhone app's side — the one-unlock Apply sheet, Apple's page selling Pro alone, the server refusing every part
 * product — is `pro-parts-in-the-app.test.ts`.)
 *
 * Run: cd apps/web && node --import tsx --test lib/event-hub-pro-is-sold-whole.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { stripComments } from './strip-comments';

/* The components are compiled with the classic JSX runtime under `tsx --test` — they need a global React. */
(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = join(WEB, '../../supabase/migrations');
const read = (p: string) => readFileSync(p, 'utf8');
const code = (rel: string) => stripComments(read(join(WEB, rel)));

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

/* ── 1 · the catalogue ──────────────────────────────────────────────────── */

test('the latest migration that sets a part’s is_active takes EVERY part off sale, and refuses otherwise', () => {
  const touching = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .filter((f) => {
      const sql = read(join(MIGRATIONS, f));
      return /COUPLE\\?_HUB\\?_PART/.test(sql) && /is_active\s*=/.test(sql);
    });
  assert.ok(touching.length > 0, 'no migration sets a part’s is_active — the scan is blind');
  const latest = read(join(MIGRATIONS, touching[touching.length - 1]!));
  assert.match(latest, /SET is_active = FALSE[\s\S]{0,80}WHERE service_code LIKE 'COUPLE\\_HUB\\_PART\\_%'/, 'the latest word on the parts does not take them all off sale');
  assert.match(latest, /RAISE EXCEPTION 'an Event Hub Pro part is still on sale/);
  assert.match(latest, /service_code = 'COUPLE_WEBSITE_PRO' AND is_active\) THEN\s*RAISE EXCEPTION/, 'nothing checks Event Hub Pro itself stays on sale');
});

/* ── 2 · every part price goes through the switch ───────────────────────── */

test('every part price a surface reads goes through onSale', () => {
  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];
  let reads = 0;
  for (const f of files) {
    const src = stripComments(read(f));
    const rel = relative(WEB, f);
    // A part's price, read from the one reader (`hubPartPrices`): `.parts.get(` on what it returned.
    if (src.includes('hubPartPrices(') && /\.parts\.get\(/.test(src)) {
      reads += 1;
      assert.match(src, /\.onSale\.has\(/, `${rel} reads a part’s price without asking whether it is on sale`);
    }
    // The catalogue reader that never looks at is_active must never price a part.
    assert.doesNotMatch(src, /formatV2Sku\(\s*(hubPart\(|hubPartSku\(|['"]COUPLE_HUB_PART_)/, `${rel} prices a part through formatV2Sku, which ignores is_active`);
  }
  // The launch page, the Pro page, the Maker's bar, the Monogram and Panood pages — measured 2026-10-26.
  assert.ok(reads >= 5, `only ${reads} part-price reads found — the scan is blind`);
});

/* ── 3 · the Event Hub Pro page ─────────────────────────────────────────── */

test('with no part on sale the Pro page sells Everything alone — no part price, button, pick or "counts toward"', () => {
  const body = code('app/dashboard/[eventId]/studio/website-pro/_components/pro-parts-body.tsx');
  assert.match(body, /const partsOnSale = HUB_PARTS\.some\(\(p\) => partPrice\(p\.id\) !== null\);/);
  // The Apply sheet's `?buy=` pick is a part order — only while parts are sold.
  assert.match(body, /\{partsOnSale && !active\?\.full && !owned\?\.full && buyParts\.length > 0/);
  // One list of what Everything opens, instead of the priced big/small bands.
  assert.match(body, /partsOnSale\s*\?\s*\[\s*\{ title: 'Big parts'[\s\S]{0,120}\]\s*:\s*\[\{ title: 'What Event Hub Pro unlocks', parts: HUB_PARTS \}\]/);
  // A part's own button needs its price — and no part price is handed in once they are off sale.
  assert.match(body, /state === 'buy' && php !== null && !owned\?\.full \? \(/);
  assert.match(body, /\{partsOnSale \? `Everything you pay here counts toward everything\./);
  const page = code('app/dashboard/[eventId]/studio/website-pro/page.tsx');
  assert.match(page, /prices\?\.onSale\.has\(p\.sku\) \? prices\.parts\.get\(p\.sku\) : undefined/);
});

/* ── 4 · /pricing ───────────────────────────────────────────────────────── */

test('with no part on sale /pricing draws no parts dropdown and no "just the parts you need"', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubProWays } = await import('../app/(shell)/pricing/_pricing-pickers');
  const off = renderToStaticMarkup(React.createElement(HubProWays, { everythingLabel: 'Everything · ₱5,000', partsLabel: null, parts: null }));
  assert.equal(off, '', 'a dropdown of one is drawn when no part is on sale');
  const on = renderToStaticMarkup(React.createElement(HubProWays, { everythingLabel: 'Everything · ₱5,000', partsLabel: 'Just the parts you need · from ₱500', parts: null }));
  assert.match(on, /data-hub-ways="all"/, 'the guard cannot see the dropdown when parts ARE on sale — it is blind');
  const page = code('app/(shell)/pricing/page.tsx');
  assert.match(page, /are Event Hub Pro\$\{prices\.hubParts\.length > 0 \? ', or just the parts you need' : ''\}\./);
  // The parts list itself only holds rows the catalogue has ACTIVE (`_pricing-reads.ts`).
  assert.match(code('app/(shell)/pricing/_pricing-reads.ts'), /const n = r && r\.is_active \? Number\(r\.retail_price_php\) : NaN;/);
});
