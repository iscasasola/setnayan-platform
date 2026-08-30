import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveSetnayanAiPerEventPricingEnabled } from './integration-config';
import type { AiPriceContext } from './setnayan-ai-type-pricing';
import {
  SETNAYAN_AI_SKU,
  resolveSetnayanAiTypePricePhp,
  resolveSetnayanAiTierPricesResolution,
  type AiTierPricesResolution,
} from './setnayan-ai-event-pricing';
import { setnayanAiTierSkuForEventType } from './setnayan-ai-type-pricing';
import {
  comebackEligibleEventIds,
  comebackPricePhp,
  resolveUserComebackWindow,
} from './setnayan-ai-comeback-offer';
import { resolveComebackScopeForEvent } from './setnayan-ai-comeback-scope.server';

/**
 * setnayan-ai-server.ts — server-only resolution for Setnayan AI pricing.
 *
 * 🔒 Setnayan AI is PER EVENT (owner 2026-08-01: "it is per event").
 *
 * This module used to also host `getEventHostAiSubscription()`, the PER-USER
 * fan-out: it read every `event_members.member_type='couple'` row on an event and
 * took the LATEST `active_until` among those users' `user_ai_subscription` rows,
 * so one person's purchase unlocked all of their events. That entire path —
 * table, flag, resolver and reads — was removed on 2026-08-01. Nothing about
 * another event, or another co-host, may influence this event's entitlement.
 */

/* ── The price a host is SHOWN for Setnayan AI ───────────────────────────────
 * Lives HERE, not in lib/setnayan-ai-event-pricing.ts, for a concrete reason: it
 * must read the per-event-pricing switch, that switch lives in
 * lib/integration-config.ts, and integration-config pulls in `server-only`.
 * Importing it into the pricing module broke that module's own unit test
 * (`Cannot find module 'server-only'`) — it is deliberately free of server-only
 * imports so the tier ladder stays testable under `tsx --test`. This file already
 * declares `server-only`, so it is the right home. Same split as
 * r2-client-ref.ts / r2-client-ref.server.ts.
 */
/**
 * The price to SHOW a host for Setnayan AI — resolved through the SAME switch the
 * charge path uses, so the two can never disagree.
 *
 * ── WHY THIS EXISTS (2026-07-30) ────────────────────────────────────────────
 * The studio page used to call `resolveSetnayanAiTypePricePhp` directly and
 * UNGATED, while `lib/order-charge-authority.ts` takes the per-type branch only
 * when `resolveSetnayanAiPerEventPricingEnabled()` is true and otherwise falls
 * through to the flat `SETNAYAN_AI` retail row. With the flag OFF that is a
 * display/charge mismatch IN THE CUSTOMER'S DISFAVOUR: a `date` event (tier D)
 * was shown ₱99 and charged ₱1,499.
 *
 * The flag is ON in prod today, so the two currently agree — flipping it on is
 * what closed the gap. But that made the correctness of the price a property of a
 * SETTING rather than of the code, and the studio page's own comment asserted
 * "checkout re-resolves this same per-type amount server-side", which is only true
 * while the flag is on. Turning it off would silently re-open an overcharge while
 * that comment reassured the next reader.
 *
 * So the decision moves HERE, into one function both sides share: the flag still
 * chooses the MODEL, but it can no longer make the shown price and the charged
 * price disagree. Flag on ⇒ both per-type. Flag off ⇒ both flat.
 *
 * Returns 0 for Tier E (no vendors ⇒ Setnayan AI is not present) and 0 on an
 * unreadable read, which the caller renders as "no buy shown", never as "free".
 */
export async function resolveSetnayanAiDisplayPricePhp(
  client: SupabaseClient,
  eventType: string | null | undefined,
  /**
   * Which price to SHOW. Must match the context the charge path will use for
   * the same button, or the screen makes a promise checkout will not keep.
   * `onboarding` on the sign-up card; `regular` everywhere else.
   */
  context: AiPriceContext = 'regular',
): Promise<number> {
  if (await resolveSetnayanAiPerEventPricingEnabled()) {
    return resolveSetnayanAiTypePricePhp(client, eventType, context);
  }
  // Flag off — checkout will charge the flat SETNAYAN_AI row, so show exactly
  // that. Tier E still shows nothing: with no vendors there is no product to buy,
  // which is a product fact rather than a pricing one.
  if (setnayanAiTierSkuForEventType(eventType) === null) return 0;
  const { data } = await client
    .from('platform_retail_catalog_v2')
    .select('retail_price_php, onboarding_price_php')
    .eq('service_code', SETNAYAN_AI_SKU)
    .maybeSingle();
  const row = data as
    | { retail_price_php?: number | null; onboarding_price_php?: number | null }
    | null;
  const usable = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v) && v > 0;
  // Even with the per-type model off, the sign-up discount still applies —
  // otherwise the card would show the regular price and checkout would take
  // the cheaper one, which is the same disagreement in the other direction.
  if (context === 'onboarding' && usable(row?.onboarding_price_php)) {
    return row!.onboarding_price_php as number;
  }
  return usable(row?.retail_price_php) ? (row!.retail_price_php as number) : 0;
}

/**
 * Both of an event's tier prices, resolved through the SAME per-event-pricing
 * switch the charge path uses.
 *
 * 🔑 THE FLAG CHOOSES THE ROW, NOT THE RULE. With the switch ON an event is
 * priced from its own tier's row; with it OFF everything falls back to the flat
 * `SETNAYAN_AI` row. Either way the comeback price is the MIDPOINT of whichever
 * row applies, so the discount cannot disagree with the price it discounts —
 * the same reason `resolveSetnayanAiDisplayPricePhp` above exists.
 *
 * Tier A's SKU *is* `SETNAYAN_AI`, so passing a wedding type resolves the flat
 * row either way; the branch only matters for B/C/D types.
 */
export async function resolveSetnayanAiTierPricesForEvent(
  client: SupabaseClient,
  eventType: string | null | undefined,
): Promise<AiTierPricesResolution> {
  if (await resolveSetnayanAiPerEventPricingEnabled()) {
    return resolveSetnayanAiTierPricesResolution(client, eventType);
  }
  // Flag off — checkout charges the flat row, so the offer must be derived from
  // the flat row. Tier E still has no product, and `resolveSetnayanAiTierPrices
  // Resolution('wedding')` is exactly the flat-row read.
  if (setnayanAiTierSkuForEventType(eventType) === null) {
    return { status: 'resolved', prices: { band: 'E', retailPhp: 0, onboardingPhp: null } };
  }
  return resolveSetnayanAiTierPricesResolution(client, 'wedding');
}

export type SetnayanAiComebackDisplay = {
  regularPhp: number;
  comebackPhp: number;
  expiresAt: Date;
};

/**
 * The comeback-offer price to SHOW, or `null` when the event isn't eligible
 * (already owns AI, window lapsed, or no usable regular price to discount).
 *
 * DISPLAY ONLY — DO NOT CHARGE FROM THIS, same rule as
 * {@link resolveSetnayanAiDisplayPricePhp} above. The charge path re-derives
 * eligibility and the discounted centavos itself, straight from the stored
 * event row, in lib/order-charge-authority.ts — this function exists only so
 * the Home card can show a number, and it calls the SAME regular-price
 * resolver + the SAME discount math (`comebackPricePhp`) so the two can never
 * quote different figures.
 */
export async function resolveSetnayanAiComebackDisplayPhp(
  client: SupabaseClient,
  eventId: string,
  eventType: string | null | undefined,
  now: Date = new Date(),
): Promise<SetnayanAiComebackDisplay | null> {
  // The window is the USER's, so eligibility is decided across every event
  // their hosts own — not from the one event this page happens to be showing.
  const scope = await resolveComebackScopeForEvent(client, eventId);
  if (scope.status === 'read_error') return null; // a screen shows nothing; the
  // charge path REFUSES on the same read — see lib/order-charge-authority.ts.
  if (!comebackEligibleEventIds(scope.events, now).includes(eventId)) return null;
  const window = resolveUserComebackWindow(scope.events, now);
  if (!window?.active) return null;

  const priced = await resolveSetnayanAiTierPricesForEvent(client, eventType);
  if (priced.status === 'read_error') return null;
  // THE DERIVATION, not a percentage: half this row's own sign-up saving.
  const comebackPhp = comebackPricePhp({
    retailPhp: priced.prices.retailPhp,
    onboardingPhp: priced.prices.onboardingPhp,
  });
  if (comebackPhp == null) return null;
  return { regularPhp: priced.prices.retailPhp, comebackPhp, expiresAt: window.expiresAt };
}
