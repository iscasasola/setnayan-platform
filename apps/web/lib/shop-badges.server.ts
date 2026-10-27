import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { hasVerifiedBadge } from '@/lib/verified-badge';
import { AWARD_LABELS, fetchVendorCurrentAwards } from '@/lib/spotlight-awards';
import type { ShopBadgeFacts, TrackerFacts } from '@/lib/shop-badges';

/**
 * 🏅 THE BADGES' READS — one function, so the Shop › Page tracker, the Today line and the print file read the SAME
 * facts (`lib/shop-badges.ts` composes them). Called with the service-role client keyed on the signed-in supplier's
 * OWN `vendor_profile_id` (each caller resolves it with `fetchOwnVendorProfile` first) — the public stats views are
 * readable by anyone, the shop row is their own.
 *
 * 🔑 A REFUSED READ IS NOT A ZERO. The completed-events count and the trusted stat come back null when their read
 * fails, so the tracker says "Couldn't load" and no medal is drawn — never "0 of 10", never "No reviews yet" to a shop
 * with forty. Awards fail soft to none (the shipped `fetchVendorCurrentAwards` contract — an award is a bonus word).
 *
 * Read AT THE MOMENT OF USE: the print route calls this per file, so a tarp carries today's badges.
 */
export async function readShopBadgeFacts(
  admin: SupabaseClient,
  vendorProfileId: string,
  now: Date = new Date(),
): Promise<ShopBadgeFacts> {
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

export async function readShopTrackerFacts(admin: SupabaseClient, vendorProfileId: string, now: Date = new Date()): Promise<TrackerFacts> {
  const [facts, unreviewed] = await Promise.all([readShopBadgeFacts(admin, vendorProfileId, now), readUnreviewedCount(admin, vendorProfileId)]);
  return { ...facts, unreviewed };
}
