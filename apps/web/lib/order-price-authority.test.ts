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
  'app/papic/buy/actions.ts':
    'GUEST-bought Papic — a pool top-up or a reload of the buyer’s OWN camera, at the same rungs ' +
    'the host pays (owner-locked 2026-07-29). The form carries a service_code CHOICE only; points ' +
    'come from papic_pass_tiers / papic_one_tiers and the peso figure from ' +
    'platform_retail_catalog_v2 (is_active re-checked before the order exists), both server-side. ' +
    'Service-role write. THE ORDER HAS NO ACCOUNT: identity is stamped via guestOrderRowFor, whose ' +
    'owner axis (claimed paparazzi_seats.claim_qr_token, or the signed setnayan_guest_session ' +
    'cookie) replaces user_id — and the event_id comes off that credential, never off the form, ' +
    'which is what stops an order being attached to a stranger’s event. A One reload additionally ' +
    'requires the requested seat to BE the held seat (resolveGuestReloadTarget) and to already hold ' +
    'a dedicated balance.',
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

/**
 * Slice the balanced argument text passed to `.insert(…)` after `from('orders')`.
 *
 * ⚠ SEC-7 FIX — THIS USED TO SILENTLY SKIP THE ONE FILE THAT MATTERED.
 * The old version did `src.indexOf('{', …)` from the `.insert(`, i.e. it assumed
 * the argument was an OBJECT LITERAL. Checkout writes `.insert(insertPayload)` —
 * a VARIABLE — so `indexOf('{')` ran off into whatever block happened to come
 * next in the file and matched no `requested_total_php:` at all. The single
 * module where a client-supplied price genuinely survived to the DB therefore
 * contributed ZERO assertions to test 3 for its entire life.
 *
 * Now: a literal is returned as before; a variable is INLINED — its declaration
 * plus every later `payload.field = …` mutation, so the money field is visible
 * wherever it was actually attached.
 */
function balancedSlice(src: string, start: number, open: '{' | '('): string | null {
  const close = open === '{' ? '}' : ')';
  let depth = 0;
  for (let j = start; j < src.length; j++) {
    if (src[j] === open) depth++;
    else if (src[j] === close) {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  return null;
}

function orderInsertPayloads(src: string): string[] {
  const out: string[] = [];
  const re = /\.from\(\s*['"]orders['"]\s*\)[\s\S]{0,80}?\.insert\(/g;
  for (const m of [...src.matchAll(re)]) {
    const argStart = m.index + m[0].length - 1; // at the '(' of .insert(
    const args = balancedSlice(src, argStart, '(');
    if (args == null) continue;
    const inner = args.slice(1, -1).trim();

    // (a) object literal — the original behaviour.
    if (inner.startsWith('{')) {
      out.push(inner);
      continue;
    }
    // (b) a call like orderRowFor({…}, {…}) — its own text carries the fields.
    // (c) a bare identifier — inline the declaration + later property writes.
    const bareId = /^([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(inner);
    if (!bareId) {
      out.push(inner);
      continue;
    }
    const id = bareId[1]!;
    const parts: string[] = [];
    const decl = new RegExp(
      `\\b(?:const|let|var)\\s+${id}\\s*(?::[^=\\n]+)?=\\s*([\\s\\S]*?);\\n`,
    ).exec(src);
    if (decl) parts.push(decl[1]!);
    for (const set of src.matchAll(
      new RegExp(`\\b${id}\\.([A-Za-z0-9_$]+)\\s*=\\s*([^;\\n]+);`, 'g'),
    )) {
      parts.push(`${set[1]!}: ${set[2]!},`);
    }
    if (parts.length > 0) out.push(parts.join('\n'));
  }
  return out;
}

/**
 * Walk every binding of `id` in this file: `const/let/var` declarations AND
 * bare reassignments (`id = …;`). The old walk followed `const` only, which is
 * the other half of why checkout escaped: its charge lived in
 * `let originalCentavos: bigint;` and was assigned separately from
 * `BigInt(originalRaw)`.
 */
function bindingsOf(src: string, id: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(
    new RegExp(`\\b(?:const|let|var)\\s+${id}\\s*(?::[^=\\n]+)?=\\s*([\\s\\S]*?);`, 'g'),
  )) {
    out.push(m[1]!);
  }
  for (const m of src.matchAll(new RegExp(`(?:^|[^.\\w])${id}\\s*=\\s*([^;\\n]+);`, 'g'))) {
    out.push(m[1]!);
  }
  return out;
}

/** Recurse over the identifiers in `expr`, testing each binding with `hit`. */
function tracesTo(
  src: string,
  expr: string,
  hit: (text: string) => boolean,
  depth = 0,
  seen = new Set<string>(),
): boolean {
  if (depth > 8) return false;
  if (hit(expr)) return true;
  for (const id of new Set([...expr.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g)].map((m) => m[1]!))) {
    if (seen.has(id)) continue;
    seen.add(id);
    for (const bound of bindingsOf(src, id)) {
      if (tracesTo(src, bound, hit, depth + 1, seen)) return true;
    }
  }
  return false;
}

/** Does `expr` trace back to a money-shaped `formData.get(...)` within this file? */
function tracesToClientPrice(src: string, expr: string): boolean {
  const re = new RegExp(
    `formData\\.get\\(\\s*['"\`][^'"\`]*(?:${MONEY_KEY.source})[^'"\`]*['"\`]`,
    'i',
  );
  return tracesTo(src, expr, (text) => re.test(text));
}

/** Does `expr` trace back to the SERVER-SIDE charge authority? */
function tracesToServerAuthority(src: string, expr: string): boolean {
  return tracesTo(src, expr, (text) =>
    /resolveOrderChargeCentavos\(|orderTotalToPhp\(/.test(text),
  );
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
  const resolver = src.indexOf('resolveOrderChargeCentavos(');
  assert.ok(gate > 0, 'the sellability gate is gone from checkout');
  assert.ok(resolver > 0, 'the server-side charge authority is gone from checkout');
  assert.ok(
    gate < resolver,
    'the reject must precede the resolvers. `is_active=false` is OVERLOADED — on ' +
      'SETNAYAN_AI_RENEW it means "not independently sellable", not "retired" — so this stays a ' +
      'separate REJECT and never becomes an is_active filter inside a resolver.',
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

/* ── 4b · ⭐ SEC-7 · NO SERVER PRICE ⇒ NO SALE ──────────────────────────────── */

/**
 * THE SEC-7 HOLE, stated precisely so a future reader can re-derive it:
 *
 *   `originalCentavos` was seeded from `formData.get('original_centavos')` and
 *   overwritten ONLY IF a catalog row resolved. `resolveServiceSellability`
 *   returns 'unknown' for keys in NEITHER catalog and 'unknown' is deliberately
 *   ALLOWED. `SETNAYAN_AI_SUB` is such a key (verified absent from both catalogs
 *   in prod), and its branch SKIPS the `event_members` check because the SKU is
 *   eventless. So any signed-in account could POST
 *   `service_key=SETNAYAN_AI_SUB, original_centavos=1` and mint a ₱0.01 order;
 *   on approval `cyclesFromAmount(0.01, null)` returned 1 and stamped a full
 *   28-day subscription. Repeatable, stacking.
 *
 * These are the assertions that keep it shut. Note what they DON'T do: they do
 * not enumerate SKUs. The invariant is structural — the charge comes from the
 * authority or the sale is refused — so a NEW key with no resolver fails the
 * sale by construction rather than by anyone remembering to list it.
 */
test('SEC-7 · the charged amount traces to the server authority, not the browser', () => {
  const src = read(CHECKOUT_ACTIONS);
  const payloads = orderInsertPayloads(src);
  assert.ok(
    payloads.length > 0,
    'the orders insert payload could not be extracted from checkout — the taint trace is blind ' +
      'again (it was, for `.insert(insertPayload)`, until SEC-7)',
  );
  let checked = 0;
  for (const payload of payloads) {
    const field = /requested_total_php\s*:\s*([^,\n]+)/.exec(payload);
    if (!field) continue;
    checked++;
    assert.ok(
      tracesToServerAuthority(src, field[1]!),
      `requested_total_php (${field[1]!.trim()}) no longer traces to resolveOrderChargeCentavos(). ` +
        'Deleting the server resolve must FAIL this test — that is the entire point of it.',
    );
    assert.ok(
      !tracesToClientPrice(src, field[1]!),
      `requested_total_php (${field[1]!.trim()}) traces back to a money-shaped form field. ` +
        'SEC-7: the browser may choose WHAT; the server decides the peso figure.',
    );
  }
  assert.equal(checked, 1, 'expected exactly one requested_total_php in the checkout mint');
});

test('SEC-7 · a refusal from the authority stops the sale', () => {
  const src = read(CHECKOUT_ACTIONS);
  const call = src.indexOf('resolveOrderChargeCentavos(');
  assert.ok(call > 0, 'the charge authority call is gone');
  assert.match(
    src.slice(call, call + 1200),
    /if \(!authority\.ok\)[\s\S]*?return \{ ok: false/,
    'an unresolvable price must REFUSE. The old code fell through and kept the POSTed value — ' +
      'that fall-through IS SEC-7.',
  );
  // No resolver may be re-added that hands back a client fallback.
  assert.ok(
    !/original_centavos[\s\S]{0,400}?requested_total_php/.test(src),
    'the posted centavos are within reach of the stored amount again',
  );
});

test('SEC-7 · checkout cannot multiply the total by cycles (the 36× overcharge trap)', () => {
  const src = read(CHECKOUT_ACTIONS);
  // `setnayan-ai-subscribe.tsx` ALREADY ships unit × cycles as original_centavos.
  // Checkout used to multiply by `cycles` a SECOND time — with the default 6-cycle
  // preset that is 36×. It was unreachable only because the unit price was
  // unresolvable; making the price server-resolved is exactly what would have
  // armed it. The multiply now lives in ONE place (the authority), and the total
  // it returns is a branded bigint whose product is NOT assignable back to the
  // brand — so a second multiply is a COMPILE error, not a review item.
  assert.ok(
    !/parseCycles\s*\(/.test(src),
    'checkout parses cycles again. Cycle parsing + the unit × cycles multiply belong to ' +
      'lib/order-charge-authority.ts, in exactly one place, so they cannot happen twice.',
  );
  assert.ok(
    !/\*\s*BigInt\(\s*cycles\s*\)|cycles\s*\)\s*\*|\*\s*cycles\b/.test(src),
    'checkout multiplies by cycles again — that is the 36× overcharge',
  );

  // The multiply lives in the PURE half, and there is exactly one of it.
  const math = read('lib/order-charge-math.ts');
  const multiplies = [...math.matchAll(/BigInt\([^;]*?\)\s*\*\s*BigInt\(/g)];
  assert.equal(
    multiplies.length,
    1,
    'unit × cycles must happen in exactly ONE place; found ' +
      `${multiplies.length}. Two multiply sites is how cycles² comes back.`,
  );
  assert.match(
    math,
    /declare const ORDER_TOTAL_BRAND: unique symbol/,
    'the branded total is what makes double-multiplication unrepresentable — keep the brand',
  );
  // The brand may only be applied to a number READ FROM A CATALOG, never to the
  // product of arithmetic on an existing total. Two sites: the generic
  // constructor and the AI unit × cycles. A third is a new way to launder a
  // multiplied total back into a "total".
  const seals = [...math.matchAll(/as OrderTotalCentavos/g)];
  assert.equal(
    seals.length,
    2,
    `the brand is applied at ${seals.length} sites, expected 2 (sealServerResolvedTotal + ` +
      'resolveAiSubTotal). Every extra site is a place a re-multiplied value can be called a total.',
  );
  const authority = read('lib/order-charge-authority.ts');
  assert.ok(
    !/as OrderTotalCentavos/.test(authority),
    'the async resolvers must go through the pure constructors, never brand a value themselves',
  );
});

test('SEC-7 · the catalog resolvers fail CLOSED on a read error', () => {
  const cat = read('lib/v2-catalog.ts');
  // resolvePaxPricedOrderCentavos returned null for BOTH "no row" and "the read
  // errored", and checkout kept the client price on null — so a transient (or
  // induced) failure left the browser's number standing as the charge.
  assert.match(
    cat,
    /export async function resolveRetailChargeCentavos/,
    'the miss/error-separating retail resolver is gone',
  );
  assert.match(
    cat,
    /export async function resolveBundleChargeResolution/,
    'the miss/error-separating bundle resolver is gone',
  );
  for (const fn of ['resolveRetailChargeCentavos', 'resolveBundleChargeResolution']) {
    const at = cat.indexOf(`export async function ${fn}`);
    const body = cat.slice(at, at + 2000);
    assert.match(body, /status: 'error'/, `${fn} must be able to report a read error`);
    assert.match(body, /status: 'not_in_catalog'/, `${fn} must report a miss distinctly`);
  }
  const authority = read('lib/order-charge-authority.ts');
  assert.match(
    authority,
    /status === 'error'[\s\S]{0,120}?refusal: 'read_error'/,
    'a catalog read error must REFUSE the sale, never fall back to the posted price',
  );
});

test('checkout writes the server-resolved base, not the posted one', () => {
  const src = read(CHECKOUT_ACTIONS);
  assert.match(
    src,
    /requested_total_php:\s*originalPriceForOrderTotal/,
    'the stored amount must be the server-resolved base',
  );
  assert.match(
    src,
    /const originalPriceForOrderTotal = orderTotalToPhp\(chargeTotal\)/,
    'originalPriceForOrderTotal must derive from the branded authority total',
  );
  const resolver = src.indexOf('resolveOrderChargeCentavos(');
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
    // Either service-role constructor satisfies this — `createMoneyWriterClient`
    // IS `createAdminClient` plus a refusal of the dev anon fallback. Pinning one
    // identifier made a legitimate refactor read as a regression.
    /const \{ data: orderRow, error: oErr \} = await (admin|createMoneyWriterClient\(\))\s*\n\s*\.from\('orders'\)/,
    'the admin mint must go through a service-role client, not the caller session',
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
    // Inline construction: `createAdminClient().from('orders').insert(…)` and
    // the money-writer equivalent. Without this the trailing-identifier regex
    // below sees a `)` and reports `<unresolved>`, which reads as an offender.
    const inline = SERVICE_ROLE_CONSTRUCTORS.find((c) => before.endsWith(`${c}()`));
    if (inline) {
      out.push(`${inline}()`);
      continue;
    }
    const id = /([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(before);
    out.push(id ? id[1]! : '<unresolved>');
  }
  return out;
}

/**
 * The two constructors that yield a service-role client. `createMoneyWriterClient`
 * IS `createAdminClient` plus a refusal of the dev anon-key fallback — so it is
 * service-role by construction, and both satisfy the two tests below.
 */
const SERVICE_ROLE_CONSTRUCTORS = ['createAdminClient', 'createMoneyWriterClient'] as const;

/** Is `id` bound in this file to a service-role client? */
function isServiceRoleClient(src: string, id: string): boolean {
  const inline = SERVICE_ROLE_CONSTRUCTORS.some((c) => id === `${c}()`);
  if (inline) return true;
  const bind = new RegExp(`\\bconst\\s+${id}\\s*=\\s*(await\\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\(`).exec(src);
  return SERVICE_ROLE_CONSTRUCTORS.includes(
    (bind?.[2] ?? '') as (typeof SERVICE_ROLE_CONSTRUCTORS)[number],
  );
}

/** …and is it the MONEY writer specifically (the one that refuses the fallback)? */
function isMoneyWriterClient(src: string, id: string): boolean {
  if (id === 'createMoneyWriterClient()') return true;
  const bind = new RegExp(`\\bconst\\s+${id}\\s*=\\s*(await\\s+)?([A-Za-z_$][A-Za-z0-9_$]*)\\s*\\(`).exec(src);
  return bind?.[2] === 'createMoneyWriterClient';
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
      // built by it satisfies this test for the same reason. `guestOrderRowFor`
      // is the account-less sibling: there is no `auth.uid()` to stamp, so it
      // stamps the OWNER AXIS instead (a claimed seat or a guest-QR identity)
      // and refuses to build a payload at all when neither resolved — the same
      // fail-closed guarantee, expressed against the only identity a guest has.
      if (/\b(orderRowFor|compOrderRowFor|guestOrderRowFor)\s*\(/.test(payload)) continue;
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

/**
 * Every statement that WRITES money — insert or delete, orders or payments.
 * Broader than `mintClients`, which only looks at `.insert`: DELETE on both
 * tables was revoked from the session roles too (migration 20271024090000), so
 * a delete degrades exactly as badly as a mint.
 */
function moneyWriteClients(src: string): Array<{ client: string; what: string }> {
  const out: Array<{ client: string; what: string }> = [];
  for (const table of ['orders', 'payments'] as const) {
    for (const verb of ['insert', 'delete'] as const) {
      const re = new RegExp(
        `\\.from\\(\\s*['"]${table}['"]\\s*\\)[\\s\\S]{0,80}?\\.${verb}\\b`,
        'g',
      );
      for (const m of [...src.matchAll(re)]) {
        const before = src.slice(0, m.index).trimEnd();
        const inline = SERVICE_ROLE_CONSTRUCTORS.find((c) => before.endsWith(`${c}()`));
        const id = /([A-Za-z_$][A-Za-z0-9_$]*)$/.exec(before);
        out.push({
          client: inline ? `${inline}()` : id ? id[1]! : '<unresolved>',
          what: `${table}.${verb}`,
        });
      }
    }
  }
  return out;
}

test('every money write uses the MONEY writer, not the degrading admin client', () => {
  // `createAdminClient()` falls back to the ANON key in `next dev` when
  // SUPABASE_SERVICE_ROLE_KEY is unset. That is right for a read — the page
  // renders with empty admin data instead of dying — and wrong for a write to
  // orders/payments, where INSERT and DELETE are both revoked from anon: the
  // statement fails with a bare 42501 that each action absorbs into its generic
  // "please try again". `createMoneyWriterClient()` refuses the fallback and
  // names the missing variable instead.
  //
  // This is a DX/diagnosability rule, not a security boundary — both clients are
  // service-role in production, where the fallback is not reachable at all. It
  // is enforced here so a future money write cannot quietly pick the degrading
  // client and reintroduce the baffling-afternoon failure mode.
  // Modules whose client is an INJECTED PARAMETER, not a local binding. They
  // cannot construct their own — the DB-replay tests pass a PGlite-backed client
  // in, and constructing internally would break that injection (it did: CI's
  // booking-fee-lock DB tests went red on exactly this). Their CALLERS are what
  // must pass the money writer, and those callers are scanned normally.
  const INJECTED_CLIENT_REVIEWED: Record<string, string> = {
    'lib/booking-fee-lock.server.ts':
      '`admin: SupabaseClient` is a parameter. Both production callers ' +
      '(app/dashboard/[eventId]/vendors/actions.ts and …/vendors/packages/actions.ts) pass ' +
      'createMoneyWriterClient(); tests/db passes its replay client.',
  };

  const offenders: string[] = [];
  const roots = ['app', 'lib'].map((d) => join(WEB, d)).filter((d) => existsSync(d));
  for (const root of roots) {
    for (const file of collectTs(root)) {
      const rel = relative(WEB, file);
      if (rel.endsWith('.test.ts')) continue;
      if (rel in INJECTED_CLIENT_REVIEWED) continue;
      const src = readFileSync(file, 'utf8');
      for (const { client, what } of moneyWriteClients(src)) {
        if (!isMoneyWriterClient(src, client)) {
          offenders.push(`${rel} → ${client}.${what}(…)`);
        }
      }
    }
  }

  // …and the exemption is not a blank cheque: the callers must actually pass it.
  for (const caller of [
    'app/dashboard/[eventId]/vendors/actions.ts',
    'app/dashboard/[eventId]/vendors/packages/actions.ts',
  ]) {
    const src = readFileSync(join(WEB, caller), 'utf8');
    if (!/collectBookingFeeAtLock\(\s*createMoneyWriterClient\(\)/.test(src)) {
      offenders.push(`${caller} → passes a non-money client into collectBookingFeeAtLock`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'a money write (orders/payments insert or delete) uses a client other than ' +
      'createMoneyWriterClient(). Use it so a missing SUPABASE_SERVICE_ROLE_KEY fails with a ' +
      'named error instead of a bare 42501 swallowed by the action\'s generic retry message.',
  );
});
