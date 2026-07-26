/**
 * ⭐ SEC-4 — THE PRICE IS THE SERVER'S, NEVER THE BROWSER'S.
 *
 * THE HOLE (found 2026-07-26, deferred out of PR #3728). The legacy
 * `createOrder` server action in `app/dashboard/[eventId]/orders/actions.ts`
 * read its charge straight off the submitted form:
 *
 *     const requestedRaw = formData.get('requested_total_php');
 *     const amount = Number(requestedRaw);
 *     …
 *     requested_total_php: Math.round(amount * 100) / 100
 *
 * No catalog resolve. No `resolveServiceSellability` gate. No floor. Its UI
 * entry point `/orders/new` had been a bare `redirect()` since 2026-05-29 — but
 * a `'use server'` export stays POST-able by its action id whether or not any
 * UI references it, and that module reaches the client graph through
 * `cancelOrder` + `logPayment`. So any authenticated event member could mint an
 * order for any `service_key` at any amount, pay that amount for real, and hand
 * the reconciliation queue a receipt that matched.
 *
 * THE FIX was deletion — the export had zero callers — and these tests hold the
 * five things that keep it deleted and keep the rest of the money path honest:
 *
 *   1. THE ACTION IS GONE      — and the module mints no orders at all.
 *   2. THE ROSTER IS REVIEWED  — every module that inserts into `orders` is
 *                                enumerated with where its amount comes from.
 *                                A new one goes RED rather than sneaking in.
 *   3. NO CLIENT PRICE         — no order-minting module traces its
 *                                `requested_total_php` back to a money-shaped
 *                                `formData` read.
 *   4. CHECKOUT STAYS CORRECT  — `submitOrderAction` re-resolves from the
 *                                catalog, and rejects a retired SKU BEFORE the
 *                                charge resolvers run (order matters: a null
 *                                resolve falls back to the client price).
 *   5. ADMIN STAYS ADMIN       — the one path that legitimately mints a bespoke
 *                                amount stays `assertAdmin()`-gated.
 *
 * ── HONESTY ABOUT THE HEURISTIC ──────────────────────────────────────────────
 * These are SOURCE-SCANNING tests, so be plain about what they cannot see:
 *
 *  a. Minting is detected as a literal `.from('orders') … .insert(`. An insert
 *     built through a helper, a variable table name, or raw SQL/RPC is
 *     invisible here.
 *  b. Test 3 taints only MONEY-SHAPED form keys — `/price|amount|total|
 *     centavos|php|fee|cost/i`. That is deliberate. "The browser picked 5
 *     cameras and the server priced them" is correct and common (Papic quotes,
 *     the vendor Custom configurator); "the browser sent the peso figure" is
 *     the bug. A money field named e.g. `formData.get('x')` defeats it.
 *  c. The taint trace follows `const <id> = <rhs>` bindings up to 6 hops within
 *     one file. It does not cross function boundaries or files — a price laundered
 *     through a parameter of an imported helper is not seen.
 *  d. Admin-gated modules are EXEMPT from test 3 by design. An admin setting a
 *     negotiated price is the product working; the browser setting its own price
 *     is the bug. The exemption requires a literal `assertAdmin(` in the file, so
 *     removing the gate un-exempts it and the test goes red.
 *
 * Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (rel: string) => readFileSync(resolve(WEB, rel), 'utf8');

const ORDERS_ACTIONS = 'app/dashboard/[eventId]/orders/actions.ts';
const CHECKOUT_ACTIONS = 'app/dashboard/[eventId]/checkout/actions.ts';
const ADMIN_CUSTOM_PLANS = 'app/admin/custom-plans/actions.ts';

/* ── 1 · THE ACTION IS GONE ─────────────────────────────────────────────────── */

test('createOrder is deleted — the client-priced order action does not exist', () => {
  const src = read(ORDERS_ACTIONS);
  assert.ok(
    !/export\s+(async\s+)?function\s+createOrder\b/.test(src),
    'createOrder is back. It took requested_total_php from the submitted form with no ' +
      'catalog resolve and no sellability gate — an exported server action is POST-able ' +
      'by action id even with no UI. Re-add order creation on the submitOrderAction path.',
  );
  assert.ok(
    !/createSelfCompOrder/.test(src),
    'the self-comp minter is back — it inserted status=paid at a caller-supplied amount ' +
      'through service-role. Rebuild it on the checkout path (see lib/self-comp-authority.ts).',
  );
});

test('the legacy orders module mints no orders at all', () => {
  const src = read(ORDERS_ACTIONS);
  assert.ok(
    !/\.from\(\s*['"]orders['"]\s*\)[\s\S]{0,80}?\.insert\b/.test(src),
    `${ORDERS_ACTIONS} inserts into orders again. Its remaining job is cancel + log-payment; ` +
      'order creation belongs to submitOrderAction, which re-resolves the price server-side.',
  );
});

test('the module exports exactly the two reviewed server actions', () => {
  const src = read(ORDERS_ACTIONS);
  assert.ok(src.startsWith("'use server'"), 'still a server-action module');
  const exported = [...src.matchAll(/export\s+async\s+function\s+([A-Za-z0-9_]+)/g)]
    .map((m) => m[1]!)
    .sort();
  assert.deepEqual(
    exported,
    ['cancelOrder', 'logPayment'],
    'a new export in this module is a new POST-able endpoint. Every export of a ' +
      "'use server' file is callable by action id — review it, then update this list.",
  );
});

/* ── 2 · THE ROSTER IS REVIEWED ─────────────────────────────────────────────── */

/**
 * Every module that inserts an `orders` row, and WHERE ITS AMOUNT COMES FROM.
 * The value is the review note, not decoration — if you cannot write one, the
 * module should not be minting orders.
 */
const ORDER_MINTERS: Record<string, string> = {
  [CHECKOUT_ACTIONS]:
    'Couple checkout. Re-resolves from platform_retail_catalog_v2 / platform_package_catalog ' +
    'server-side and rejects a retired SKU before the resolvers. THE canonical path.',
  'app/dashboard/[eventId]/studio/papic/actions.ts':
    'Papic camera/window buys. Amount is a server-computed quote (quote.totalPhp / ' +
    'quote.frozenBillPhp); the form supplies quantities and windows, never pesos.',
  'app/vendor-dashboard/clients/[eventId]/photo-challenge-actions.ts':
    'Vendor photo-challenge SKU. pricePhp read server-side from the vendor catalog.',
  'app/vendor-dashboard/subscription/booth-addon-actions.ts':
    'Vendor 3D-booth add-on. pricePhp read server-side from the vendor catalog.',
  'app/vendor-dashboard/subscription/ai-addon-actions.ts':
    'Vendor AI add-on. pricePhp read server-side from the vendor catalog.',
  'app/vendor-dashboard/subscription/custom/actions.ts':
    'Vendor Custom plan. The form carries the COMPOSITION (branches/seats/photos…); unit ' +
    'prices come from fetchCustomUnitPrices() and the total from computeCustomQuote().',
  'app/vendor-dashboard/team/actions.ts':
    'Extra vendor seat. feePhp from fetchSeatFeePhp() — catalog, not form.',
  'app/vendor-dashboard/deep-search/actions.ts':
    'Vendor Deep Search SKU. pricePhp read server-side from the vendor catalog.',
  'app/vendor-dashboard/branches/actions.ts':
    'Vendor branch add/renew. feePhp from fetchBranchFeePhp() — catalog, not form.',
  'lib/booking-fee-lock.server.ts':
    'Booking fee at vendor lock. amountPhp is derived by the fee ladder (lib/booking-fee-lock.ts) ' +
    'from the declared deal value; service-role insert.',
  [ADMIN_CUSTOM_PLANS]:
    'ADMIN-MINTED BESPOKE AMOUNT — legitimate and intentional. assertAdmin()-gated, service-role ' +
    'write, per-quote unit-price overrides are an admin negotiation tool. Exempt from test 3.',
};

/** Recursively collect .ts files, skipping tests and build output. */
function collectTs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectTs(full, out);
    else if (entry.endsWith('.ts') && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

const MINT_RE = /\.from\(\s*['"]orders['"]\s*\)[\s\S]{0,80}?\.insert\b/;

function findOrderMinters(): string[] {
  const roots = ['app', 'lib'].map((d) => join(WEB, d)).filter((d) => existsSync(d));
  const hits: string[] = [];
  for (const root of roots) {
    for (const file of collectTs(root)) {
      if (MINT_RE.test(readFileSync(file, 'utf8'))) {
        hits.push(relative(WEB, file));
      }
    }
  }
  return hits.sort();
}

test('every module that mints an order is on the reviewed roster', () => {
  const found = findOrderMinters();
  const unreviewed = found.filter((f) => !(f in ORDER_MINTERS));
  assert.deepEqual(
    unreviewed,
    [],
    'a new module inserts into `orders`. Say where its amount comes from and add it to ' +
      'ORDER_MINTERS — a silent omission is how SEC-4 lived for two months.',
  );
  const stale = Object.keys(ORDER_MINTERS).filter((f) => !found.includes(f));
  assert.deepEqual(stale, [], 'roster entries no longer mint orders — prune them');
});

/* ── 3 · NO CLIENT PRICE ────────────────────────────────────────────────────── */

const MONEY_KEY = /price|amount|total|centavos|php|fee|cost/i;

/** Slice the balanced `{…}` payload passed to the first `.insert(` after `from('orders')`. */
function orderInsertPayloads(src: string): string[] {
  const out: string[] = [];
  const re = /\.from\(\s*['"]orders['"]\s*\)[\s\S]{0,80}?\.insert\(/g;
  for (const m of re.exec(src) ? [...src.matchAll(re)] : []) {
    let i = src.indexOf('{', m.index + m[0].length - 1);
    if (i < 0) continue;
    let depth = 0;
    for (let j = i; j < src.length; j++) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') {
        depth--;
        if (depth === 0) {
          out.push(src.slice(i, j + 1));
          break;
        }
      }
    }
  }
  return out;
}

/**
 * Does `expr` trace back to a money-shaped `formData.get(...)` within this file?
 * Follows `const <id> = <rhs>;` bindings, max 6 hops.
 */
function tracesToClientPrice(src: string, expr: string, depth = 0): boolean {
  if (depth > 6) return false;
  if (new RegExp(`formData\\.get\\(\\s*['"\`][^'"\`]*(?:${MONEY_KEY.source})[^'"\`]*['"\`]`, 'i').test(expr)) {
    return true;
  }
  for (const id of new Set([...expr.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g)].map((m) => m[1]!))) {
    const bind = new RegExp(`\\bconst\\s+${id}\\s*(?::[^=\\n]+)?=\\s*([\\s\\S]*?);`).exec(src);
    if (bind && tracesToClientPrice(src, bind[1]!, depth + 1)) return true;
  }
  return false;
}

test('no order-minting module takes its price from the browser', () => {
  const offenders: string[] = [];
  for (const rel of findOrderMinters()) {
    const src = read(rel);
    // Admin-gated bespoke pricing is the product working, not the bug (see note d).
    if (/\bassertAdmin\s*\(/.test(src)) continue;
    for (const payload of orderInsertPayloads(src)) {
      const field = /requested_total_php\s*:\s*([^,\n]+)/.exec(payload);
      if (!field) continue;
      if (tracesToClientPrice(src, field[1]!)) {
        offenders.push(`${rel} → requested_total_php: ${field[1]!.trim()}`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'an order amount traces back to a money-shaped form field. The browser may choose WHAT and ' +
      'HOW MANY; the server decides the peso figure, from the catalog.',
  );
});

/* ── 4 · CHECKOUT STAYS CORRECT ─────────────────────────────────────────────── */

test('submitOrderAction rejects a retired SKU BEFORE any charge resolver', () => {
  const src = read(CHECKOUT_ACTIONS);
  const gate = src.indexOf('resolveServiceSellability(serviceKey)');
  const resolver = src.indexOf('resolvePaxPricedOrderCentavos(');
  assert.ok(gate > 0, 'the sellability gate is gone from checkout');
  assert.ok(resolver > 0, 'the catalog charge resolver is gone from checkout');
  assert.ok(
    gate < resolver,
    'the reject must precede the resolvers — a null resolve keeps the CLIENT price, so gating ' +
      'inside the resolver turns "charged its real price" into "charged whatever the browser sent"',
  );
  assert.match(
    src.slice(gate, gate + 400),
    /sellability === 'retired'[\s\S]*?ok: false/,
    "a retired SKU must return ok:false, not fall through to pricing",
  );
  assert.match(
    src.slice(gate, gate + 800),
    /sellability === 'error'[\s\S]*?ok: false/,
    'fail CLOSED — an unresolvable sellability read must deny, never allow',
  );
});

test('checkout writes the catalog-resolved base, not the posted one', () => {
  const src = read(CHECKOUT_ACTIONS);
  assert.match(
    src,
    /requested_total_php:\s*originalPriceForOrderTotal/,
    'the stored amount must be the server-resolved base',
  );
  assert.match(
    src,
    /const originalPriceForOrderTotal = Number\(originalCentavos\) \/ 100/,
    'originalPriceForOrderTotal must derive from originalCentavos (overwritten by the resolvers)',
  );
  const resolver = src.indexOf('resolvePaxPricedOrderCentavos(');
  const write = src.indexOf('const originalPriceForOrderTotal');
  assert.ok(resolver < write, 'the resolve must happen before the amount is frozen for the row');
});

/* ── 5 · ADMIN STAYS ADMIN ──────────────────────────────────────────────────── */

test('the bespoke-amount admin path stays admin-gated and service-role', () => {
  const src = read(ADMIN_CUSTOM_PLANS);
  assert.match(src, /async function assertAdmin\(\)/, 'the admin gate helper is gone');
  assert.match(
    src,
    /is_internal \|\| me\?\.is_team_member \|\| me\?\.account_type === 'admin'/,
    'the admin gate stopped checking internal / team / admin',
  );
  const insert = src.search(/\.from\(\s*['"]orders['"]\s*\)[\s\S]{0,80}?\.insert\b/);
  assert.ok(insert > 0, 'the admin quote no longer mints an order — roster is stale');
  assert.ok(
    /await assertAdmin\(\);/.test(src.slice(0, insert)),
    'every bespoke-amount mint must be behind assertAdmin() — otherwise it is SEC-4 with extra steps',
  );
  assert.match(
    src,
    /const \{ data: orderRow, error: oErr \} = await admin\s*\n\s*\.from\('orders'\)/,
    'the admin mint must go through the service-role client, not the caller session',
  );
});
