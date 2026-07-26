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
 *                                enumerated with where its amount comes from
 *                                AND which client it writes with. A new one
 *                                goes RED rather than sneaking in.
 *   3. NO CLIENT PRICE         — no order-minting module traces its
 *                                `requested_total_php` back to a money-shaped
 *                                `formData` read.
 *   4. CHECKOUT STAYS CORRECT  — `submitOrderAction` re-resolves from the
 *                                catalog, and rejects a retired SKU BEFORE the
 *                                charge resolvers run (order matters: a null
 *                                resolve falls back to the client price).
 *   5. ADMIN STAYS ADMIN       — the one path that legitimately mints a bespoke
 *                                amount stays `assertAdmin()`-gated.
 *   6. SERVER-ONLY MINT (SEC-4b) — every mint goes through a service-role
 *                                client and stamps its identity columns via
 *                                `lib/order-mint-identity.ts`.
 *
 * ── SEC-4b · WHY TEST 6 EXISTS ───────────────────────────────────────────────
 * SEC-4 was the APP half. The DB half (migration 20271008178212) revokes INSERT
 * on `orders` + `payments` from `authenticated` / `anon`, because the same ₱1
 * order could be POSTed straight to PostgREST with the public anon key,
 * skipping every line of code these tests police. `orders_owner_write` is
 * `FOR ALL … WITH CHECK (user_id = auth.uid())` — it authenticates the buyer
 * and says nothing about the amount, and `guard_orders_protected_columns` is
 * BEFORE **UPDATE**, so it never sees an INSERT.
 *
 * That revoke means every minting site now writes as `service_role`, which
 * BYPASSES ALL POLICIES — so `WITH CHECK (user_id = auth.uid())`, the only
 * thing that used to bind a row to its buyer, is gone. `orderRowFor()` /
 * `paymentRowFor()` (lib/order-mint-identity.ts) restore that binding in code:
 * they stamp `user_id` / `event_id` / `vendor_profile_id` from server-derived
 * values and make supplying them a TYPE ERROR. Test 6 is what keeps a future
 * site from taking the service-role client without taking the binding with it.
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
 * Every module that inserts an `orders` row: WHERE ITS AMOUNT COMES FROM, and —
 * since SEC-4b — WHICH CLIENT IT WRITES WITH and WHAT AUTHORIZES the row now
 * that RLS no longer does. The value is the review note, not decoration — if
 * you cannot write one, the module should not be minting orders.
 *
 * Every entry is now service-role (test 6 enforces it): migration
 * 20271008178212 revoked INSERT from `authenticated` / `anon`.
 */
const ORDER_MINTERS: Record<string, string> = {
  [CHECKOUT_ACTIONS]:
    'Couple checkout. Re-resolves from platform_retail_catalog_v2 / platform_package_catalog ' +
    'server-side and rejects a retired SKU before the resolvers. THE canonical path. ' +
    'SEC-4b: was the SESSION client, now service-role (`moneyWriter`). Authorized by ' +
    'getUser + not-anonymous + an event_members row + coordinatorMoneyScopeAllowed(checkout); ' +
    'event_id is pinned NULL on the eventless AI-subscription branch, which skips those checks.',
  'app/dashboard/[eventId]/studio/papic/actions.ts':
    'Papic camera/window buys. Amount is a server-computed quote (quote.totalPhp / ' +
    'quote.frozenBillPhp); the form supplies quantities and windows, never pesos. ' +
    'Already service-role before SEC-4b — unchanged.',
  'app/vendor-dashboard/clients/[eventId]/photo-challenge-actions.ts':
    'Vendor photo-challenge SKU. pricePhp read server-side from the vendor catalog. ' +
    'SEC-4b: paid branch moved to the file’s existing `admin` client (the ₱0 branch was ' +
    'already there). The client-supplied event_id is bound by the admin event_vendors read ' +
    '(own marketplace_vendor_id + COMMITTED_BOOKING_STATUSES) that runs before pricing.',
  'app/vendor-dashboard/subscription/booth-addon-actions.ts':
    'Vendor 3D-booth add-on. pricePhp read server-side from the vendor catalog. ' +
    'SEC-4b: paid branch now service-role (`moneyWriter`). Authorized by fetchOwnVendorProfile + ' +
    'resolveVendorRoleForProfile + tier + verified + the first-5-free evaluation.',
  'app/vendor-dashboard/subscription/ai-addon-actions.ts':
    'Vendor AI add-on. pricePhp read server-side from the vendor catalog. ' +
    'SEC-4b: paid branch now service-role (`moneyWriter`); the free-first-cycle branch keeps its ' +
    'own admin client and its atomic is-null-guarded trial claim. Same vendor-role gate.',
  'app/vendor-dashboard/subscription/custom/actions.ts':
    'Vendor Custom plan. The form carries the COMPOSITION (branches/seats/photos…); unit ' +
    'prices come from fetchCustomUnitPrices() and the total from computeCustomQuote(). ' +
    'SEC-4b: now service-role (`moneyWriter`), and the role gate was tightened from the ' +
    'global-highest resolveVendorRole to the PROFILE-scoped resolveVendorRoleForProfile.',
  'app/vendor-dashboard/team/actions.ts':
    'Extra vendor seat. feePhp from fetchSeatFeePhp() — catalog, not form. ' +
    'SEC-4b: now service-role (`moneyWriter`). Authorized by ensureAdmin() (vendorProfileId ' +
    'resolved from a vendor_team_members owner/admin row) + canBuyExtraSeats.',
  'app/vendor-dashboard/deep-search/actions.ts':
    'Vendor Deep Search SKU. pricePhp read server-side from the vendor catalog. ' +
    'SEC-4b: now reuses the `admin` client the allowance count already created. Authorized by ' +
    'the DPO control + fetchOwnVendorProfile + resolveVendorRoleForProfile + deepSearchEligibility.',
  'app/vendor-dashboard/branches/actions.ts':
    'Vendor branch add/renew. feePhp from fetchBranchFeePhp() — catalog, not form. ' +
    'SEC-4b: now service-role (`moneyWriter`) inside startBranchPayment, whose session-client ' +
    'parameter was REMOVED so a later edit cannot reach for it. Authorized by requireBranchManager ' +
    '(own profile + owner/admin + Enterprise).',
  'lib/booking-fee-lock.server.ts':
    'Booking fee at vendor lock. amountPhp is derived by the fee ladder (lib/booking-fee-lock.ts) ' +
    'from the declared deal value; service-role insert. Already service-role — unchanged.',
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

/* ── 6 · SERVER-ONLY MINT (SEC-4b) ──────────────────────────────────────────── */

/**
 * The identifier a `.from('orders'|'payments').insert(` chain hangs off — i.e.
 * `admin` in `await admin\n  .from('orders').insert(…)`, or the literal
 * `createAdminClient()` when the client is constructed inline.
 */
function mintClients(src: string, table: 'orders' | 'payments'): string[] {
  const re = new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)[\\s\\S]{0,80}?\\.insert\\b`, 'g');
  const out: string[] = [];
  for (const m of [...src.matchAll(re)]) {
    const before = src.slice(0, m.index).trimEnd();
    if (before.endsWith('createAdminClient()')) {
      out.push('createAdminClient()');
      continue;
    }
    const id = /([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(before);
    out.push(id ? id[1]! : '<unresolved>');
  }
  return out;
}

/** Is `id` bound in this file to a service-role client? */
function isServiceRoleClient(src: string, id: string): boolean {
  if (id === 'createAdminClient()') return true;
  const bind = new RegExp(`\\bconst\\s+${id}\\s*=\\s*(await\\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\(`).exec(src);
  return bind?.[2] === 'createAdminClient';
}

/**
 * Modules whose mint client is a FUNCTION PARAMETER, so source-scanning inside
 * the file cannot resolve it. Reviewed by hand instead — a reason is required,
 * and a new entry is a deliberate act rather than an oversight.
 */
const MINT_CLIENT_REVIEWED: Record<string, string> = {
  'lib/booking-fee-lock.server.ts':
    '`admin: SupabaseClient` is a parameter, not a local binding. The module header states "MUST ' +
    'be called with the SERVICE-ROLE admin client (the RPC is service_role-only)", and its only ' +
    'caller passes createAdminClient(). Verified by hand 2026-07-26.',
};

/**
 * Mints that do NOT stamp identity through `orderRowFor`. These were ALREADY
 * service-role before SEC-4b, so `orders_owner_write`'s WITH CHECK was never
 * the thing protecting them and there is no removed check to restore. A reason
 * is required; anything new defaults to RED.
 */
const IDENTITY_STAMP_REVIEWED: Record<string, string> = {
  'app/dashboard/[eventId]/studio/papic/actions.ts':
    'Three couple-side Papic mints, service-role since they were written. user_id is the getUser() ' +
    'id and event_id is membership-checked upstream. NOT converted here to keep the SEC-4b diff to ' +
    'the sites that actually lost an RLS check — worth folding onto the helper in a follow-up.',
  'lib/booking-fee-lock.server.ts':
    'The vendor booking fee is minted BY A LOCK, not by a session. There is no auth.uid() in scope: ' +
    'the payer is resolved from the charge’s vendor profile (and the order stays payer-less when the ' +
    'profile is unclaimed), so a "stamp the caller’s id" helper does not apply.',
};

test('every order mint writes through a service-role client, never the session', () => {
  // The DB no longer permits anything else: migration 20271008178212 revoked
  // INSERT on orders from `authenticated` + `anon`. A session-client mint is
  // therefore a runtime 42501 in production — this test turns that into a
  // build-time failure with an explanation instead.
  const offenders: string[] = [];
  for (const rel of findOrderMinters()) {
    if (rel in MINT_CLIENT_REVIEWED) continue;
    const src = read(rel);
    for (const client of mintClients(src, 'orders')) {
      if (!isServiceRoleClient(src, client)) {
        offenders.push(`${rel} → ${client}.from('orders').insert(…)`);
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'an order is minted with a non-service-role client. INSERT on public.orders is revoked from ' +
      '`authenticated` (SEC-4b, migration 20271008178212) because a session-role POST straight to ' +
      'PostgREST could set requested_total_php to ₱1 for any SKU. Use createAdminClient() — and ' +
      'then add the ownership assertion that RLS is no longer making for you.',
  );
});

test('every payments insert writes through a service-role client too', () => {
  // Same revoke, other half of the exploit: payments_owner_insert checked the
  // PAYER and neither the amount nor whether order_id belongs to the caller.
  // Scanned repo-wide, not just the orders roster — logPayment and the vendor
  // booking-fee action insert payments without ever minting an order.
  const offenders: string[] = [];
  const roots = ['app', 'lib'].map((d) => join(WEB, d)).filter((d) => existsSync(d));
  for (const root of roots) {
    for (const file of collectTs(root)) {
      const rel = relative(WEB, file);
      if (rel in MINT_CLIENT_REVIEWED) continue;
      const src = readFileSync(file, 'utf8');
      for (const client of mintClients(src, 'payments')) {
        if (!isServiceRoleClient(src, client)) {
          offenders.push(`${rel} → ${client}.from('payments').insert(…)`);
        }
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'a payment row is inserted with a non-service-role client. INSERT on public.payments is ' +
      'revoked from `authenticated` (SEC-4b) — the amount was never constrained and the FK only ' +
      'checked that the order EXISTS, so a session-role POST could pin any amount onto any order.',
  );
});

test('every converted mint stamps its identity columns through order-mint-identity', () => {
  // service_role bypasses `orders_owner_write`'s WITH CHECK (user_id =
  // auth.uid()) — the ONLY thing that used to bind a row to its buyer. The
  // helpers put that binding back in code and make supplying user_id / event_id
  // / vendor_profile_id by hand a type error. A mint that writes those columns
  // literally has opted out of the guarantee.
  const offenders: string[] = [];
  for (const rel of findOrderMinters()) {
    if (rel in IDENTITY_STAMP_REVIEWED) continue;
    const src = read(rel);
    // An admin setting a negotiated amount for someone else is the product
    // working; there is no "the caller's own id" to stamp (see note d).
    if (/\bassertAdmin\s*\(/.test(src)) continue;
    for (const payload of orderInsertPayloads(src)) {
      // `compOrderRowFor` is the ₱0-comp sibling — it stamps the SAME three
      // identity columns (plus status / requested / confirmed), so a payload
      // built by it satisfies this test for the same reason.
      if (/\b(orderRowFor|compOrderRowFor)\s*\(/.test(payload)) continue;
      if (!/\buser_id\s*:/.test(payload)) continue;
      offenders.push(`${rel} → orders insert sets user_id by hand`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'an order payload sets its identity columns literally instead of via orderRowFor(). Under ' +
      'service_role nothing checks them any more — orderRowFor stamps them from the id ' +
      'supabase.auth.getUser() returned and makes the hand-written form a compile error.',
  );
});
