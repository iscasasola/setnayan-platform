import type { SupabaseClient } from '@supabase/supabase-js';
import { ADD_ON_SKU_MAP } from './add-on-stats';
import { BUNDLE_CHILD_SKUS } from '@/lib/entitlements';

// Canonical V2 SKU that a bundle (GUIDED_PACK / MEDIA_PACK) grants for each
// add-on FEATURE, used by the bundle-aware launch check below. Only features a
// bundle actually includes need an entry (mirrors V1_TO_V2_SKU_MAP, e.g.
// panood_daily_broadcast → PANOOD_SYSTEM). PR4d: a Complete (MEDIA_PACK) buyer
// gets ONE bundle-keyed order, not an à-la-carte SKU order, so without this the
// couple-facing Panood surfaces (add-on page / galleries / launch hub) never
// flip to 'launch' and the couple can't start a livestream they paid for.
const FEATURE_BUNDLE_SKU: Readonly<Record<string, string>> = {
  panood: 'PANOOD_SYSTEM',
};

// Resolves the App Store-style hero CTA state for an add-on detail page.
// One of:
//   • 'add'           — no active order for this event+feature.
//                       Hero shows the "Choose plan" sheet.
//   • 'request_sent'  — order submitted but admin hasn't confirmed payment.
//                       Hero shows a disabled "Request sent" chip pointing
//                       at the order detail page so the couple can check
//                       the reference code / payment status.
//   • 'launch'        — order paid/fulfilled. Hero shows "Launch" linking
//                       to the per-feature setup surface (e.g. /setup for
//                       Panood, or the feature itself for Mood Board).
//   • 'blocked'       — admin policy (or per-event override) disables the
//                       feature for this account type. Hero shows a
//                       disabled "Blocked" pill with the admin reason.
//   • 'expired'       — the event is expired (wedding_date + grace OR
//                       archived). Hero shows "Expired".
//
// Resolution precedence (highest first):
//   expired > blocked > launch > request_sent > add

export type AddOnState =
  | 'add'
  | 'request_sent'
  | 'launch'
  | 'blocked'
  | 'expired';

export type AddOnStateContext = {
  state: AddOnState;
  // Where to send the user when the hero CTA is clickable. null for
  // disabled states (blocked, expired) and for 'add' (which opens a
  // client-side sheet).
  href: string | null;
  // For request_sent: the public_id of the pending order so the chip can
  // surface "Reference O-xxxx".
  pendingOrderPublicId: string | null;
  // For blocked: human-readable reason set by admin.
  blockReason: string | null;
  // For expired: the calendar date the event hit grace cutoff.
  expiredAt: string | null;
};

// Days of post-wedding tail before a feature flips to "expired". Sized to
// cover reels download, review window, photo gallery viewing.
const EXPIRATION_GRACE_DAYS = 90;

export type AccountTypeForPolicy =
  | 'couple'
  | 'vendor_coming_soon'
  | 'vendor_certified';

type EventLifecycleRow = {
  event_date: string | null;
  archived: boolean | null;
};

type FeaturePolicyRow = {
  enabled_for_couples: boolean;
  enabled_for_vendors_coming_soon: boolean;
  enabled_for_vendors_certified: boolean;
  block_reason_couples: string | null;
  block_reason_vendors_coming_soon: string | null;
  block_reason_vendors_certified: string | null;
};

type OverrideRow = {
  enabled: boolean;
  reason: string | null;
};

type OrderRow = {
  status: string;
  public_id: string;
  service_key: string | null;
};

export async function resolveAddOnState(
  supabase: SupabaseClient,
  eventId: string,
  featureKey: string,
  accountType: AccountTypeForPolicy = 'couple',
  setupHref?: string,
): Promise<AddOnStateContext> {
  const skus = ADD_ON_SKU_MAP[featureKey] ?? [];

  // Bundle-aware ownership (PR4d): add the bundle code(s) that grant this
  // feature's canonical SKU so a bundle buyer's single bundle-keyed order is
  // matched too. Only the bundles that ACTUALLY include it — Panood is in
  // MEDIA_PACK but NOT GUIDED_PACK, so an Essentials buyer is never over-granted
  // Panood. The existing paid/fulfilled vs submitted gating then treats a bundle
  // exactly like an à-la-carte order: paid bundle → launch, submitted bundle →
  // request_sent, refunded/cancelled bundle → re-locks (out of paid/fulfilled).
  const bundleSku = FEATURE_BUNDLE_SKU[featureKey];
  const grantingBundles = bundleSku
    ? (Object.keys(BUNDLE_CHILD_SKUS) as Array<keyof typeof BUNDLE_CHILD_SKUS>).filter((b) =>
        BUNDLE_CHILD_SKUS[b].includes(bundleSku),
      )
    : [];
  const ownershipSkus = [...skus, ...grantingBundles];

  const eventQuery = supabase
    .from('events')
    .select('event_date, archived')
    .eq('event_id', eventId)
    .maybeSingle();

  const policyQuery = supabase
    .from('feature_policy')
    .select(
      'enabled_for_couples, enabled_for_vendors_coming_soon, enabled_for_vendors_certified, block_reason_couples, block_reason_vendors_coming_soon, block_reason_vendors_certified',
    )
    .eq('feature_key', featureKey)
    .maybeSingle();

  const overrideQuery = supabase
    .from('event_feature_policy_override')
    .select('enabled, reason')
    .eq('event_id', eventId)
    .eq('feature_key', featureKey)
    .maybeSingle();

  const ordersQuery =
    ownershipSkus.length === 0
      ? Promise.resolve({ data: [] as OrderRow[], error: null })
      : supabase
          .from('orders')
          .select('status, public_id, service_key')
          .eq('event_id', eventId)
          .in('service_key', ownershipSkus)
          .order('created_at', { ascending: false })
          .limit(20);

  const [eventRes, policyRes, overrideRes, ordersRes] = await Promise.all([
    eventQuery,
    policyQuery,
    overrideQuery,
    ordersQuery,
  ]);

  const event = (eventRes.data ?? null) as EventLifecycleRow | null;
  const policy = (policyRes.data ?? null) as FeaturePolicyRow | null;
  const override = (overrideRes.data ?? null) as OverrideRow | null;
  const orders = (ordersRes.data ?? []) as OrderRow[];

  // ----- 1. expired ---------------------------------------------------------
  const expired = computeExpiration(event);
  if (expired) {
    return {
      state: 'expired',
      href: null,
      pendingOrderPublicId: null,
      blockReason: null,
      expiredAt: expired.expiredAt,
    };
  }

  // ----- 2. blocked ---------------------------------------------------------
  const block = computeBlock(policy, override, accountType);
  if (block.blocked) {
    return {
      state: 'blocked',
      href: null,
      pendingOrderPublicId: null,
      blockReason: block.reason,
      expiredAt: null,
    };
  }

  // ----- 3. launch ----------------------------------------------------------
  const fulfilledOrder = orders.find(
    (o) => o.status === 'paid' || o.status === 'fulfilled',
  );
  if (fulfilledOrder) {
    return {
      state: 'launch',
      href: setupHref ?? null,
      pendingOrderPublicId: null,
      blockReason: null,
      expiredAt: null,
    };
  }

  // ----- 4. request_sent ----------------------------------------------------
  const pendingOrder = orders.find(
    (o) => o.status === 'submitted' || o.status === 'awaiting_payment',
  );
  if (pendingOrder) {
    return {
      state: 'request_sent',
      href: `/dashboard/${eventId}/orders/${pendingOrder.public_id}`,
      pendingOrderPublicId: pendingOrder.public_id,
      blockReason: null,
      expiredAt: null,
    };
  }

  // ----- 5. add (default) ---------------------------------------------------
  return {
    state: 'add',
    href: null,
    pendingOrderPublicId: null,
    blockReason: null,
    expiredAt: null,
  };
}

function computeExpiration(event: EventLifecycleRow | null): {
  expiredAt: string;
} | null {
  if (!event) return null;
  if (event.archived) {
    return { expiredAt: 'archived' };
  }
  if (!event.event_date) return null;
  const eventDate = new Date(event.event_date);
  if (Number.isNaN(eventDate.getTime())) return null;
  const cutoff = new Date(eventDate);
  cutoff.setDate(cutoff.getDate() + EXPIRATION_GRACE_DAYS);
  if (cutoff.getTime() < Date.now()) {
    return { expiredAt: cutoff.toISOString().slice(0, 10) };
  }
  return null;
}

function computeBlock(
  policy: FeaturePolicyRow | null,
  override: OverrideRow | null,
  accountType: AccountTypeForPolicy,
): { blocked: boolean; reason: string | null } {
  // Per-event override wins outright if present.
  if (override) {
    return override.enabled
      ? { blocked: false, reason: null }
      : { blocked: true, reason: override.reason };
  }
  // No policy row at all → permissive (matches the seed default).
  if (!policy) return { blocked: false, reason: null };

  switch (accountType) {
    case 'couple':
      return policy.enabled_for_couples
        ? { blocked: false, reason: null }
        : { blocked: true, reason: policy.block_reason_couples };
    case 'vendor_coming_soon':
      return policy.enabled_for_vendors_coming_soon
        ? { blocked: false, reason: null }
        : { blocked: true, reason: policy.block_reason_vendors_coming_soon };
    case 'vendor_certified':
      return policy.enabled_for_vendors_certified
        ? { blocked: false, reason: null }
        : { blocked: true, reason: policy.block_reason_vendors_certified };
  }
}

// Helper for the events-switcher sort: returns TRUE when an event has
// passed the grace cutoff (or is archived). Exported so the dashboard
// layout can partition active/expired without re-implementing the rule.
export function isEventExpired(event: {
  event_date: string | null;
  archived?: boolean | null;
}): boolean {
  return computeExpiration({
    event_date: event.event_date,
    archived: event.archived ?? null,
  }) !== null;
}
