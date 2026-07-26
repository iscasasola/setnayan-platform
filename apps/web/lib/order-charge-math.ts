/**
 * order-charge-math.ts — the PURE half of the SEC-7 order-charge authority.
 *
 * Types, the branded total, and every decision that needs no I/O live here so
 * they are directly unit-testable (`lib/order-charge-authority.test.ts`) without
 * a database and without dragging `server-only` into the test process. The
 * async resolvers — the parts that actually read catalogs — live in
 * `lib/order-charge-authority.ts`, which re-exports everything below so callers
 * only ever need one import.
 *
 * Read the header of `order-charge-authority.ts` for the vulnerability this
 * closes. The short version: `submitOrderAction` seeded its charge from
 * `formData.get('original_centavos')` and kept it whenever no catalog row
 * resolved, which is every key in neither catalog — `SETNAYAN_AI_SUB` included.
 * ₱0.01 bought a 28-day AI subscription.
 */

// ─────────────────────────────────────────────────────────────────────────────
// The branded total
// ─────────────────────────────────────────────────────────────────────────────

declare const ORDER_TOTAL_BRAND: unique symbol;

/**
 * A FULLY-RESOLVED, FULLY-MULTIPLIED order total in centavos.
 *
 * The brand is a private `unique symbol`, so the type can only come out of the
 * constructors in THIS module — and, crucially, cannot be derived from another
 * one: `total * BigInt(n)` is a plain `bigint`, which will not type-check back
 * into an `OrderTotalCentavos`.
 *
 * That is what makes the 36× cycles² overcharge UNREPRESENTABLE rather than
 * merely absent. `setnayan-ai-subscribe.tsx` already ships `unit × cycles` as
 * the displayed `original_centavos`; checkout used to multiply by `cycles`
 * again. With the default 6-cycle preset that is 36×, and it was unreachable
 * only because the unit price was unresolvable — i.e. fixing SEC-7 is exactly
 * what would have armed it. Now a second multiply is a compile error.
 */
export type OrderTotalCentavos = bigint & { readonly [ORDER_TOTAL_BRAND]: true };

/** Plain-number escape hatch for the peso columns (`NUMERIC(12,2)`). */
export function orderTotalToPhp(total: OrderTotalCentavos): number {
  return Number(total) / 100;
}

// ─────────────────────────────────────────────────────────────────────────────
// Catalog read results — miss and error are DIFFERENT answers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A catalog price read. The split is the point: `resolvePaxPricedOrderCentavos`
 * returned `null` for BOTH "no row" and "the read failed", and checkout's
 * fallback on `null` was the client price — so a transient (or induced)
 * PostgREST failure on ANY SKU left the browser's number standing as the charge.
 */
export type CatalogChargeResolution =
  | { status: 'resolved'; is_pax_priced: boolean; centavos: number; pax: number | null }
  | { status: 'not_in_catalog' }
  | { status: 'error'; message: string };

export type BundleChargeResolution =
  | { status: 'resolved'; centavos: number }
  | { status: 'not_in_catalog' }
  | { status: 'error'; message: string };

// ─────────────────────────────────────────────────────────────────────────────
// The authority result
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which authoritative source produced the price. Recorded for audits.
 *
 * `'event_vendor_setnayan_service'` was a sixth member until 2026-07-26; it went
 * with the `setnayan_service__{category}` resolver (see below). This union is
 * TS-only — it is never persisted and has no DB enum or CHECK behind it — so
 * dropping the member is safe.
 */
export type ChargeSource =
  | 'retail_catalog'
  | 'package_catalog'
  | 'setnayan_ai_event_type'
  | 'setnayan_ai_subscription_unit';

export type ChargeRefusal =
  /** No resolver owns this service_key. A NEW key must fail the sale, never fall
   *  back to the browser — that is the whole of SEC-7. */
  | 'no_price_source'
  /** A resolver's read errored. Fail CLOSED: a checkout blocked for thirty
   *  seconds beats an order created at a client-supplied price. */
  | 'read_error'
  /** The per-user subscription needs a validated cycle count and did not get one. */
  | 'cycles_required';

export type OrderChargeAuthority =
  | {
      ok: true;
      /** The full amount to bill. Already includes any cycle multiplier. */
      total: OrderTotalCentavos;
      /** SEC-3 pax snapshot to freeze on the order row. Null for non-pax SKUs. */
      paxSnapshot: number | null;
      source: ChargeSource;
      /**
       * TRUE when the total legitimately moves after the page rendered (the pax
       * curve reads live headcount via `resolveLivePax`). The overcharge tripwire
       * skips these — see {@link chargeOverchargesDisplayedPrice}.
       */
      volatile: boolean;
    }
  | { ok: false; refusal: ChargeRefusal; detail?: string };

/**
 * THE ONLY constructor for a charge total, for the async resolvers next door.
 *
 * It takes a `number` of centavos on purpose: the input is a value READ FROM A
 * CATALOG, never the product of bigint arithmetic on an existing total. Combined
 * with the brand, that keeps "a total" and "something multiplied by a total"
 * permanently distinguishable.
 */
export function sealServerResolvedTotal(
  centavos: number,
  source: ChargeSource,
  opts: { paxSnapshot?: number | null; volatile?: boolean } = {},
): OrderChargeAuthority {
  if (!Number.isFinite(centavos) || centavos < 0) {
    return { ok: false, refusal: 'no_price_source', detail: `non-finite centavos: ${centavos}` };
  }
  return {
    ok: true,
    total: BigInt(Math.round(centavos)) as OrderTotalCentavos,
    paxSnapshot: opts.paxSnapshot ?? null,
    source,
    volatile: opts.volatile ?? false,
  };
}

/** Human copy for a refusal. Brand voice; never leaks internals to the buyer. */
export function refusalMessage(refusal: ChargeRefusal): string {
  switch (refusal) {
    case 'cycles_required':
      return 'Pick how many cycles to subscribe for.';
    case 'read_error':
      return 'We could not confirm the price for this right now. Please try again in a moment.';
    case 'no_price_source':
    default:
      return 'This service is not available to buy right now. Please pick it from your dashboard instead.';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 🚫 Non-catalog key shapes — REMOVED 2026-07-26
//
// `SETNAYAN_SERVICE_KEY_PREFIX = 'setnayan_service__'` and its
// `setnayanServiceCategoryFromKey` parser used to live here. They existed for
// exactly ONE caller: `resolveOrderChargeCentavos` step (5), which priced a
// "Setnayan booked as a vendor" order off the couple's own `event_vendors` row.
// Its last precedence tier was `event_vendors.total_cost_php` — a number the
// BUYER types into the Costing form — which is the same shape of bug as SEC-5
// (`events.event_type`). The owner deleted the purchase path rather than
// repricing it (2026-07-26: "all setnayan in app services are either on their
// exact location on the dashboard or on suites"), so the parser has no caller
// and no reason to exist. Setnayan services are ordinary admin-priced rows in
// `platform_retail_catalog_v2` and resolve at step (2).
//
// DO NOT reintroduce a key shape whose price comes from a customer-writable
// column. `lib/vendor-branches.ts` keeps a superficially similar convention
// (`vendor_additional_branch__{branch_id}`), but that one prices from
// `vendor_billing_catalog` — an admin table — which is the difference that
// matters.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// The SEC-7 key itself
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `SETNAYAN_AI_SUB` — total = admin-managed UNIT × validated cycle count.
 *
 * PURE (the catalog read is the caller's) precisely so the exploit chain can be
 * asserted without a database:
 *
 *     resolveAiSubTotal({ status: 'not_in_catalog' }, 6)   →   REFUSE
 *
 * That line is SEC-7. `SETNAYAN_AI_SUB` has no row in
 * `platform_retail_catalog_v2` in production; the old code responded by keeping
 * `formData.get('original_centavos')`, so `original_centavos=1` minted a ₱0.01
 * order that `cyclesFromAmount(0.01, null)` then turned into a full 28-day cycle.
 *
 * ⚠ NO HARDCODED ₱499 FALLBACK, deliberately. Owner rule 2026-06-14 — "every
 * price is admin-managed · never hardcoded in code" — and a fallback here would
 * simply be a second way for an unpriced SKU to become sellable. Until the
 * catalog row is seeded, this SKU cannot be bought. The surface is flag-gated and
 * has never sold an order, so that is the right default: pricing it is a product
 * decision for the owner, not something a security patch should decide.
 *
 * ⚠ THE ONLY PLACE `unit × cycles` HAPPENS anywhere in the codebase.
 *
 * @param unit    the catalog read for AI_SUB_SKU (miss and error are different)
 * @param cycles  the ALREADY-PARSED, already-clamped cycle count, or null if the
 *                caller could not parse one. Passing the raw form value is not
 *                possible — parsing lives with the caller that owns `parseCycles`,
 *                and this function never sees an unvalidated number.
 */
export function resolveAiSubTotal(
  unit: CatalogChargeResolution,
  cycles: number | null,
): OrderChargeAuthority {
  if (cycles === null || !Number.isInteger(cycles) || cycles < 1) {
    return { ok: false, refusal: 'cycles_required' };
  }
  if (unit.status === 'error') {
    return { ok: false, refusal: 'read_error', detail: unit.message };
  }
  if (unit.status === 'not_in_catalog' || unit.centavos <= 0) {
    return {
      ok: false,
      refusal: 'no_price_source',
      detail: 'SETNAYAN_AI_SUB has no admin-managed unit price',
    };
  }
  return {
    ok: true,
    total: (BigInt(Math.round(unit.centavos)) * BigInt(cycles)) as OrderTotalCentavos,
    paxSnapshot: null,
    source: 'setnayan_ai_subscription_unit',
    volatile: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The display cross-check (tripwire, never the price)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Would billing `total` OVERCHARGE a buyer who was shown `displayedCentavos`?
 *
 * `original_centavos` is no longer read for the charge anywhere. What remains
 * useful about it is as a ONE-WAY tripwire: the customer consented to the number
 * their screen showed, so the server resolving something HIGHER is a refusal.
 * This is the structural guard against the 36× cycles² class — client shows
 * ₱2,994, a double-multiply resolves ₱107,784, and we refuse instead of billing.
 *
 * It is one-way on purpose. Resolving LOWER than the display is legitimate (the
 * vendor-unlocked 3D Plan discount does exactly that) and the server value wins
 * regardless — so a posted value tampered DOWN only blocks the tamperer's own
 * checkout, which is not a vulnerability worth an error path.
 *
 * `volatile` results are exempt: the pax curve reads LIVE headcount
 * (`resolveLivePax`, SEC-3) specifically so a deflated `estimated_pax` cannot
 * lower the bill, which means an upward divergence from the rendered price there
 * is the feature working rather than a bug.
 */
export function chargeOverchargesDisplayedPrice(args: {
  total: OrderTotalCentavos;
  displayedCentavos: bigint | null;
  volatile: boolean;
}): boolean {
  const { total, displayedCentavos, volatile: isVolatile } = args;
  if (isVolatile) return false;
  if (displayedCentavos == null) return false;
  if (displayedCentavos <= 0n) return false; // nothing meaningful was displayed
  return (total as bigint) > displayedCentavos;
}
