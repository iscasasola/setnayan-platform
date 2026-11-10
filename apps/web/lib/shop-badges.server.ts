import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { createAdminClient } from '@/lib/supabase/admin';
import { hasVerifiedBadge } from '@/lib/verified-badge';
import { AWARD_LABELS, currentPeriodMonth, fetchVendorCurrentAwards, type SpotlightAwardType } from '@/lib/spotlight-awards';
import type { ShopBadgeFacts, TrackerFacts } from '@/lib/shop-badges';

/**
 * 🏅 THE BADGES' READS — one function, so the Shop › Page tracker, the Today line and the print file read the SAME
 * facts (`lib/shop-badges.ts` composes them). Called with the service-role client keyed on the signed-in supplier's
 * OWN `vendor_profile_id` (each caller resolves it with `fetchOwnVendorProfile` first) — the public stats views are
 * readable by anyone, the shop row is their own.
 *
 * 🔑 A REFUSED READ IS NOT A ZERO. The completed-events count and the trusted stat come back null when their read
 * fails, so the tracker says "Couldn't load" and no medal is drawn — never "0 of 10", never "No reviews yet" to a shop
 * with forty. Awards fail soft to none (the shipped `fetchVendorCurrentAwards` contract).
 *
 * Read AT THE MOMENT OF USE: the print route calls this per file, so a tarp carries today's badges.
 */
export async function readShopBadgeFacts(
  admin: SupabaseClient,
  vendorProfileId: string,
  at?: Date,
): Promise<ShopBadgeFacts> {
  const now = at ?? new Date();
  const [own, completed, trusted, awards] = await Promise.all([
    admin
      .from('vendor_profiles')
      .select('verification_state, next_renewal_due_at, in_business_since_year')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) logQueryError('shopBadges.own', error, { vendorProfileId }, 'graceful_degrade');
        return (data as { verification_state: string | null; next_renewal_due_at: string | null; in_business_since_year: number | null } | null) ?? null;
      }),
    admin
      .from('vendor_public_completed_events_stats')
      .select('public_completed_count')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          logQueryError('shopBadges.completed', error, { vendorProfileId }, 'graceful_degrade');
          return null;
        }
        // No row is a real answer: nothing completed yet.
        return Number((data as { public_completed_count: number | null } | null)?.public_completed_count ?? 0);
      }),
    admin
      .from('vendor_trusted_review_stats')
      .select('trusted_avg_rating, trusted_review_count')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          logQueryError('shopBadges.trusted', error, { vendorProfileId }, 'graceful_degrade');
          return null;
        }
        const row = data as { trusted_avg_rating: number | null; trusted_review_count: number | null } | null;
        return { trusted_avg_rating: Number(row?.trusted_avg_rating ?? 0), trusted_review_count: Number(row?.trusted_review_count ?? 0) };
      }),
    fetchVendorCurrentAwards(admin, vendorProfileId).catch(() => []),
  ]);
  return {
    verified: own ? hasVerifiedBadge(own, now) : false,
    completedEvents: completed,
    trusted,
    inBusinessSinceYear: own?.in_business_since_year ?? null,
    awards: [...new Set(awards)].map((a) => AWARD_LABELS[a]),
    nowYear: now.getFullYear(),
  };
}

/**
 * 🃏 THE SAME FACTS FOR A WHOLE SHELF OF SHOPS — one read per table, never one per card (house rule: one batched read
 * per screen). Discover's shop card (owner 10 Nov) calls this with the shelf's rows, which already carry the shop's
 * own columns — so Verified (`hasVerifiedBadge`, computed by the caller exactly as `readShopBadgeFacts` does) and the
 * year it opened travel in, and only the three stats tables are read here.
 *
 * Same contract as `readShopBadgeFacts`: a refused table is null for EVERY shop on the shelf (no medal, no ★ — never a
 * zero); a shop with no row in an answered table has nothing there yet; awards fail soft to none.
 */
export async function readShopBadgeFactsForShops(
  admin: SupabaseClient,
  shops: readonly { vendorProfileId: string; verified: boolean; inBusinessSinceYear: number | null }[],
  at?: Date,
): Promise<Map<string, ShopBadgeFacts>> {
  const now = at ?? new Date();
  const out = new Map<string, ShopBadgeFacts>();
  const ids = [...new Set(shops.map((s) => s.vendorProfileId).filter(Boolean))];
  if (ids.length === 0) return out;
  const [completed, trusted, awards] = await Promise.all([
    admin
      .from('vendor_public_completed_events_stats')
      .select('vendor_profile_id, public_completed_count')
      .in('vendor_profile_id', ids)
      .then(({ data, error }) => {
        if (error) {
          logQueryError('shopBadges.completedMany', error, { shops: ids.length }, 'graceful_degrade');
          return null;
        }
        const rows = (data ?? []) as { vendor_profile_id: string; public_completed_count: number | null }[];
        return new Map(rows.map((r) => [r.vendor_profile_id, Number(r.public_completed_count ?? 0)]));
      }),
    admin
      .from('vendor_trusted_review_stats')
      .select('vendor_profile_id, trusted_avg_rating, trusted_review_count')
      .in('vendor_profile_id', ids)
      .then(({ data, error }) => {
        if (error) {
          logQueryError('shopBadges.trustedMany', error, { shops: ids.length }, 'graceful_degrade');
          return null;
        }
        const rows = (data ?? []) as { vendor_profile_id: string; trusted_avg_rating: number | null; trusted_review_count: number | null }[];
        return new Map(
          rows.map((r) => [
            r.vendor_profile_id,
            { trusted_avg_rating: Number(r.trusted_avg_rating ?? 0), trusted_review_count: Number(r.trusted_review_count ?? 0) },
          ]),
        );
      }),
    admin
      .from('vendor_spotlight_awards')
      .select('vendor_profile_id, award_type')
      .in('vendor_profile_id', ids)
      .eq('period_month', currentPeriodMonth(now))
      .then(({ data, error }) => {
        if (error) {
          logQueryError('shopBadges.awardsMany', error, { shops: ids.length }, 'graceful_degrade');
          return new Map<string, SpotlightAwardType[]>();
        }
        const byShop = new Map<string, SpotlightAwardType[]>();
        for (const r of (data ?? []) as { vendor_profile_id: string; award_type: SpotlightAwardType }[]) {
          byShop.set(r.vendor_profile_id, [...(byShop.get(r.vendor_profile_id) ?? []), r.award_type]);
        }
        return byShop;
      }),
  ]);
  for (const s of shops) {
    out.set(s.vendorProfileId, {
      verified: s.verified,
      completedEvents: completed ? (completed.get(s.vendorProfileId) ?? 0) : null,
      trusted: trusted ? (trusted.get(s.vendorProfileId) ?? { trusted_avg_rating: 0, trusted_review_count: 0 }) : null,
      inBusinessSinceYear: s.inBusinessSinceYear,
      awards: [...new Set(awards.get(s.vendorProfileId) ?? [])].map((a) => AWARD_LABELS[a]),
      nowYear: now.getFullYear(),
    });
  }
  return out;
}

/**
 * The tracker's one extra fact: couples whose finished event (`vendor_completed_events`) has no review from them yet
 * (`vendor_reviews.event_id`). Null when either read fails — the row then offers no count rather than a wrong one.
 */
export async function readUnreviewedCount(admin: SupabaseClient, vendorProfileId: string): Promise<number | null> {
  const done = await admin.from('vendor_completed_events').select('event_id').eq('vendor_profile_id', vendorProfileId).limit(500);
  if (done.error) {
    logQueryError('shopBadges.done', done.error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const ids = [...new Set((done.data ?? []).map((r) => (r as { event_id: string | null }).event_id).filter((x): x is string => !!x))];
  if (ids.length === 0) return 0;
  const rev = await admin.from('vendor_reviews').select('event_id').eq('vendor_profile_id', vendorProfileId).in('event_id', ids);
  if (rev.error) {
    logQueryError('shopBadges.reviewed', rev.error, { vendorProfileId }, 'graceful_degrade');
    return null;
  }
  const reviewed = new Set((rev.data ?? []).map((r) => (r as { event_id: string | null }).event_id));
  return ids.filter((id) => !reviewed.has(id)).length;
}

/** The tracker's facts for the signed-in supplier's OWN shop (the caller proved `vendorProfileId` from the session). */
export async function readShopTrackerFacts(vendorProfileId: string, at?: Date): Promise<TrackerFacts> {
  const admin = createAdminClient();
  const [facts, unreviewed] = await Promise.all([readShopBadgeFacts(admin, vendorProfileId, at), readUnreviewedCount(admin, vendorProfileId)]);
  return { ...facts, unreviewed };
}
