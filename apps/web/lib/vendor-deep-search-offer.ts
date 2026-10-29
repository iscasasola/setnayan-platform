import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { openRailOptions, type OpenRail } from '@/lib/payment-channels';
import { isVendorAddonTieredPricingEnabled } from '@/lib/vendor-addon-tiered-pricing-flag';
import { resolveVendorAddonPricePhp } from '@/lib/vendor-addon-tier-pricing';
import { isTierAtLeast } from '@/lib/vendor-tier-caps';
import { vendorPaywallApplies } from '@/lib/vendor-feature-gate';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { VendorDossier } from '@/lib/vendor-deep-search';
import { deepSearchBand, deepSearchStillKept } from '@/lib/deep-search-findings';
import {
  VENDOR_DEEP_SEARCH_PERIOD_DAYS,
  deepSearchEligibility,
  deepSearchHasFreeAllowance,
  deepSearchCycleStartMs,
  countDeepSearchUsesSince,
  resolveDeepSearchPricePhp,
  fetchVendorDeepSearchPricePhp,
} from '@/lib/vendor-deep-search-addon';

/**
 * 🔎 WHAT RUN DEEP SEARCH WILL DO FOR THIS SHOP, RIGHT NOW — one resolver for every surface that offers it.
 *
 * MOVED, NOT REWRITTEN, from `/vendor-dashboard/deep-search/page.tsx` (owner-locked 2026-07-22 + the 2026-07-25 band),
 * so Shop › Details' card (Supplier dashboard v13, 2026-10-29) and the Deep Search page offer the SAME price, the same
 * free search and the same rails — and both mirror the run action (`deep-search/actions.ts`), which re-decides all of
 * it server-side at Run. The band is INJECTED as `cyclePricePhp`, never written over the resolver's answer (the
 * 2026-07-25 trap: overwriting it would delete the Pro+ free search).
 *
 * Reads, started together: the catalogue price (only while the tiered band is off — on, the band is the price), this
 * cycle's use count (only for a verified shop on a plan with a free search — nobody else's price depends on it) and the
 * open pay rails (only when the run would cost something). A Free/Solo shop's card costs one read; nothing is asked
 * twice.
 */
export type DeepSearchOffer = {
  /** The shop is verified — the one requirement no switch lifts. */
  eligible: boolean;
  /** Server-decided: Run asks for a paid plan (◆ note only). */
  planAsks: boolean;
  /** Pro+ with this cycle's free search unused. */
  isFreeNow: boolean;
  hasFreeAllowance: boolean;
  /** What Run charges now (the cycle price when this run is free — the runner's "then ₱N each"). */
  pricePhp: number;
  /** This shop's per-search price on its plan. */
  cyclePricePhp: number;
  /** Both sides of the band, for the ⓘ. */
  band: { entryPhp: number; growthPhp: number };
  periodDays: number;
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
    /** The App Store / Play Store shell sells nothing — no ◆ hint there. */
    storeShell: boolean;
  },
): Promise<DeepSearchOffer> {
  const { tier } = input;
  const tiered = isVendorAddonTieredPricingEnabled();
  const planAsks = vendorPaywallApplies(isTierAtLeast(tier, 'solo')) && !input.storeShell;
  // TRY-FIRST (2026-09-30): eligibility is verification alone here; the plan is asked at Run, through `planAsks`.
  const eligible = deepSearchEligibility({ tier, verification: input.verification, tierPaywall: false }).ok;
  const hasFreeAllowance = deepSearchHasFreeAllowance(tier);

  const catalogRead = tiered ? Promise.resolve<number | null>(null) : fetchVendorDeepSearchPricePhp(supabase);
  const usesRead =
    eligible && hasFreeAllowance
      ? countDeepSearchUsesSince(
          admin,
          input.vendorProfileId,
          new Date(deepSearchCycleStartMs(input.tierExpiresAt, Date.now())).toISOString(),
        )
      : Promise.resolve(1);
  const [catalogPhp, usesThisCycle] = await Promise.all([catalogRead, usesRead]);

  const cyclePricePhp = tiered ? resolveVendorAddonPricePhp('deep_search_about_you', tier) : (catalogPhp as number);
  const priceNow = eligible ? resolveDeepSearchPricePhp({ tier, usesThisCycle, cyclePricePhp }) : cyclePricePhp;
  const isFreeNow = eligible && priceNow <= 0;
  // The rails matter only when Run would cost something; a free run and an unverified shop never show them.
  const openRails = eligible && !isFreeNow ? openRailOptions(await fetchPlatformSettings(supabase)) : [];

  return {
    eligible,
    planAsks,
    isFreeNow,
    hasFreeAllowance,
    pricePhp: priceNow > 0 ? priceNow : cyclePricePhp,
    cyclePricePhp,
    // Flat (band off): the catalogue's one price is both sides — never a typed figure.
    band: deepSearchBand({ tiered, catalogPhp: tiered ? 0 : cyclePricePhp }),
    periodDays: VENDOR_DEEP_SEARCH_PERIOD_DAYS,
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
