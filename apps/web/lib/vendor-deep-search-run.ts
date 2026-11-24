import type { SupabaseClient } from '@supabase/supabase-js';
import {
  runDeepSearchOrLite,
  type DeepSearchInputs,
  type VendorDossier,
} from '@/lib/vendor-deep-search';

/**
 * vendor-deep-search-run.ts — the ONE server-side seam that RUNS a vendor-facing
 * Deep Search and RECORDS it. Shared by both entry points so the search only
 * ever runs one way:
 *   • the run action (apps/web/app/vendor-dashboard/deep-search/actions.ts) —
 *     one of the paid month's INCLUDED runs (owner 2026-11-22, "Deep Search 1 a
 *     month"): was_free=true, no order, claimed first by
 *     {@link claimIncludedDeepSearchRun}.
 *   • the paid-order sku-activation hook (lib/sku-activation.ts ·
 *     'vendor_deep_search') — was_free=false, linked to the paid order. Nothing
 *     is sold any more (the ₱499 row retired 2026-11-22); it only runs searches
 *     bought before that.
 *
 * It REUSES the admin deep-search engine (lib/vendor-deep-search.ts ·
 * runDeepSearchOrLite: the AI dossier when ANTHROPIC_API_KEY is set, else the
 * free keyless Lite pass) and the admin dossier STORE (vendor_web_dossiers) — no
 * second web-gatherer is built. The vendor never reads vendor_web_dossiers under
 * RLS (it's admin-only); the surface resolves the vendor's OWN dossiers by the
 * explicit id list carried on their vendor_deep_search_uses rows.
 *
 * Server-only (imports the engine, which imports @anthropic-ai/sdk). Takes the
 * ADMIN Supabase client — writes to vendor_web_dossiers (admin-RLS) +
 * vendor_deep_search_uses (no vendor-write policy).
 */

/** First gallery video link that lives on a social host — a helpful extra URL
 *  for the researcher (best-effort; null when none looks social). */
export function pickSocialUrl(links: string[] | null | undefined): string | null {
  for (const l of links ?? []) {
    if (/instagram\.com|facebook\.com|fb\.com|tiktok\.com/i.test(l)) return l;
  }
  return null;
}

/** The vendor-profile fields Deep Search reads about the vendor's OWN business. */
export type VendorDeepSearchProfileFacts = {
  business_name: string;
  website: string | null;
  location_city: string | null;
  services: string[] | null;
  gallery_video_links: string[] | null;
};

/** Build the {@link DeepSearchInputs} snapshot from a vendor profile — the ONE
 *  place both entry points (the free-run action + the paid-order activation
 *  hook) assemble inputs, so the two can never drift. */
export function buildVendorDeepSearchInputs(p: VendorDeepSearchProfileFacts): DeepSearchInputs {
  return {
    business_name: p.business_name,
    website: p.website ?? null,
    social_url: pickSocialUrl(p.gallery_video_links),
    location_city: p.location_city ?? null,
    claimed_services: p.services ?? [],
  };
}

export type RunVendorDeepSearchArgs = {
  /** RLS-bypassing service-role client (writes the admin-only dossier store). */
  admin: SupabaseClient;
  vendorProfileId: string;
  /** The vendor user who initiated the search (stored as requested_by). */
  requestedByUserId: string | null;
  inputs: DeepSearchInputs;
  /** TRUE = one of the paid month's included runs; FALSE = a run an order paid for (bought before 2026-11-24). */
  wasFree: boolean;
  /** The paid order that funded the run (NULL for an included run). */
  orderId: string | null;
  /**
   * The id of a usage row PRE-CLAIMED by the caller BEFORE the run (the included
   * run's atomic claim, {@link claimIncludedDeepSearchRun}). When set, the finished dossier is linked to THIS row
   * instead of inserting a new usage row — so the allowance is claimed exactly
   * once, at claim time, not after the run. NULL/omitted = the legacy behavior
   * (insert a fresh usage row on success — used by the paid-order activation hook).
   */
  claimUseId?: number | null;
};

export type RunVendorDeepSearchResult =
  | { status: 'complete'; dossierId: number; dossier: VendorDossier; model: string }
  | { status: 'failed'; dossierId: number | null; error: string };

/**
 * Run the deep search and record it. On SUCCESS: the dossier row flips to
 * 'complete' AND a vendor_deep_search_uses row is written (so the run counts
 * against the allowance / shows in history). On FAILURE: the dossier row flips to
 * 'failed' with the error and NO usage row is written — a failed run never burns
 * the free allowance and never counts toward the cycle (the caller can surface a
 * retry). NEVER throws for a normal search miss (the Lite pass returns an honest
 * empty dossier rather than erroring); only a genuine infra fault (e.g. the
 * dossier insert failing) surfaces as a 'failed' result.
 */
export async function runAndRecordVendorDeepSearch(
  args: RunVendorDeepSearchArgs,
): Promise<RunVendorDeepSearchResult> {
  const { admin, vendorProfileId, requestedByUserId, inputs, wasFree, orderId } = args;
  const claimUseId = args.claimUseId ?? null;

  // (1) Open a 'running' dossier row so a slow/failed run is still traceable.
  const { data: row, error: insErr } = await admin
    .from('vendor_web_dossiers')
    .insert({
      vendor_profile_id: vendorProfileId,
      application_id: null,
      status: 'running',
      requested_by: requestedByUserId,
      inputs,
    })
    .select('id')
    .maybeSingle();
  if (insErr || !row) {
    return { status: 'failed', dossierId: null, error: 'Could not open a Deep Search record.' };
  }
  const dossierId = (row as { id: number }).id;

  // (2) Run the research pass (AI dossier when keyed, else keyless Lite).
  let dossier: VendorDossier;
  let model: string;
  try {
    const result = await runDeepSearchOrLite(inputs);
    dossier = result.dossier;
    model = result.model;
  } catch (e) {
    const error = e instanceof Error ? e.message : 'Deep Search failed — please try again.';
    await admin
      .from('vendor_web_dossiers')
      .update({ status: 'failed', error, completed_at: new Date().toISOString() })
      .eq('id', dossierId);
    return { status: 'failed', dossierId, error };
  }

  // (3) Store the finished dossier.
  const { error: updErr } = await admin
    .from('vendor_web_dossiers')
    .update({ status: 'complete', dossier, model, completed_at: new Date().toISOString() })
    .eq('id', dossierId);
  if (updErr) {
    return { status: 'failed', dossierId, error: 'Could not save the Deep Search result.' };
  }

  // (4) Log the use — this is what the allowance counter reads. Only on success,
  //     so a failed run never counts. was_free records which side of the free
  //     allowance the run landed on.
  //
  //     When the caller PRE-CLAIMED the allowance (free-run atomic-claim path),
  //     the usage row already exists — LINK the dossier to it instead of inserting
  //     a duplicate. Otherwise (paid-order activation hook) insert a fresh row.
  if (claimUseId != null) {
    await admin
      .from('vendor_deep_search_uses')
      .update({ dossier_id: dossierId })
      .eq('id', claimUseId);
  } else {
    await admin.from('vendor_deep_search_uses').insert({
      vendor_profile_id: vendorProfileId,
      was_free: wasFree,
      order_id: orderId,
      dossier_id: dossierId,
    });
  }

  return { status: 'complete', dossierId, dossier, model };
}

// ── The paid month's included runs (owner 2026-11-22, "Deep Search 1 a month") ─────────────────────────────────────

export type ClaimIncludedRunResult =
  | { claimed: true; useId: number; slot: number }
  /** Every included run of this month is taken (or none is included). */
  | { claimed: false; reason: 'used_up' }
  /** The claim could not be written — nothing was taken; say so, never run. */
  | { claimed: false; reason: 'failed' };

/** Postgres unique_violation — another press already holds that slot. */
const UNIQUE_VIOLATION = '23505';

/**
 * CLAIM one of this paid month's included runs BEFORE the search runs, so the allowance can never be overspent. Tries
 * slot 1, then 2, … up to `perMonth`; the partial unique index `vendor_deep_search_uses_month_slot_uidx`
 * (vendor, month start, slot) makes each insert atomic, so a burst of presses serialises and at most `perMonth` rows
 * land. The row carries no dossier yet: {@link runAndRecordVendorDeepSearch} links it (`claimUseId`) on success, and the
 * caller hands it back with {@link releaseIncludedDeepSearchRun} on failure — a failed run never spends a run.
 */
export async function claimIncludedDeepSearchRun(
  admin: SupabaseClient,
  input: { vendorProfileId: string; monthStartIso: string; perMonth: number | null },
): Promise<ClaimIncludedRunResult> {
  const max = input.perMonth === null ? 0 : Math.min(31, Math.max(0, Math.trunc(input.perMonth)));
  for (let slot = 1; slot <= max; slot++) {
    const { data, error } = await admin
      .from('vendor_deep_search_uses')
      .insert({
        vendor_profile_id: input.vendorProfileId,
        was_free: true,
        order_id: null,
        dossier_id: null,
        free_cycle_start: input.monthStartIso,
        allowance_slot: slot,
      })
      .select('id')
      .maybeSingle();
    if (!error && data) return { claimed: true, useId: (data as { id: number }).id, slot };
    if (error && (error as { code?: string }).code === UNIQUE_VIOLATION) continue;
    console.error('[supabase-error] vendor-deep-search-run: claim', error);
    return { claimed: false, reason: 'failed' };
  }
  return { claimed: false, reason: 'used_up' };
}

/** Hand a claimed run back (the search failed), so the month still has it. Only ever an unlinked claim row. */
export async function releaseIncludedDeepSearchRun(admin: SupabaseClient, useId: number): Promise<void> {
  const { error } = await admin
    .from('vendor_deep_search_uses')
    .delete()
    .eq('id', useId)
    .eq('was_free', true)
    .is('dossier_id', null);
  if (error) console.error('[supabase-error] vendor-deep-search-run: release', error);
}
