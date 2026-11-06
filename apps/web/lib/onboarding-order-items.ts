/**
 * onboarding-order-items.ts — what ONE onboarding services order covers.
 *
 * The onboarding step can sell three things at once (a Papic Pool rung, N
 * dedicated Papic One cameras, Setnayan AI) and they are billed as a SINGLE
 * order, so the couple gets one total, one QR, one reference and one approval
 * (owner 2026-08-11). This module is the one place that answers "what is on that
 * bill?", and it has exactly three server-side readers (plus the payer's own, at
 * the bottom), each of which would otherwise assume
 * one-product-per-order and be wrong:
 *
 *   1. ACTIVATION  — fans out over the items, running each child's own hook.
 *   2. REVERSAL    — decides whether a refunded bill was granting Setnayan AI.
 *   3. OWNERSHIP   — answers "does this event own X?" for a SKU bought in a basket.
 *
 * 🔑 ALL THREE MUST USE THIS, NOT A LIST OF THEIR OWN. The static
 * `bundle_components` map is what the fixed packs use, and copying that pattern
 * per-reader is what let a refunded bundle keep Setnayan AI switched on before
 * the reversal path learned about bundles. One reader, three call sites.
 *
 * ⚠ NOT client-safe by construction, but deliberately NOT marked `server-only`
 * either: `lib/entitlements.ts` imports it and is itself imported by surfaces
 * that a `server-only` edge would break at build time rather than at the real
 * boundary. It touches no admin client of its own — every function takes the
 * caller's Supabase client — so it inherits whatever authority the caller has.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The service_key an onboarding basket order carries.
 *
 * Deliberately NOT a row in `platform_retail_catalog_v2`: it has no price of its
 * own. Its total is the sum of its items, each priced by its own authority at
 * mint time, and `resolveOrderChargeCentavos` would refuse it — which is
 * correct, because nothing should ever be able to quote "a basket" generically.
 */
export const ONBOARDING_SERVICES_SKU = 'ONBOARDING_SERVICES';

export type OnboardingOrderItem = {
  serviceCode: string;
  quantity: number;
  unitPricePhp: number;
};

/**
 * Everything one basket order covers. Empty for any ordinary single-product
 * order, which is what makes every caller safe to call unconditionally.
 *
 * Returns [] on a read ERROR too — and that is a deliberate, load-bearing
 * choice per caller:
 *   • activation → grants nothing, leaving a paid order an admin can re-run.
 *     The alternative (guessing at contents) would provision the wrong thing.
 *   • ownership  → does not confer. Failing CLOSED on a read error is the rule
 *     everywhere else in entitlements.
 * A read error is indistinguishable from an empty basket here ON PURPOSE; the
 * distinction that matters is logged by the caller, not encoded in the value.
 */
export async function readOnboardingOrderItems(
  db: SupabaseClient,
  orderId: string,
): Promise<OnboardingOrderItem[]> {
  if (!orderId) return [];
  const { data, error } = await db
    .from('onboarding_order_items')
    .select('service_code, quantity, unit_price_php')
    .eq('order_id', orderId);
  if (error || !Array.isArray(data)) {
    if (error) {
      console.error('[onboarding-order-items] read failed:', error.message);
    }
    return [];
  }
  return data
    .map((r) => ({
      serviceCode: typeof r.service_code === 'string' ? r.service_code : '',
      quantity: Number.isFinite(r.quantity) ? Math.max(1, Math.trunc(r.quantity as number)) : 1,
      unitPricePhp: Number.isFinite(Number(r.unit_price_php)) ? Number(r.unit_price_php) : 0,
    }))
    .filter((i) => i.serviceCode.length > 0);
}

/**
 * Order ids (for this event) whose BASKET includes `serviceCode`, together with
 * each order's status so the caller can apply its own liveness rule.
 *
 * Scoped to the event on purpose: an unscoped lookup would let one couple's
 * basket confer a SKU on another couple's event — the same shape as the
 * cross-event hole that `papic_grant_camera_points` had to close.
 */
export async function eventBasketOrdersGranting(
  db: SupabaseClient,
  eventId: string,
  serviceCode: string,
): Promise<Array<{ orderId: string; status: string }>> {
  if (!eventId || !serviceCode) return [];
  // 🔑 AN RPC, NOT A TABLE READ. `onboarding_order_items` is deliberately
  // unreadable by `anon` and `authenticated` — RLS on, zero policies, grants
  // revoked — because it is a bill's contents
  // (`tests/db/onboarding-basket-one-bill.db.test.ts` fails if that ever
  // changes). Reading it directly from a couple's page produced a 42501 on
  // every hit since 2026-08-11, and this function's own `return []` turned that
  // refusal into "does not own it", so a couple who had PAID for Setnayan AI
  // inside a basket was invited to buy it again.
  //
  // `public.event_basket_orders_granting` is SECURITY DEFINER and checks the
  // caller itself — the couple on this event via `current_couple_event_ids()`,
  // an admin, or service_role — so the table stays shut and the question still
  // gets a truthful answer. It resolves the COUPLE, not any event member: an
  // invited guest must not see what the couple was billed.
  const { data, error } = await db.rpc('event_basket_orders_granting', {
    p_event_id: eventId,
    p_service_code: serviceCode,
  });
  if (error || !Array.isArray(data)) {
    if (error) {
      console.error('[onboarding-order-items] ownership read failed:', error.message);
    }
    return [];
  }
  return (data as Array<{ order_id?: unknown; status?: unknown }>).map((r) => ({
    orderId: String(r.order_id ?? ''),
    status: typeof r.status === 'string' ? r.status : '',
  }));
}

/** One line of a basket bill, with the name the payer knows it by. */
export type BasketLine = OnboardingOrderItem & {
  /** The catalog's customer-facing name, or null when the catalog has none. */
  title: string | null;
};

/**
 * What a basket bill lists — as answered for the PERSON LOOKING AT IT.
 *
 * The fourth reader, and the only one that runs on the payer's own session:
 * `/pay/[reference]` (`lib/payable-by-reference.ts`). It cannot use
 * `readOnboardingOrderItems` above, because that one reads the TABLE, and the
 * table is shut to every session role on purpose
 * (`tests/db/onboarding-basket-one-bill.db.test.ts`). Measured 2026-10-13 by the
 * Papic end-to-end tester: every /pay render logged "permission denied for
 * table onboarding_order_items", and the `[]` that came back drew a sign-up
 * bill — Papic + Setnayan AI + Pro on one reference — with no lines under its
 * total.
 *
 * 🔑 SO THIS ASKS `public.order_basket_lines`, a SECURITY DEFINER function that
 * checks the caller itself (the order's buyer, the couple on its event, an
 * admin, the server client) — the same shape as `eventBasketOrdersGranting`.
 * It also returns each line's catalog title, so the page needs no second read.
 *
 * ⚠ A FAILED READ IS `{ ok: false }`, NEVER `[]`. Unlike the activation and
 * ownership readers above — where failing to an empty list is the safe,
 * deliberate choice — a payer shown an empty bill is told something false. The
 * page says the list could not be loaded instead (owner rule: a failure never
 * renders like emptiness).
 */
export async function readBasketLinesForPayer(
  db: SupabaseClient,
  orderId: string,
): Promise<{ ok: true; lines: BasketLine[] } | { ok: false }> {
  if (!orderId) return { ok: true, lines: [] };
  const { data, error } = await db.rpc('order_basket_lines', { p_order_id: orderId });
  if (error || !Array.isArray(data)) {
    console.error(
      '[onboarding-order-items] payer bill read failed:',
      error?.message ?? 'no rows array',
    );
    return { ok: false };
  }
  const lines = (
    data as Array<{
      service_code?: unknown;
      title?: unknown;
      quantity?: unknown;
      unit_price_php?: unknown;
    }>
  )
    .map((r) => {
      const q = Number(r.quantity);
      const p = Number(r.unit_price_php);
      const title = typeof r.title === 'string' ? r.title.trim() : '';
      return {
        serviceCode: typeof r.service_code === 'string' ? r.service_code : '',
        title: title.length > 0 ? title : null,
        quantity: Number.isFinite(q) ? Math.max(1, Math.trunc(q)) : 1,
        unitPricePhp: Number.isFinite(p) ? p : 0,
      };
    })
    .filter((l) => l.serviceCode.length > 0);
  return { ok: true, lines };
}
