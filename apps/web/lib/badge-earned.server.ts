import 'server-only';
import { after } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { emitNotification } from '@/lib/notification-emit';
import { runClaimedJob } from '@/lib/periodic-jobs';
import { BADGE_REWARD_SWEEP_GAP_MS } from '@/lib/periodic-job-registry';
import { readShopBadgeFacts } from '@/lib/shop-badges.server';
import { composeBadgeSocialPost } from '@/lib/social/badge-post';
import { rewardWords } from '@/lib/badge-rewards';
import { grantOwedBadgeRewards, readBadgeRewardFacts, readRewardNames, type GrantSweep } from '@/lib/badge-rewards.server';
import { settleCardBadges } from '@/lib/card-badges.server';
import { BADGE_EARNED_CTA, BADGE_EARNED_HREF, badgeEarnedNotice, pickBadgeToTell } from '@/lib/badge-earned';

/**
 * 🏅 FIRING WHEN EARNED (owner 2026-11-15, DECISION_LOG "SUPPLIER BADGES, SEALS AND REWARDS": *"run the same
 * grantOwedBadgeRewards from after() on the events that move a count … plus a claim_periodic_job backstop sweep; on a
 * grant: … a new badge_earned notification/email via emitNotification"*).
 *
 *   sweepShopBadges(shop)       read the shop's counts → pay what is owed (`grantOwedBadgeRewards`, exactly once per
 *                               key — the database's) → tell the shop about what THIS sweep paid. Never throws.
 *   sweepShopBadgesAfter(shop)  the same, from `after()` — the four moments a count moves call this: a booking turns
 *                               delivered/complete, a review is posted, a partnership is accepted, a gift is given.
 *   tellBadgesJustEarned(...)   the notice + email + Lane S post for keys a sweep just paid. Only a key the database
 *                               answered 'granted' for reaches it, so an existing grant is never told twice.
 *   maybeRunBadgeRewardSweep()  the backstop (`claim_periodic_job`, ~daily): shops whose counts moved in the last few
 *                               days, swept — for any moment whose after() was lost. It also visits every shop holding
 *                               a service-card badge and every shop asked about recently, so each card's badges are
 *                               checked every day (a badge comes off the day the card stops passing).
 *
 * 🏅 The SERVICE-CARD badges settle here too (`settleCardBadges`, J3) — the public shop page only READS them, so this
 * sweep is the one place their holds are opened and closed and the Today congratulations is sent.
 *
 * Badges stay worked out LIVE; only the rewards are stored, once.
 */

/** Read, pay, tell. `admin` = service-role. Never throws; answers what it paid (null when the read failed). */
export async function sweepShopBadges(vendorProfileId: string, admin: SupabaseClient = createAdminClient()): Promise<GrantSweep | null> {
  try {
    const badge = readShopBadgeFacts(admin, vendorProfileId);
    const facts = await readBadgeRewardFacts(admin, vendorProfileId, badge);
    const sweep = await grantOwedBadgeRewards(admin, vendorProfileId, facts);
    await tellBadgesJustEarned(admin, vendorProfileId, sweep);
    await settleCardBadgesQuietly(admin, vendorProfileId);
    return sweep;
  } catch (e) {
    console.error('[badge-earned] sweep failed', vendorProfileId, e);
    // The shop rewards' read failed — the card badges have their own read, so they still settle.
    await settleCardBadgesQuietly(admin, vendorProfileId);
    return null;
  }
}

/** The card badges' settle, never throwing into the rewards sweep (a failure is logged; the next sweep settles it). */
async function settleCardBadgesQuietly(admin: SupabaseClient, vendorProfileId: string): Promise<void> {
  try {
    await settleCardBadges(admin, vendorProfileId);
  } catch (e) {
    console.error('[badge-earned] card badge settle failed', vendorProfileId, e);
  }
}

/** The four count-moving moments call this: the sweep runs after the response, never on the person's path. */
export function sweepShopBadgesAfter(vendorProfileId: string | null | undefined): void {
  if (!vendorProfileId) return;
  try {
    after(() => sweepShopBadges(vendorProfileId).then(() => undefined));
  } catch (e) {
    // Outside a request scope (a script, a test) there is no after(); the backstop sweep pays it later.
    console.warn('[badge-earned] after() unavailable; the backstop sweep will pay it', e);
  }
}

/**
 * Tell the shop about what one sweep JUST paid: one `badge_earned` notice (+ email) naming the most valuable, and one
 * Lane S social post (its own picker, compose-once). Called by every door that runs the grant sweep. Never throws.
 */
export async function tellBadgesJustEarned(admin: SupabaseClient, vendorProfileId: string, sweep: GrantSweep): Promise<void> {
  const keys = sweep.grantedKeys ?? [];
  if (keys.length === 0) return;
  try {
    await composeBadgeSocialPost(vendorProfileId, keys);
  } catch (e) {
    console.error('[badge-earned] social post failed', e);
  }
  const top = pickBadgeToTell(sweep.grantedRewards ?? []);
  if (!top) return;
  try {
    const [{ data, error }, names] = await Promise.all([
      admin.from('vendor_profiles').select('user_id, business_name').eq('vendor_profile_id', vendorProfileId).maybeSingle(),
      readRewardNames(admin),
    ]);
    if (error) {
      logQueryError('badgeEarned.shop', error, { vendorProfileId }, 'graceful_degrade');
      return;
    }
    const shop = data as { user_id: string | null; business_name: string | null } | null;
    if (!shop?.user_id) return;
    const words = badgeEarnedNotice({
      key: top.key,
      badge: top.badge,
      tier: top.tier ?? null,
      shopName: shop.business_name,
      reward: rewardWords({ ...top.reward, creditsEach: top.creditsEach }, names),
    });
    await emitNotification({
      userId: shop.user_id,
      type: 'badge_earned',
      title: words.title,
      body: words.body,
      relatedUrl: BADGE_EARNED_HREF,
      email: { ctaLabel: BADGE_EARNED_CTA },
    });
  } catch (e) {
    console.error('[badge-earned] notice failed', e);
  }
}

/** How far back the backstop looks for a moved count — over three daily windows, so a quiet day loses nothing. */
const LOOKBACK_MS = 4 * 24 * 60 * 60 * 1000;
/** At most this many moved-count shops per run — the rest are next run's (a booking moved yesterday is still in the
 * window). Shops holding a card badge are not capped: each is re-checked every run. */
const SWEEP_CAP = 150;

/** Shops whose counts moved recently: a booking delivered/completed, a review, an accepted partnership, a gift given. */
async function shopsWithMovedCounts(admin: SupabaseClient, sinceIso: string): Promise<string[]> {
  const [bookings, reviews, partners, gifts, cardHolds, asked] = await Promise.all([
    admin
      .from('event_vendors')
      .select('linked_vendor_profile_id, marketplace_vendor_id')
      // Completed bookings and gift points move at delivered/complete; Trusted by at a second booking (contracted+).
      .in('status', ['contracted', 'deposit_paid', 'delivered', 'complete'])
      .gte('updated_at', sinceIso)
      .limit(1000),
    admin.from('vendor_reviews').select('vendor_profile_id').gte('created_at', sinceIso).limit(1000),
    admin.from('vendor_partnerships').select('recommended_vendor_id').eq('status', 'accepted').gte('accepted_at', sinceIso).limit(1000),
    admin.from('shop_gift_stock_entries').select('vendor_profile_id').eq('kind', 'given').gte('created_at', sinceIso).limit(1000),
    // 🏅 J3 — a shop holding a service-card badge is checked every day, so a badge comes off the day it stops passing.
    admin.from('service_card_badge_holds').select('vendor_profile_id').is('lost_at', null).limit(1000),
    // 🏅 J3 — Quick Responder and Trending Now move on inquiries: a shop asked about recently is checked too.
    admin.from('thread_service_interests').select('thread_id').gte('created_at', sinceIso).limit(1000),
  ]);
  for (const [name, r] of [
    ['bookings', bookings],
    ['reviews', reviews],
    ['partners', partners],
    ['gifts', gifts],
    ['card holds', cardHolds],
    ['inquiries', asked],
  ] as const) {
    if (r.error) throw new Error(`badge sweep candidates (${name}): ${r.error.message}`);
  }
  const askedThreads = [...new Set(((asked.data ?? []) as Array<{ thread_id: string | null }>).map((a) => a.thread_id).filter((t): t is string => !!t))];
  const askedShops = askedThreads.length
    ? await admin.from('chat_threads').select('vendor_profile_id').in('thread_id', askedThreads)
    : { data: [], error: null };
  if (askedShops.error) throw new Error(`badge sweep candidates (inquiry shops): ${askedShops.error.message}`);
  const ids = new Set<string>();
  for (const b of (bookings.data ?? []) as Array<{ linked_vendor_profile_id: string | null; marketplace_vendor_id: string | null }>) {
    if (b.linked_vendor_profile_id) ids.add(b.linked_vendor_profile_id);
    if (b.marketplace_vendor_id) ids.add(b.marketplace_vendor_id);
  }
  for (const r of (reviews.data ?? []) as Array<{ vendor_profile_id: string | null }>) if (r.vendor_profile_id) ids.add(r.vendor_profile_id);
  for (const p of (partners.data ?? []) as Array<{ recommended_vendor_id: string | null }>) if (p.recommended_vendor_id) ids.add(p.recommended_vendor_id);
  for (const g of (gifts.data ?? []) as Array<{ vendor_profile_id: string | null }>) if (g.vendor_profile_id) ids.add(g.vendor_profile_id);
  for (const t of (askedShops.data ?? []) as Array<{ vendor_profile_id: string | null }>) if (t.vendor_profile_id) ids.add(t.vendor_profile_id);
  // 🏅 Every shop holding a card badge is re-checked EVERY run, so a held badge always comes off the day it stops
  // passing — the cap applies only to the moved-count candidates after them.
  const held = new Set<string>();
  for (const h of (cardHolds.data ?? []) as Array<{ vendor_profile_id: string | null }>) if (h.vendor_profile_id) held.add(h.vendor_profile_id);
  const rest = [...ids].filter((id) => !held.has(id)).slice(0, SWEEP_CAP);
  return [...held, ...rest];
}

/**
 * The backstop (cron-free, `claim_periodic_job` via `runClaimedJob`): ~daily, every shop whose counts moved in the last
 * four days is swept. Records how many rewards it paid. Never throws (runClaimedJob writes a failure down).
 */
export async function maybeRunBadgeRewardSweep(): Promise<void> {
  await runClaimedJob('badge-reward-sweep', BADGE_REWARD_SWEEP_GAP_MS, async () => {
    const admin = createAdminClient();
    const shops = await shopsWithMovedCounts(admin, new Date(Date.now() - LOOKBACK_MS).toISOString());
    let paid = 0;
    for (const shop of shops) {
      const sweep = await sweepShopBadges(shop, admin);
      paid += sweep?.granted ?? 0;
    }
    return paid;
  });
}
