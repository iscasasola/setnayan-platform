import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getCoverageTaxonomy } from '@/lib/vendor-coverages';
import { parentsOfKind } from '@/lib/vendor-category-parents';
import { buildLeafIndex, EMPTY_LEAF_INDEX, type LeafIndex } from '@/lib/service-card-kind';
import { displayServiceLabel } from '@/lib/vendors';
import { asVendorTier, type VendorTier } from '@/lib/vendor-tier-caps';
import type { PlanCard, PlanHoldState } from '@/lib/service-plan-hold';

/**
 * service-plan-hold.server.ts — THE READS behind "Which services stay on" (`lib/service-plan-hold.ts` is the rule).
 *
 * 🔑 HONEST READS (the `reads-are-honest` pattern). A refused read is `unreadable`, never "nothing on hold" or "no
 * first booking yet": either of those, read wrongly, would tell a shop the wrong thing about money and bookings.
 *
 * 🔑 THE FIRST BOOKING IS READ, NEVER COUNTED. `vendor_first_booking_done(shop)` (migration 20271320474333) is the
 * one definition — a booking of this shop marked delivered — and the pick's write (`apply_service_plan_pick`) asks
 * the same function, so the screen and the write cannot disagree.
 */

export type FirstBooking = 'done' | 'not_yet' | 'unreadable';

export type StayOnShop = {
  vendorProfileId: string;
  ownerUserId: string;
  tier: VendorTier;
  pending: VendorTier | null;
  tierExpiresAt: string | null;
  verified: boolean;
  founder: boolean;
};

export type StayOnRead =
  | { status: 'ok'; shop: StayOnShop; cards: PlanCard[]; firstBooking: FirstBooking }
  | { status: 'unreadable' };

const HOLD_COLS = 'vendor_service_id,title,category,is_active,plan_hold,plan_hold_starts_on,created_at,branch_copy_of';

type CardRow = {
  vendor_service_id: string;
  title: string | null;
  category: string;
  is_active: boolean;
  plan_hold: string | null;
  plan_hold_starts_on: string | null;
  /** Set on a "Copy to another branch" card — it uses no card (owner 2026-11-14, item 10). */
  branch_copy_of?: string | null;
};

function asHold(raw: string | null): PlanHoldState {
  return raw === 'held' || raw === 'scheduled' ? raw : null;
}

async function liveLeaves(): Promise<LeafIndex> {
  try {
    return buildLeafIndex(await getCoverageTaxonomy());
  } catch {
    // The create gate falls back the same way (`currentLeafIndex` in services/actions.ts): legacy families only.
    return EMPTY_LEAF_INDEX;
  }
}

/** Each card as the picker sees it — families by `parentsOfKind`, the create gate's own function. */
export function toPlanCards(rows: readonly CardRow[], leaves: LeafIndex): PlanCard[] {
  return rows.map((r) => ({
    id: r.vendor_service_id,
    name: r.title?.trim() || displayServiceLabel(r.category),
    kind: r.category,
    families: parentsOfKind(r.category, leaves),
    live: r.is_active === true,
    hold: asHold(r.plan_hold),
    holdStartsOn: r.plan_hold_starts_on ? asVendorTier(r.plan_hold_starts_on) : null,
    branchCopy: Boolean(r.branch_copy_of),
  }));
}

/** The first booking, read from the one SQL definition. */
export async function readFirstBooking(admin: SupabaseClient, vendorProfileId: string): Promise<FirstBooking> {
  try {
    const { data, error } = await admin.rpc('vendor_first_booking_done', { p_vendor_profile_id: vendorProfileId });
    if (error || typeof data !== 'boolean') return 'unreadable';
    return data ? 'done' : 'not_yet';
  } catch {
    return 'unreadable';
  }
}

/**
 * Everything the screen and Today's line need for one shop. `supabase` is the supplier's session (their own cards,
 * through `vendor_services_manage`); `admin` asks the first-booking function, which is service_role only.
 */
export async function readStayOn(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<StayOnRead> {
  try {
    return await readStayOnOnce(supabase, admin, vendorProfileId);
  } catch {
    return { status: 'unreadable' };
  }
}

async function readStayOnOnce(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<StayOnRead> {
  const [shopRes, cardsRes, leaves, firstBooking] = await Promise.all([
    supabase
      .from('vendor_profiles')
      .select('vendor_profile_id,user_id,tier_state,pending_tier,tier_expires_at,verification_state,is_founder')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle(),
    supabase
      .from('vendor_services')
      .select(HOLD_COLS)
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: true }),
    liveLeaves(),
    readFirstBooking(admin, vendorProfileId),
  ]);
  if (shopRes.error || !shopRes.data || cardsRes.error) {
    console.error('[service-plan-hold] stay-on read unreadable', vendorProfileId, shopRes.error?.message ?? cardsRes.error?.message ?? 'no shop row');
    return { status: 'unreadable' };
  }
  const s = shopRes.data as {
    vendor_profile_id: string;
    user_id: string;
    tier_state: string | null;
    pending_tier: string | null;
    tier_expires_at: string | null;
    verification_state: string | null;
    is_founder: boolean | null;
  };
  return {
    status: 'ok',
    shop: {
      vendorProfileId: s.vendor_profile_id,
      ownerUserId: s.user_id,
      tier: asVendorTier(s.tier_state),
      pending: s.pending_tier ? asVendorTier(s.pending_tier) : null,
      tierExpiresAt: s.tier_expires_at,
      verified: s.verification_state === 'verified',
      founder: s.is_founder === true,
    },
    cards: toPlanCards((cardsRes.data ?? []) as CardRow[], leaves),
    firstBooking,
  };
}

/**
 * The plan-hold state of one shop's cards, for the supplier's own Services list. `null` = could not read — the list
 * then draws every card as it always has (its own switch), never "nothing on hold" as a claim.
 */
export async function readPlanHolds(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<Map<string, { hold: Exclude<PlanHoldState, null>; startsOn: VendorTier | null }> | null> {
  try {
    const { data, error } = await supabase
      .from('vendor_services')
      .select('vendor_service_id,plan_hold,plan_hold_starts_on')
      .eq('vendor_profile_id', vendorProfileId)
      .not('plan_hold', 'is', null);
    if (error) {
      console.error('[service-plan-hold] plan holds unreadable', vendorProfileId, error.message);
      return null;
    }
    const out = new Map<string, { hold: Exclude<PlanHoldState, null>; startsOn: VendorTier | null }>();
    for (const r of (data ?? []) as { vendor_service_id: string; plan_hold: string | null; plan_hold_starts_on: string | null }[]) {
      const hold = asHold(r.plan_hold);
      if (hold) out.set(r.vendor_service_id, { hold, startsOn: r.plan_hold_starts_on ? asVendorTier(r.plan_hold_starts_on) : null });
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * The name of a card this booking ask names that the PLAN holds — null when none is (or the read failed). The yes is
 * refused by the database either way; this lets the card offer the pick instead of Agree, and the sentence name it.
 */
export async function heldServiceOfAsk(
  supabase: SupabaseClient,
  eventVendorId: string,
): Promise<string | null> {
  try {
    const { data: ev, error } = await supabase
      .from('event_vendors')
      .select('marketplace_vendor_id,service_id,requested_service_ids')
      .eq('vendor_id', eventVendorId)
      .maybeSingle();
    if (error || !ev) return null;
    const row = ev as { marketplace_vendor_id: string | null; service_id: string | null; requested_service_ids: string[] | null };
    const ids = [row.service_id, ...(row.requested_service_ids ?? [])].filter((x): x is string => typeof x === 'string');
    if (!row.marketplace_vendor_id || ids.length === 0) return null;
    const { data: held, error: heldErr } = await supabase
      .from('vendor_services')
      .select('vendor_service_id,title,category')
      .eq('vendor_profile_id', row.marketplace_vendor_id)
      .eq('plan_hold', 'held')
      .in('vendor_service_id', ids)
      .limit(1);
    if (heldErr) {
      // The database still refuses the yes (`a_held_service_takes_no_booking`); only the sentence falls back.
      console.error('[service-plan-hold] held-service check unreadable', eventVendorId, heldErr.message);
      return null;
    }
    const first = (held ?? [])[0] as { title: string | null; category: string | null } | undefined;
    if (!first) return null;
    return first.title?.trim() || (first.category ? displayServiceLabel(first.category) : 'the service they asked for');
  } catch {
    return null;
  }
}
