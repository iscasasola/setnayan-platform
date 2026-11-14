import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { openRailOptions, type OpenRail } from '@/lib/payment-channels';
import { fetchVendorAddonBandPrices, vendorAddonPriceBand } from '@/lib/vendor-addon-tier-pricing';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { VendorDossier } from '@/lib/vendor-deep-search';
import { deepSearchStillKept } from '@/lib/deep-search-findings';
import {
  deepSearchEligibility,
  resolveDeepSearchPricePhp,
} from '@/lib/vendor-deep-search-addon';

/**
 * 🔎 WHAT RUN DEEP SEARCH WILL DO FOR THIS SHOP, RIGHT NOW — one resolver for every surface that offers it.
 *
 * MOVED, NOT REWRITTEN, from `/vendor-dashboard/deep-search/page.tsx` (owner-locked 2026-07-22 + the 2026-07-25 band),
 * so Shop › Details' card (Supplier dashboard v13, 2026-10-29) and the Deep Search page offer the SAME price and the
 * same rails — and both mirror the run action (`deep-search/actions.ts`), which re-decides all of it server-side at Run.
 *
 * ⚖ 2026-11-09 (DECISION_LOG 🔎💳 "DEEP SEARCH = ₱499, ONE USE, EVERY PLAN — NO FREE SEARCH ON PRO/ULTRA"): one price on
 * every plan, one search per purchase, NO free search — so there is no cycle, no use count and no "free now" any more.
 *
 * Reads: the catalogue price, then the open pay rails (only for a verified shop — Run always costs something).
 */
export type DeepSearchOffer = {
  /** The shop is verified — the one requirement no switch lifts. */
  eligible: boolean;
  /** The plan this offer was priced for — the caller asks the paywall switch with it (`vendorPaywallApplies`, at
   *  the call site where `upsells-obey-the-switch.test.ts` can see the question being asked). */
  tier: string | null;
  /** What Run charges — the catalogue's one per-search price (never ₱0); null when the row did not read — then no
   *  figure is shown (💰 owner 2026-11-13: no typed prices; never a remembered fallback on screen). */
  pricePhp: number | null;
  /** This shop's per-search price on its plan (= `pricePhp`; kept for the page's history column). */
  cyclePricePhp: number | null;
  /** Both sides of the band, for the ⓘ (one row on both sides since 2026-11-09); null where unread. */
  band: { entryPhp: number | null; growthPhp: number | null };
  openRails: readonly OpenRail[];
};

export async function loadDeepSearchOffer(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  input: {
    vendorProfileId: string;
    tier: string | null;
    tierExpiresAt: string | null;
    verification: string | null;
  },
): Promise<DeepSearchOffer> {
  const { tier } = input;
  // TRY-FIRST (2026-09-30): eligibility is verification alone here; the plan is asked at Run, through `planAsks`.
  const eligible = deepSearchEligibility({ tier, verification: input.verification, tierPaywall: false }).ok;

  // Both sides of the band, READ from the catalogue (one row on both sides since 2026-11-09).
  const bandRead = await fetchVendorAddonBandPrices(supabase, 'deep_search_about_you');

  // A side that did not read shows NO figure (truth sweep 2026-11-13) — never a remembered one.
  const ownSide = vendorAddonPriceBand(tier) === 'growth' ? bandRead.growthPhp : bandRead.entryPhp;
  const cyclePricePhp = ownSide == null ? null : resolveDeepSearchPricePhp({ cyclePricePhp: ownSide });
  // The rails matter only for a shop that can run it; an unverified shop never shows them.
  const openRails = eligible ? openRailOptions(await fetchPlatformSettings(supabase)) : [];

  return {
    eligible,
    tier,
    pricePhp: cyclePricePhp,
    cyclePricePhp,
    // Flat (band off): the catalogue's one price is both sides — never a typed figure.
    band: { entryPhp: bandRead.entryPhp ?? cyclePricePhp, growthPhp: bandRead.growthPhp ?? cyclePricePhp },
    openRails,
  };
}

/** The shop's most recent search, for the card's "Last search" line and its PDF. */
export type LastDeepSearch =
  | { measured: false }
  | { measured: true; last: null }
  | {
      measured: true;
      last: {
        usedAt: string;
        /** `expired` — past its keep window: the result was deleted, the use row stays. */
        status: 'running' | 'complete' | 'failed' | 'expired';
        dossierId: number | null;
        /** The result's own stamp — what the keep window and the file count from. */
        createdAt: string | null;
        dossier: VendorDossier | null;
      };
    };

/**
 * One row of the shop's own uses (RLS-scoped), then its result (admin — `vendor_web_dossiers` is admin-only), only when
 * there is one. A refused read is `measured: false` — the card then says it could not be read, never "never run".
 */
export async function loadLastDeepSearch(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  vendorProfileId: string,
): Promise<LastDeepSearch> {
  try {
    const { data, error } = await supabase
      .from('vendor_deep_search_uses')
      .select('used_at, dossier_id')
      .eq('vendor_profile_id', vendorProfileId)
      .order('used_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      logQueryError('DeepSearch.lastUse', error, { vendorProfileId }, 'graceful_degrade');
      return { measured: false };
    }
    const use = data as { used_at: string; dossier_id: number | null } | null;
    if (!use) return { measured: true, last: null };
    // A purged result sets the use row's `dossier_id` to NULL (ON DELETE SET NULL) — the same shape as a search still
    // waiting, told apart by its age.
    if (!deepSearchStillKept(use.used_at, Date.now())) {
      return { measured: true, last: { usedAt: use.used_at, status: 'expired', dossierId: null, createdAt: null, dossier: null } };
    }
    if (use.dossier_id == null) {
      // A paid search waiting for its payment to be confirmed, or a free one still running.
      return { measured: true, last: { usedAt: use.used_at, status: 'running', dossierId: null, createdAt: null, dossier: null } };
    }
    const { data: d, error: dErr } = await admin
      .from('vendor_web_dossiers')
      .select('status, dossier, created_at')
      .eq('id', use.dossier_id)
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (dErr) {
      logQueryError('DeepSearch.lastResult', dErr, { vendorProfileId }, 'graceful_degrade');
      return { measured: false };
    }
    const row = d as { status: 'running' | 'complete' | 'failed'; dossier: VendorDossier | null; created_at: string } | null;
    return {
      measured: true,
      last: {
        usedAt: use.used_at,
        // The result was deleted after its keep window: the use row stays, the search is simply no longer kept.
        status: row?.status ?? 'expired',
        dossierId: row ? use.dossier_id : null,
        createdAt: row?.created_at ?? null,
        dossier: row?.dossier ?? null,
      },
    };
  } catch (err) {
    logQueryError('DeepSearch.lastUse', err, { vendorProfileId }, 'graceful_degrade');
    return { measured: false };
  }
}
