import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOnboardingDiscountPct } from '@/lib/onboarding-discount-server';
import { isStoreShellRequest } from '@/lib/request-platform';
import { isWelcomeDiscountEnabled } from '@/lib/welcome-discount-flag';
import {
  countsAsPurchase,
  decideWelcome,
  setupPriceAppliesAtCreate,
  welcomeCentavos,
  NOT_A_PURCHASE_STATUSES,
  WELCOME_ELIGIBLE_SOURCES,
  type WelcomeDecision,
} from '@/lib/welcome-discount';
import { resolveOrderChargeCentavos, type OrderChargeAuthority } from '@/lib/order-charge-authority';
import { sealServerResolvedTotal } from '@/lib/order-charge-math';
import { SETNAYAN_AI_SKU } from '@/lib/setnayan-ai-event-pricing';

/**
 * welcome-discount.server.ts — the I/O half of the website-only welcome price
 * (`lib/welcome-discount.ts` holds the rule and why).
 *
 * 🔒 NOTHING HERE READS THE BROWSER. Who is buying comes from the session the
 * caller already verified; whether it is the app comes from the request's own
 * user-agent / client-type cookie (`isStoreShellRequest`, the shipped detector);
 * "first purchase" comes from the `orders` table. No form field can ask for it.
 */

/**
 * How many purchases has this account made? `null` = the read failed (the
 * regular price then stands — a discount is never granted on a guess).
 *
 * 🔑 THE ACCOUNT, NOT THE PLATFORM. Every order the account has — web, iOS,
 * Android, an App Store purchase (`lib/iap/fulfil.server.ts` writes a `paid`
 * order) — counts, so the welcome is once per account however they bought. An
 * app sign-up who has bought nothing still gets it the first time they buy on
 * the website. Supplier-billed rows (`vendor_profile_id` set) are a shop's
 * bills, not a couple's purchase, and are left out.
 */
export async function countAccountPurchases(userId: string): Promise<number | null> {
  try {
    const { data, error } = await createAdminClient()
      .from('orders')
      .select('status, requested_total_php, comp_grant_id')
      .eq('user_id', userId)
      .is('vendor_profile_id', null)
      .is('comp_grant_id', null)
      .gt('requested_total_php', 0)
      .not('status', 'in', `(${NOT_A_PURCHASE_STATUSES.join(',')})`)
      .limit(5);
    if (error) {
      // The regular price then stands — said, so a welcome that never applies is traceable.
      console.error('[welcome-discount] could not read the account’s orders:', error.message);
      return null;
    }
    // The filter above and `countsAsPurchase` say the same thing; the second
    // pass is the one the unit tests pin, so a drifted filter cannot widen it.
    return ((data ?? []) as Parameters<typeof countsAsPurchase>[0][]).filter(countsAsPurchase).length;
  } catch {
    return null;
  }
}

/**
 * The decision for the buyer on THIS request. `userId` null = no account yet
 * (an anonymous visitor on the create flow), which has bought nothing.
 */
export async function readWelcomeDecision(userId: string | null): Promise<WelcomeDecision> {
  const storeShell = await isStoreShellRequest();
  const enabled = isWelcomeDiscountEnabled();
  // Short-circuit before any read: the app and the switch decide most requests.
  if (storeShell || !enabled) return decideWelcome({ enabled, storeShell, paidOrders: 0, pct: 0 });
  const [paidOrders, pct] = await Promise.all([
    userId ? countAccountPurchases(userId) : Promise.resolve(0),
    fetchOnboardingDiscountPct(),
  ]);
  return decideWelcome({ enabled, storeShell, paidOrders, pct });
}

/** The row's deliberate set-up override, or null. A read error is "no override" — the house dial still applies. */
async function explicitOverridePhp(serviceKey: string): Promise<number | null> {
  try {
    const { data } = await createAdminClient()
      .from('platform_retail_catalog_v2')
      .select('onboarding_price_php')
      .eq('service_code', serviceKey)
      .maybeSingle();
    const raw = (data as { onboarding_price_php?: number | string | null } | null)?.onboarding_price_php;
    const n = raw == null ? NaN : Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

/**
 * The welcome charge for one checkout line, or null (the regular charge stands).
 *
 * `regular` is what `resolveOrderChargeCentavos` ALREADY resolved — the welcome
 * is that figure through the shipped set-up rule, never a price of its own, and
 * it is sealed only from an `ok` result. Overrides, like the create flow:
 *   • a catalogue row → its `onboarding_price_php` (not for a pax-priced total,
 *     whose row override describes no particular head-count);
 *   • Setnayan AI on its per-type ladder → that type's sign-up price, asked of
 *     the SAME authority in its `'onboarding'` context.
 */
export async function welcomeChargeFor(input: {
  decision: WelcomeDecision;
  serviceKey: string;
  eventId: string | null;
  regular: OrderChargeAuthority;
}): Promise<OrderChargeAuthority | null> {
  const { decision, serviceKey, eventId, regular } = input;
  if (decision.kind !== 'welcome' || !regular.ok) return null;
  if (!WELCOME_ELIGIBLE_SOURCES.has(regular.source)) return null;

  let explicit: number | null = null;
  if (regular.source === 'setnayan_ai_event_type' && serviceKey === SETNAYAN_AI_SKU) {
    const signup = await resolveOrderChargeCentavos({ serviceKey, eventId, priceContext: 'onboarding' });
    explicit = signup.ok && signup.source === 'setnayan_ai_event_type' ? Number(signup.total) / 100 : null;
  } else if (regular.source === 'retail_catalog' && !regular.volatile) {
    explicit = await explicitOverridePhp(serviceKey);
  }

  const cents = welcomeCentavos(regular.total, explicit, decision.pct);
  if (!(cents > 0) || cents >= Number(regular.total)) return null;
  return sealServerResolvedTotal(cents, 'welcome_first_purchase', {
    paxSnapshot: regular.paxSnapshot,
    volatile: regular.volatile,
  });
}

/**
 * May the CREATE FLOW (the onboarding services step and its one bill) quote and
 * charge the set-up price for this buyer? Switch OFF → yes, exactly as shipped;
 * switch ON → only on the account's welcome purchase (`setupPriceAppliesAtCreate`).
 * The card and the bill both ask THIS, so they cannot disagree.
 */
export async function setupPriceAppliesForCreateFlow(userId: string | null): Promise<boolean> {
  return setupPriceAppliesAtCreate(isWelcomeDiscountEnabled(), await readWelcomeDecision(userId));
}
