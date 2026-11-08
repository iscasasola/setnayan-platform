import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { readShopBookedLoopCount } from '@/lib/shop-booked-loops.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { grantOwedBadgeUpgrades, readBadgeUpgrades, type UpgradeSweep } from '@/lib/badge-upgrades.server';
import { fetchPublicVendorBranches } from '@/lib/vendor-branches';
import { fetchShopGiftPacks } from '@/lib/shop-gifts.server';
import { alwaysAllowedPack } from '@/lib/shop-gifts';
import { AWARD_LABELS, currentPeriodMonth, type SpotlightAwardType } from '@/lib/spotlight-awards';
import type { ShopBadgeFacts } from '@/lib/shop-badges';
import {
  FALLBACK_REWARD_NAMES,
  rewardsOwed,
  type BadgeRewardFacts,
  type BadgeRewardKind,
  type GrantedReward,
  type RewardNames,
  type TrackerRewardInput,
} from '@/lib/badge-rewards';

/**
 * 🏅🎁 BADGE REWARDS — the I/O half of `lib/badge-rewards.ts` (owner 2026-11-05).
 *
 *   readBadgeRewardFacts   what the shop's MEASURED badges count today (null = unread → nothing is granted for it)
 *   grantOwedBadgeRewards  pays every earned step not yet paid, through the ONE door `shop_badge_reward_grant`
 *                          (exactly once per (shop, reward_key) — the database refuses a second)
 *   readGrantedRewards     what the shop was given, with each free booking fee's history
 *
 * 🔑 WHEN A REWARD IS GRANTED: badges are not stored — they are worked out live from real counts — so "earning" one is
 * the moment a read finds it. `readBadgeRewardTracker` (the badge page) and Today run the grant sweep; the admin's
 * manual award runs it for that shop. A step reached and lost and reached again is the SAME key: it never pays twice.
 *
 * Every function here takes the SERVICE-ROLE client, called only after the caller proved `vendorProfileId` is the
 * signed-in supplier's own shop (or the caller is an admin).
 */

/** Spotlight award titles → their type, for the tracker's award rows. */
export const AWARD_TYPE_BY_TITLE: Readonly<Record<string, SpotlightAwardType>> = Object.fromEntries(
  (Object.entries(AWARD_LABELS) as Array<[SpotlightAwardType, string]>).map(([type, label]) => [label, type]),
);

/**
 * What the shop's measured badges count. `badge` = the facts `readShopBadgeFacts` already read for the same page
 * (verified · completed events · trusted reviews), so nothing is read twice.
 */
export async function readBadgeRewardFacts(
  admin: SupabaseClient,
  vendorProfileId: string,
  badge: Pick<ShopBadgeFacts, 'verified' | 'completedEvents' | 'trusted'>,
): Promise<BadgeRewardFacts> {
  const [sourced, branches, serviceCards, inspirationPhotos, awards, bookedLoops] = await Promise.all([
    // Setnayan-sourced bookings — the ledger the fee itself keeps (attribution 'sourced', made at the lock).
    admin
      .from('booking_fee_ledger')
      .select('event_id')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('source', 'lock')
      .eq('attribution', 'sourced')
      .limit(2000)
      .then(({ data, error }) => {
        if (error) {
          logQueryError('badgeRewards.sourced', error, { vendorProfileId }, 'graceful_degrade');
          return null;
        }
        return new Set(((data ?? []) as Array<{ event_id: string | null }>).map((r) => r.event_id).filter((e): e is string => !!e));
      }),
    // Branches: the shop's rows first (a refused read is null, never "no branches"), then the paid-and-live ones.
    admin
      .from('vendor_branches')
      .select('branch_id')
      .eq('parent_vendor_profile_id', vendorProfileId)
      .is('cancelled_at', null)
      .then(async ({ data, error }) => {
        if (error) {
          logQueryError('badgeRewards.branches', error, { vendorProfileId }, 'graceful_degrade');
          return null;
        }
        if ((data ?? []).length === 0) return [] as string[];
        return (await fetchPublicVendorBranches(admin, vendorProfileId)).map((b) => b.branchId);
      }),
    // Service cards (owner-approved ladder 3·6·10·20, 8 Nov): the shop's live cards — active and not link-only, the
    // same "a card the shop sells" the calendar and the check-a-date reads use. A refused read is null, never 0.
    admin
      .from('vendor_services')
      .select('vendor_service_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true)
      .eq('is_linked_only', false)
      .then(({ count, error }) => {
        if (error || count === null || count === undefined) {
          logQueryError('badgeRewards.serviceCards', error ?? { message: 'no count' }, { vendorProfileId }, 'graceful_degrade');
          return null;
        }
        return count;
      }),
    // Inspiration box (ladder 10·25·50·100·250, 8 Nov): approved, live inspiration photos — the shop page's own
    // predicates (`fetchShopInspirationLooks`, lib/shop-inspiration.server.ts), counted, never listed.
    admin
      .from('moodboard_library_assets')
      .select('asset_id', { count: 'exact', head: true })
      .eq('vendor_profile_id', vendorProfileId)
      .eq('asset_type', 'supplier_gallery')
      .not('approved_at', 'is', null)
      .is('retired_at', null)
      .is('rejected_at', null)
      .then(({ count, error }) => {
        if (error || count === null || count === undefined) {
          logQueryError('badgeRewards.inspiration', error ?? { message: 'no count' }, { vendorProfileId }, 'graceful_degrade');
          return null;
        }
        return count;
      }),
    admin
      .from('vendor_spotlight_awards')
      .select('award_type, period_month')
      .eq('vendor_profile_id', vendorProfileId)
      .then(({ data, error }) => {
        if (error) {
          logQueryError('badgeRewards.awards', error, { vendorProfileId }, 'graceful_degrade');
          return null;
        }
        return ((data ?? []) as Array<{ award_type: SpotlightAwardType; period_month: string }>).map((a) => ({
          type: a.award_type,
          periodMonth: String(a.period_month),
        }));
      }),
    // 🔁 Booked Loop (THE ONE BUILD spec §9 #11): C2's counter, on the admin client (service_role only). null = unread.
    readShopBookedLoopCount(admin, vendorProfileId),
  ]);

  const trustedCount = badge.trusted ? Number(badge.trusted.trusted_review_count ?? 0) : null;
  return {
    verified: badge.verified,
    completedEvents: badge.completedEvents,
    trustedReviews: trustedCount !== null && Number.isFinite(trustedCount) ? trustedCount : null,
    firstSourcedBooking: sourced === null ? null : sourced.size > 0,
    branchIds: branches,
    serviceCards,
    inspirationPhotos,
    awards,
    bookedLoops,
  };
}

/** The products' names from the live catalogue (the smallest Papic pack, Event Plus, Event Pro). */
export async function readRewardNames(admin: SupabaseClient): Promise<RewardNames> {
  const packs = await fetchShopGiftPacks(admin);
  if (!packs) return FALLBACK_REWARD_NAMES;
  return {
    papic: alwaysAllowedPack(packs)?.title ?? FALLBACK_REWARD_NAMES.papic,
    event_plus: packs.find((p) => p.kind === 'event_plus')?.title ?? FALLBACK_REWARD_NAMES.event_plus,
    event_pro: packs.find((p) => p.kind === 'event_pro')?.title ?? FALLBACK_REWARD_NAMES.event_pro,
  };
}

export type GrantSweep = { granted: number; already: number; skipped: number; failed: number; upgrades?: UpgradeSweep };

/**
 * Pay every earned reward not yet paid — the gift-stock reward AND (owner, 6 Nov) the badge's 4-week personal upgrade
 * (`grantOwedBadgeUpgrades`, its own table), so every caller of this sweep gives both. Never throws.
 */
export async function grantOwedBadgeRewards(
  admin: SupabaseClient,
  vendorProfileId: string,
  facts: BadgeRewardFacts,
): Promise<GrantSweep> {
  const gifts = await grantOwedGiftRewards(admin, vendorProfileId, facts);
  return { ...gifts, upgrades: await grantOwedBadgeUpgrades(admin, vendorProfileId, facts) };
}

/**
 * The gift-stock half. A Papic reward is units × the SMALLEST pack's credits, read from the catalogue now — when the
 * catalogue cannot be read, Papic rewards wait for the next sweep (never a guessed size).
 */
async function grantOwedGiftRewards(
  admin: SupabaseClient,
  vendorProfileId: string,
  facts: BadgeRewardFacts,
): Promise<GrantSweep> {
  const out: GrantSweep = { granted: 0, already: 0, skipped: 0, failed: 0 };
  try {
    const owed = rewardsOwed(facts);
    if (owed.length === 0) return out;
    const { data, error } = await admin.from('shop_badge_rewards').select('reward_key').eq('vendor_profile_id', vendorProfileId);
    if (error) {
      logQueryError('badgeRewards.grant.keys', error, { vendorProfileId }, 'graceful_degrade');
      out.skipped = owed.length;
      return out;
    }
    const have = new Set(((data ?? []) as Array<{ reward_key: string }>).map((r) => r.reward_key));
    const missing = owed.filter((o) => !have.has(o.key));
    out.already = owed.length - missing.length;
    if (missing.length === 0) return out;

    let packCredits: number | null = null;
    if (missing.some((m) => m.reward.kind === 'papic')) {
      const packs = await fetchShopGiftPacks(admin);
      const smallest = packs ? alwaysAllowedPack(packs) : null;
      packCredits = smallest && smallest.credits > 0 ? smallest.credits : null;
    }

    for (const m of missing) {
      if (m.reward.kind === 'papic' && packCredits === null) {
        out.skipped += 1;
        continue;
      }
      const { data: res, error: gErr } = await admin.rpc('shop_badge_reward_grant', {
        p_vendor_profile_id: vendorProfileId,
        p_reward_key: m.key,
        p_badge: m.badge,
        p_reward_kind: m.reward.kind,
        p_units: m.reward.units,
        p_credits_each: m.reward.kind === 'papic' ? packCredits : null,
        p_note: m.note,
      });
      const status = (res as { status?: string } | null)?.status;
      if (gErr || !status) {
        if (gErr) logQueryError('badgeRewards.grant', gErr, { vendorProfileId, key: m.key }, 'graceful_degrade');
        out.failed += 1;
      } else if (status === 'granted') out.granted += 1;
      else if (status === 'already') out.already += 1;
      else out.failed += 1;
    }
  } catch (e) {
    console.error('[badge-rewards] grant sweep failed', e);
    out.failed += 1;
  }
  return out;
}

type RewardRow = {
  reward_id: string;
  reward_key: string;
  badge: string;
  reward_kind: BadgeRewardKind;
  units: number;
  granted_at: string;
  revoked_at: string | null;
  used_at: string | null;
  used_on_charge_id: string | null;
  returned_at: string | null;
  setnayan_gift_credits: number | null;
};

/** What the shop was given, newest first, with each used free booking fee's booking. Null on a read failure. */
export async function readGrantedRewards(admin: SupabaseClient, vendorProfileId: string): Promise<GrantedReward[] | null> {
  const { data, error } = await admin
    .from('shop_badge_rewards')
    .select(
      'reward_id, reward_key, badge, reward_kind, units, granted_at, revoked_at, used_at, used_on_charge_id, returned_at, setnayan_gift_credits',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .order('granted_at', { ascending: false });
  if (error) {
    logQueryError('badgeRewards.granted', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const rows = (data ?? []) as RewardRow[];
  const usedOn = await readUsedOn(admin, rows.map((r) => r.used_on_charge_id).filter((c): c is string => !!c));
  return rows.map((r) => ({
    rewardId: r.reward_id,
    key: r.reward_key,
    badge: r.badge,
    kind: r.reward_kind,
    units: r.units,
    grantedAt: r.granted_at,
    revokedAt: r.revoked_at,
    usedAt: r.used_at,
    usedOn: r.used_on_charge_id ? (usedOn.get(r.used_on_charge_id) ?? { coupleName: null, wouldHaveBeenPhp: null }) : null,
    returnedAt: r.returned_at,
    setnayanGiftCredits: r.setnayan_gift_credits,
  }));
}

/** The booking each free booking fee paid: the couple's name and what the fee would have been. Unread → names absent. */
async function readUsedOn(
  admin: SupabaseClient,
  chargeIds: readonly string[],
): Promise<Map<string, { coupleName: string | null; wouldHaveBeenPhp: number | null }>> {
  const out = new Map<string, { coupleName: string | null; wouldHaveBeenPhp: number | null }>();
  if (chargeIds.length === 0) return out;
  const { data, error } = await admin
    .from('booking_fee_charges')
    .select('charge_id, event_id, computed_fee_centavos')
    .in('charge_id', [...chargeIds]);
  if (error) {
    logQueryError('badgeRewards.usedOn', error, { n: chargeIds.length }, 'graceful_degrade');
    return out;
  }
  const charges = (data ?? []) as Array<{ charge_id: string; event_id: string | null; computed_fee_centavos: number | string | null }>;
  const eventIds = [...new Set(charges.map((c) => c.event_id).filter((e): e is string => !!e))];
  const names = new Map<string, string | null>();
  if (eventIds.length > 0) {
    const ev = await admin.from('events').select('event_id, display_name').in('event_id', eventIds);
    if (ev.error) logQueryError('badgeRewards.usedOn.events', ev.error, { n: eventIds.length }, 'graceful_degrade');
    for (const e of (ev.data ?? []) as Array<{ event_id: string; display_name: string | null }>) names.set(e.event_id, e.display_name);
  }
  for (const c of charges) {
    const fee = c.computed_fee_centavos == null ? NaN : Number(c.computed_fee_centavos) / 100;
    out.set(c.charge_id, {
      coupleName: c.event_id ? (names.get(c.event_id) ?? null) : null,
      wouldHaveBeenPhp: Number.isFinite(fee) && fee > 0 ? fee : null,
    });
  }
  return out;
}

/**
 * The badge page's reward input: measure, pay what is owed, then read what was given — so the page shows a reward
 * the moment its badge is earned. `badge` = the facts the page already read with `readShopBadgeFacts`.
 */
export async function readBadgeRewardTracker(
  admin: SupabaseClient,
  vendorProfileId: string,
  badge: Pick<ShopBadgeFacts, 'verified' | 'completedEvents' | 'trusted'>,
  now: Date = new Date(),
): Promise<TrackerRewardInput> {
  const facts = await readBadgeRewardFacts(admin, vendorProfileId, badge);
  await grantOwedBadgeRewards(admin, vendorProfileId, facts);
  const [granted, names, tier] = await Promise.all([readGrantedRewards(admin, vendorProfileId), readRewardNames(admin), readTier(admin, vendorProfileId)]);
  // ⏱ …and the badge upgrades (owner, 6 Nov), resolved for the shop's plan.
  const upgrades = await readBadgeUpgrades(admin, vendorProfileId, tier);
  return { facts, granted, names, awardTypeByTitle: AWARD_TYPE_BY_TITLE, periodMonth: currentPeriodMonth(now), upgrades, tier };
}

/** The shop's plan, or null when unread (an unread plan never offers the 3D Booth — `startableChoices`). */
async function readTier(admin: SupabaseClient, vendorProfileId: string): Promise<string | null> {
  const { data, error } = await admin.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', vendorProfileId).maybeSingle();
  if (error) logQueryError('badgeRewards.tier', error, { vendorProfileId }, 'graceful_degrade');
  return (data as { tier_state?: string | null } | null)?.tier_state ?? null;
}

/* ── admin ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/** One row of Admin › Gifts › Badge rewards. */
export type BadgeRewardLedgerRow = GrantedReward & { vendorProfileId: string; shopName: string | null };

/** Every badge reward across shops, newest first (admin). Null on a read failure. */
export async function fetchBadgeRewardLedger(admin: SupabaseClient, limit = 200): Promise<BadgeRewardLedgerRow[] | null> {
  const { data, error } = await admin
    .from('shop_badge_rewards')
    .select(
      'reward_id, vendor_profile_id, reward_key, badge, reward_kind, units, granted_at, revoked_at, used_at, used_on_charge_id, ' +
        'returned_at, setnayan_gift_credits, vendor_profiles(business_name)',
    )
    .order('granted_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[supabase-error] badge-rewards: admin ledger', error);
    return null;
  }
  const rows = (data ?? []) as unknown as Array<RewardRow & { vendor_profile_id: string; vendor_profiles: { business_name: string | null } | null }>;
  const usedOn = await readUsedOn(admin, rows.map((r) => r.used_on_charge_id).filter((c): c is string => !!c));
  return rows.map((r) => ({
    rewardId: r.reward_id,
    vendorProfileId: r.vendor_profile_id,
    shopName: r.vendor_profiles?.business_name ?? null,
    key: r.reward_key,
    badge: r.badge,
    kind: r.reward_kind,
    units: r.units,
    grantedAt: r.granted_at,
    revokedAt: r.revoked_at,
    usedAt: r.used_at,
    usedOn: r.used_on_charge_id ? (usedOn.get(r.used_on_charge_id) ?? { coupleName: null, wouldHaveBeenPhp: null }) : null,
    returnedAt: r.returned_at,
    setnayanGiftCredits: r.setnayan_gift_credits,
  }));
}
