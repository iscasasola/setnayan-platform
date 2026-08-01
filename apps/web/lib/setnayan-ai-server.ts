import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveSetnayanAiPerEventPricingEnabled } from './integration-config';
import {
  SETNAYAN_AI_SKU,
  resolveSetnayanAiTypePricePhp,
} from './setnayan-ai-event-pricing';
import { setnayanAiTierSkuForEventType } from './setnayan-ai-type-pricing';

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
): Promise<number> {
  if (await resolveSetnayanAiPerEventPricingEnabled()) {
    return resolveSetnayanAiTypePricePhp(client, eventType);
  }
  // Flag off — checkout will charge the flat SETNAYAN_AI row, so show exactly
  // that. Tier E still shows nothing: with no vendors there is no product to buy,
  // which is a product fact rather than a pricing one.
  if (setnayanAiTierSkuForEventType(eventType) === null) return 0;
  const { data } = await client
    .from('platform_retail_catalog_v2')
    .select('retail_price_php')
    .eq('service_code', SETNAYAN_AI_SKU)
    .maybeSingle();
  const flat = (data as { retail_price_php?: number | null } | null)?.retail_price_php;
  return typeof flat === 'number' && Number.isFinite(flat) && flat > 0 ? flat : 0;
}
