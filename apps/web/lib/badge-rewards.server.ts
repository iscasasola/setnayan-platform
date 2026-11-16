import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

import { readShopBookedLoopCount } from '@/lib/shop-booked-loops.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { grantOwedBadgeUpgrades, readBadgeUpgrades, type UpgradeSweep } from '@/lib/badge-upgrades.server';
import { fetchPublicVendorBranches } from '@/lib/vendor-branches';
import { fetchShopGiftPacks } from '@/lib/shop-gifts.server';
import { alwaysAllowedPack, type ShopGiftPack } from '@/lib/shop-gifts';
import { AWARD_LABELS, currentPeriodMonth, type SpotlightAwardType } from '@/lib/spotlight-awards';
import type { ShopBadgeFacts } from '@/lib/shop-badges';
import {
  badgeAwardOf,
  FALLBACK_REWARD_NAMES,
  GRANTABLE_KINDS,
  PAPIC_PACK_CODE,
  notYetPaid,
  rewardsOwed,
  type BadgeAward,
  type BadgeReward,
  type BadgeRewardFacts,
  type BadgeRewardKind,
  type GrantedReward,
  type RewardBadge,
  type RewardNames,
  type TrackerRewardInput,
} from '@/lib/badge-rewards';
import type { TierKey } from '@/lib/badge-tiers';

/**
 * 🏅🎁 BADGE REWARDS — the I/O half of `lib/badge-rewards.ts` (owner 2026-11-05).
 *
 *   readBadgeRewardFacts   what the shop's MEASURED badges count today (null = unread → nothing is granted for it)
 *   grantOwedBadgeRewards  pays every earned step not yet paid, through the ONE door `shop_badge_reward_grant`
 *                          (exactly once per (shop, reward_key) — the database refuses a second)
 *   readGrantedRewards     what the shop was given, with each free booking fee's history
 *
 * 🔑 WHEN A REWARD IS GRANTED: badges are not stored — they are worked out live from real counts — so "earning" one is
 * the moment a read finds it. The sweep runs in ONE request door, `GET /api/vendor/badges?view=facts`, fetched AFTER a
 * page has drawn — by Today (`badge-earned-line.tsx`, owner 2026-11-05) and by the badge pages, Shop and Performance
 * (`badge-reward-sweep.tsx`) — and the admin's manual award runs it for that shop. A step reached and lost and reached
 * again is the SAME key: it never pays twice.
 * 🛑 A PAGE RENDER NEVER WRITES (8 Nov release gate): `readBadgeRewardTracker` only READS. It used to pay the sweep
 * inside the Shop/Performance render — a service-role write of real Event Plus / Papic stock on a GET, and two round
 * trips in a row before the page could draw. The same pages still pay at the same visit, a beat later, from the door.
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
type BadgeIn = Pick<ShopBadgeFacts, 'verified' | 'completedEvents' | 'trusted'>;

export async function readBadgeRewardFacts(
  admin: SupabaseClient,
  vendorProfileId: string,
  /** The page's badge facts — or the promise of them: this function's own reads start at once, beside that read. */
  badgeIn: BadgeIn | PromiseLike<BadgeIn>,
): Promise<BadgeRewardFacts> {
  const [badge, sourced, branches, serviceCards, inspirationPhotos, awards, bookedLoops, fiveStarReviews, giftPoints, completedBookings, trustedBy] = await Promise.all([
    badgeIn,
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
    // 🔁 Families who booked again — C2's `shop_booked_loop_count`, kept for the retired Booked Loop row's history.
    // (Trusted by reads `shop_trusted_by_count` below: the same count, from the 18 Dec 2026 badge cut-off.)
    readShopBookedLoopCount(admin, vendorProfileId),
    // ⭐ 5★ reviews under the trusted-review rule (owner 2026-11-15) — `shop_trusted_five_star_count`. null = unread.
    readFiveStarCount(admin, vendorProfileId),
    // 🎁 Gifts given (owner 15 Nov): gift points for gifts given on completed events — `shop_gift_points`. null = unread.
    readGiftPoints(admin, vendorProfileId),
    // ✅ Completed bookings (imports left out) and 🛡 Trusted by (imports counted), both from 18 Dec 2026. null = unread.
    readBadgeCount(admin, 'shop_completed_bookings_count', vendorProfileId),
    readBadgeCount(admin, 'shop_trusted_by_count', vendorProfileId),
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
    fiveStarReviews,
    completedBookings,
    trustedBy,
    giftPoints,
    // 🤝 Invites: no counter exists yet (nothing records one supplier importing another) — "Not counted yet". When the
    // import door lands: count each imported supplier once, at its first COMPLETED event (owner 15 Nov, open item 3).
    invites: null,
  };
}

/** A badge counter RPC's answer (`shop_completed_bookings_count`, `shop_trusted_by_count`); null on a refused read. */
async function readBadgeCount(
  admin: SupabaseClient,
  fn: 'shop_completed_bookings_count' | 'shop_trusted_by_count',
  vendorProfileId: string,
): Promise<number | null> {
  // Named literally, so the read-only render guard (`the-shop-render-never-writes`) can see each call.
  const { data, error } =
    fn === 'shop_completed_bookings_count'
      ? await admin.rpc('shop_completed_bookings_count', { p_vendor_profile_id: vendorProfileId })
      : await admin.rpc('shop_trusted_by_count', { p_vendor_profile_id: vendorProfileId });
  if (error) {
    logQueryError(`badgeRewards.${fn}`, error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const n = typeof data === 'number' ? data : Number(data);
  return data !== null && Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

/** The shop's gift points (`shop_gift_points`); null on a refused read — never 0. */
export async function readGiftPoints(admin: SupabaseClient, vendorProfileId: string): Promise<number | null> {
  const { data, error } = await admin.rpc('shop_gift_points', { p_vendor_profile_id: vendorProfileId });
  if (error) {
    logQueryError('badgeRewards.giftPoints', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const n = typeof data === 'number' ? data : Number(data);
  return data !== null && Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

/** The shop's 5★ reviews by the public stars' own rule; null on a refused read (never 0). */
async function readFiveStarCount(admin: SupabaseClient, vendorProfileId: string): Promise<number | null> {
  const { data, error } = await admin.rpc('shop_trusted_five_star_count', { p_vendor_profile_id: vendorProfileId });
  if (error) {
    logQueryError('badgeRewards.fiveStars', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const n = Number(data);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : null;
}

/**
 * The Papic pack a reward names, from the live catalogue: the smallest (`alwaysAllowedPack`) or the one with the
 * pack's code (`PAPIC_PACK_CODE`). Null when the catalogue does not hold it — then that reward waits, never a guess.
 */
export function papicPackFor(packs: readonly ShopGiftPack[], reward: BadgeReward): ShopGiftPack | null {
  if (reward.kind !== 'papic') return null;
  if (!reward.pack || reward.pack === 'smallest') return alwaysAllowedPack(packs);
  const code = PAPIC_PACK_CODE[reward.pack];
  return packs.find((p) => p.kind === 'papic' && p.code === code) ?? null;
}

/** The products' names from the live catalogue: every reward the one ladder can pay, and each Papic pack by credits. */
export async function readRewardNames(admin: SupabaseClient): Promise<RewardNames> {
  // Event Ultra is one of the gift packs since 15 Nov (earned only), so its catalogue title comes with them.
  const packs = await fetchShopGiftPacks(admin);
  if (!packs) return FALLBACK_REWARD_NAMES;
  const papicByCredits: Record<number, string> = {};
  for (const p of packs) if (p.kind === 'papic') papicByCredits[p.credits] = p.title;
  return {
    papic: alwaysAllowedPack(packs)?.title ?? FALLBACK_REWARD_NAMES.papic,
    papic_1000: papicPackFor(packs, { kind: 'papic', units: 1, pack: 'papic_1000' })?.title,
    papic_3000: papicPackFor(packs, { kind: 'papic', units: 1, pack: 'papic_3000' })?.title,
    event_plus: packs.find((p) => p.kind === 'event_plus')?.title ?? FALLBACK_REWARD_NAMES.event_plus,
    event_pro: packs.find((p) => p.kind === 'event_pro')?.title ?? FALLBACK_REWARD_NAMES.event_pro,
    event_ultra: packs.find((p) => p.kind === 'event_ultra')?.title ?? FALLBACK_REWARD_NAMES.event_ultra,
    papicByCredits,
  };
}

export type GrantSweep = {
  granted: number;
  already: number;
  skipped: number;
  failed: number;
  upgrades?: UpgradeSweep;
  /** The reward keys THIS sweep paid (status 'granted') — the badges just earned. Lane S posts one of them
   *  (`composeBadgeSocialPost`, lib/social/badge-post.ts), fired by the caller from `after()`. */
  grantedKeys?: string[];
  /** The rewards THIS sweep paid, as earned — what the "You earned …" notice names (`notifyBadgeEarned`). */
  grantedRewards?: Array<{ key: string; badge: RewardBadge; reward: BadgeReward; tier?: TierKey; step?: number; creditsEach: number | null }>;
};

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
  const out: GrantSweep = { granted: 0, already: 0, skipped: 0, failed: 0, grantedKeys: [], grantedRewards: [] };
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
    // 🔑 Never a key twice, and never a TIER twice — an old payment for the same tier blocks it (3cbf12c1).
    const missing = notYetPaid(owed, have);
    out.already = owed.length - missing.length;
    if (missing.length === 0) {
      await autoClaimBadgeRewards(admin, vendorProfileId);
      return out;
    }

    // Papic credits per pack, READ now from the catalogue — the smallest pack, or the pack the reward names by code.
    const packs = missing.some((m) => m.reward.kind === 'papic') ? await fetchShopGiftPacks(admin) : null;
    const creditsFor = (r: BadgeReward): number | null => {
      if (r.kind !== 'papic' || !packs) return null;
      const p = papicPackFor(packs, r);
      return p && p.credits > 0 ? p.credits : null;
    };

    for (const m of missing) {
      // 🛑 A kind the grant door cannot land waits, its key unspent (every kind is grantable since 15 Nov; kept as a guard).
      if (!GRANTABLE_KINDS.has(m.reward.kind)) {
        out.skipped += 1;
        continue;
      }
      const packCredits = creditsFor(m.reward);
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
      } else if (status === 'granted') {
        out.granted += 1;
        out.grantedKeys!.push(m.key);
        out.grantedRewards!.push({ key: m.key, badge: m.badge, reward: m.reward, tier: m.tier, step: m.step, creditsEach: packCredits });
      } else if (status === 'already') out.already += 1;
      else out.failed += 1;
    }
    // 🎟 A badge reward is claimed AUTOMATICALLY (owner 15 Nov, e5ec685d pick 2) — every reward of the shop, through
    // the same once-only claim key, so it never counts twice.
    await autoClaimBadgeRewards(admin, vendorProfileId);
  } catch (e) {
    console.error('[badge-rewards] grant sweep failed', e);
    out.failed += 1;
  }
  return out;
}

/**
 * Claims every unclaimed badge reward of the shop (`shop_badge_rewards_auto_claim`) — the same `gift_moment_claims`
 * key a press would use, so a repeat is a no-op. Never throws; answers how many it claimed (null when refused).
 */
export async function autoClaimBadgeRewards(admin: SupabaseClient, vendorProfileId: string): Promise<number | null> {
  const { data, error } = await admin.rpc('shop_badge_rewards_auto_claim', { p_vendor_profile_id: vendorProfileId });
  if (error) {
    logQueryError('badgeRewards.autoClaim', error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const n = Number(data);
  return Number.isFinite(n) ? n : null;
}

type RewardRow = {
  reward_id: string;
  reward_key: string;
  badge: string;
  reward_kind: BadgeRewardKind;
  units: number;
  stock_delta: number | null;
  granted_at: string;
  revoked_at: string | null;
  used_at: string | null;
  used_on_charge_id: string | null;
  returned_at: string | null;
  setnayan_gift_credits: number | null;
};

/** A Papic reward's credits per pack (stock_delta ÷ units) — which pack it was; null for anything else. */
function creditsEachOf(r: { reward_kind: string; units: number; stock_delta: number | null }): number | null {
  if (r.reward_kind !== 'papic' || !r.stock_delta || !r.units) return null;
  const each = r.stock_delta / r.units;
  return Number.isInteger(each) && each > 0 ? each : null;
}

/** What the shop was given, newest first, with each used free booking fee's booking. Null on a read failure. */
export async function readGrantedRewards(admin: SupabaseClient, vendorProfileId: string): Promise<GrantedReward[] | null> {
  const { data, error } = await admin
    .from('shop_badge_rewards')
    .select(
      'reward_id, reward_key, badge, reward_kind, units, stock_delta, granted_at, revoked_at, used_at, used_on_charge_id, returned_at, setnayan_gift_credits',
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
    creditsEach: creditsEachOf(r),
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
 * The badge page's reward input — READ ONLY: what the badges count, what was given, the products' names, the plan and
 * the upgrades, every read started at once (one wave; the plan shapes the upgrade rows after). It never pays: paying is
 * the sweep's door (`GET /api/vendor/badges?view=facts`, after the page draws — see the header). `badge` = the facts
 * the page reads with `readShopTrackerFacts`, or the promise of them, so these reads ride beside that one.
 */
export async function readBadgeRewardTracker(
  admin: SupabaseClient,
  vendorProfileId: string,
  badge: BadgeIn | PromiseLike<BadgeIn>,
  now: Date = new Date(),
): Promise<TrackerRewardInput> {
  const tierRead = readTier(admin, vendorProfileId);
  const [facts, granted, names, tier, upgrades] = await Promise.all([
    readBadgeRewardFacts(admin, vendorProfileId, badge),
    readGrantedRewards(admin, vendorProfileId),
    readRewardNames(admin),
    tierRead,
    // ⏱ …and the badge upgrades (owner, 6 Nov), resolved for the shop's plan.
    readBadgeUpgrades(admin, vendorProfileId, tierRead),
  ]);
  return { facts, granted, names, awardTypeByTitle: AWARD_TYPE_BY_TITLE, periodMonth: currentPeriodMonth(now), upgrades, tier };
}

/** The shop's plan, or null when unread (an unread plan never offers the 3D Booth — `startableChoices`). */
async function readTier(admin: SupabaseClient, vendorProfileId: string): Promise<string | null> {
  const { data, error } = await admin.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', vendorProfileId).maybeSingle();
  if (error) logQueryError('badgeRewards.tier', error, { vendorProfileId }, 'graceful_degrade');
  return (data as { tier_state?: string | null } | null)?.tier_state ?? null;
}

/* ── award dates and claims (owner 2026-11-15) ──────────────────────────────────────────────────────────────── */

/**
 * 🏅 Every badge step the shop was AWARDED (not revoked), newest first — with its award date and whether it was
 * claimed (`gift_moment_claims`, source 'badge_reward': the 14 Nov claim door, `gift_moment_claim`, pressing twice
 * never counts twice). READ ONLY — never grants. `admin` = the service-role client, after the caller proved the shop
 * is the signed-in supplier's own. Null on a read failure (draw "couldn't load", never "no badges").
 */
export async function readBadgeAwards(admin: SupabaseClient, vendorProfileId: string): Promise<BadgeAward[] | null> {
  const [granted, claims, names] = await Promise.all([
    readGrantedRewards(admin, vendorProfileId),
    admin
      .from('gift_moment_claims')
      .select('ref_id, claimed_at')
      .eq('source', 'badge_reward')
      .eq('vendor_profile_id', vendorProfileId)
      .then(({ data, error }) => {
        if (error) {
          logQueryError('badgeRewards.claims', error, { vendorProfileId }, 'graceful_degrade');
          return null;
        }
        return new Map(((data ?? []) as Array<{ ref_id: string; claimed_at: string }>).map((c) => [c.ref_id, c.claimed_at]));
      }),
    readRewardNames(admin),
  ]);
  if (!granted || !claims) return null;
  return granted.filter((g) => !g.revokedAt).map((g) => badgeAwardOf(g, claims.get(g.rewardId) ?? null, names));
}

/* ── admin ───────────────────────────────────────────────────────────────────────────────────────────────────── */

/** One row of Admin › Gifts › Badge rewards. */
export type BadgeRewardLedgerRow = GrantedReward & { vendorProfileId: string; shopName: string | null };

/** Every badge reward across shops, newest first (admin). Null on a read failure. */
export async function fetchBadgeRewardLedger(admin: SupabaseClient, limit = 200): Promise<BadgeRewardLedgerRow[] | null> {
  const { data, error } = await admin
    .from('shop_badge_rewards')
    .select(
      'reward_id, vendor_profile_id, reward_key, badge, reward_kind, units, stock_delta, granted_at, revoked_at, used_at, used_on_charge_id, ' +
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
    creditsEach: creditsEachOf(r),
    grantedAt: r.granted_at,
    revokedAt: r.revoked_at,
    usedAt: r.used_at,
    usedOn: r.used_on_charge_id ? (usedOn.get(r.used_on_charge_id) ?? { coupleName: null, wouldHaveBeenPhp: null }) : null,
    returnedAt: r.returned_at,
    setnayanGiftCredits: r.setnayan_gift_credits,
  }));
}
