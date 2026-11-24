import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { VendorDossier } from '@/lib/vendor-deep-search';
import { deepSearchStillKept } from '@/lib/deep-search-findings';
import {
  deepSearchEligibility,
  deepSearchIncluded,
  deepSearchMonth,
  deepSearchRunsLeft,
  fetchDeepSearchRunsPerMonth,
} from '@/lib/vendor-deep-search-addon';

/**
 * 🔎 WHAT RUN DEEP SEARCH WILL DO FOR THIS SHOP, RIGHT NOW — one resolver for every surface that offers it (the Deep
 * Search page and Shop › Details' card), mirroring the run action (`deep-search/actions.ts`), which re-decides all of it
 * server-side at Run.
 *
 * ⚖ 2026-11-22 (DECISION_LOG ✂️ "DEEP SEARCH IS RETIRED" + 🔎 "DEEP SEARCH ALLOWANCE = 1 RUN A MONTH"): nothing is sold
 * — no price, no pay rails. Plus, Pro and Ultra include `platform_settings.deep_search_runs_per_month` runs each paid
 * month; Free and Verified include none.
 *
 * Reads: the allowance (admin client — platform_settings is the service role's), then this month's claimed runs (the
 * shop's own rows, RLS-scoped), only for a shop whose plan includes it.
 */
export type DeepSearchAllowance =
  | { read: false }
  | {
      read: true;
      /** Runs each paid month includes; null = not set by the admin (none included). */
      perMonth: number | null;
      /** Runs already taken this month. */
      used: number;
      left: number;
      /** When the month's runs reset (nothing carries over). */
      resetsAtIso: string;
    };

export type DeepSearchOffer = {
  /** The shop is verified — the one requirement no plan lifts. */
  verified: boolean;
  /** The plan includes Deep Search (Plus, Pro, Ultra). Free and Verified: the demo + "Included in Plus · Upgrade". */
  included: boolean;
  /** Both: Run can run now (runs left are counted separately, in `allowance`). */
  eligible: boolean;
  tier: string | null;
  /** This month's runs — `{ read: false }` when either read failed, and for a plan that includes none (not asked). */
  allowance: DeepSearchAllowance;
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
  const included = deepSearchIncluded(tier);
  const verified = input.verification === 'verified';
  const eligible = deepSearchEligibility({ tier, verification: input.verification }).ok;
  if (!included) return { verified, included, eligible, tier, allowance: { read: false } };

  const month = deepSearchMonth(input.tierExpiresAt, Date.now());
  const [runs, usedRead] = await Promise.all([
    fetchDeepSearchRunsPerMonth(admin),
    supabase
      .from('vendor_deep_search_uses')
      .select('id', { count: 'exact', head: true })
      .eq('vendor_profile_id', input.vendorProfileId)
      .eq('was_free', true)
      .eq('free_cycle_start', month.startIso)
      .not('allowance_slot', 'is', null),
  ]);
  if (usedRead.error) logQueryError('DeepSearch.monthUses', usedRead.error, { vendorProfileId: input.vendorProfileId }, 'graceful_degrade');
  if (!runs.read || usedRead.error || usedRead.count === null) {
    return { verified, included, eligible, tier, allowance: { read: false } };
  }
  const used = usedRead.count;
  return {
    verified,
    included,
    eligible,
    tier,
    allowance: {
      read: true,
      perMonth: runs.perMonth,
      used,
      left: deepSearchRunsLeft(runs.perMonth, used),
      resetsAtIso: month.resetsAtIso,
    },
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
      // A search still running (an included run, or one bought before 2026-11-24 waiting for its payment).
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
