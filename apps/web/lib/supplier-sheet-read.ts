import 'server-only';
/**
 * supplier-sheet-read.ts — what the supplier sheet reads when it is OPEN (never
 * on a page load), through shipped readers where one exists. It keeps "could
 * not read" apart from "there are none".
 */
import { readOverdueTopUpEventIds } from '@/lib/booking-fee-top-up.server';
import { manilaToday } from '@/lib/std-views';
import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchReviewsForVendor, fetchVendorCompletedEvents } from '@/lib/reviews';
import {
  sheetOthers,
  sheetReviews,
  sheetWork,
  type SupplierSheetData,
} from '@/lib/supplier-sheet';
import { isFollowingVendor } from '@/lib/follow';
import { isVendorNameRevealed } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { publicUrlForStoredAsset } from '@/lib/uploads';
import { getTaxonomy } from '@/lib/taxonomy-db';

/* ─── THE SHEET'S ONE REQUEST (owner 2026-10-08 · the minimum-request rules) ──
 * Opening a supplier's sheet used to re-render the whole Suppliers page on the
 * server to fetch two lists. It is now drawn at once from what the pressed card
 * already holds, and this runs ONCE per supplier per visit: five reads, one per
 * table, together. Nothing here is per-event data — a supplier's reviews,
 * finished events, published photos and live services are the same for every
 * couple — except "do I follow them", which is the caller's own row. */

type SheetProfileRow = {
  business_slug: string | null;
  portfolio_r2_keys: string[] | null;
  services: string[] | null;
  name_revealed_at: string | null;
  tier_state: string | null;
  verification_state: string | null;
};

const SHEET_PROFILE_COLUMNS =
  'business_slug,portfolio_r2_keys,services,name_revealed_at,tier_state,verification_state';

export async function readSupplierSheet(
  /** Service-role client — public profile fields and live services only. */
  admin: SupabaseClient,
  /** The signed-in couple's client — their own follow row. */
  supabase: SupabaseClient,
  input: { vendorProfileId: string; userId: string; tile: string | null },
): Promise<SupplierSheetData> {
  const { vendorProfileId, userId } = input;
  // 💸 A review from an event whose booking-fee top-up is overdue is unlisted until settled (owner 2026-11-12).
  const unlisted = await readOverdueTopUpEventIds(vendorProfileId, manilaToday());
  const [reviews, completed, profile, services, following, taxonomy] = await Promise.all([
    fetchReviewsForVendor(supabase, vendorProfileId, { limit: 12, excludeEventIds: [...unlisted] })
      .then((rows) => sheetReviews(rows))
      .catch((err) => {
        console.error('[supplier-sheet] reviews read failed', err);
        return null;
      }),
    fetchVendorCompletedEvents(supabase, vendorProfileId).catch(() => []),
    admin
      .from('vendor_profiles')
      .select(SHEET_PROFILE_COLUMNS)
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('[supplier-sheet] profile read failed', error);
        return error ? null : ((data as SheetProfileRow | null) ?? null);
      }),
    admin
      .from('vendor_services')
      .select('category')
      .eq('vendor_profile_id', vendorProfileId)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('[supplier-sheet] services read failed', error);
        return error ? null : ((data ?? []) as { category: string | null }[]);
      }),
    isFollowingVendor(supabase, userId, vendorProfileId).catch((err) => {
      console.error('[supplier-sheet] follow read failed', err);
      return null;
    }),
    // Never refuses: an empty or failed read answers with the seed snapshot.
    getTaxonomy(),
  ]);

  // A shop whose name is still withheld is not named by its photos or its
  // address either — the same gate the marketplace list uses.
  const revealed =
    profile != null &&
    isVendorNameRevealed({
      name_revealed_at: profile.name_revealed_at,
      isPaidTier: isTrueNameTier(profile.tier_state),
      is_verified: profile.verification_state === 'verified',
      services: profile.services,
    });

  return {
    reviews,
    work: sheetWork(completed),
    workTotal: completed.length,
    photos:
      profile && revealed
        ? (profile.portfolio_r2_keys ?? []).map((k) => publicUrlForStoredAsset(k)).filter((u): u is string => Boolean(u))
        : null,
    others: services
      ? sheetOthers(
          services.map((s) => s.category),
          input.tile,
          (category) => {
            // The live taxonomy (Admin › Categories) — a renamed or moved category reads its new name.
            const tile = taxonomy.map[category]?.tile ?? (category in taxonomy.tileLabel ? category : null);
            const label = tile ? taxonomy.tileLabel[tile] : undefined;
            return tile && label ? { tile, label } : null;
          },
        )
      : null,
    following,
    sharePath: profile && revealed && profile.business_slug ? `/v/${profile.business_slug}` : null,
  };
}
