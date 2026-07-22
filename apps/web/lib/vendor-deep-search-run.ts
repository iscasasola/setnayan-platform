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
 *   • the free-search run action (apps/web/app/vendor-dashboard/deep-search/
 *     actions.ts) — was_free=true, no order.
 *   • the paid-order sku-activation hook (lib/sku-activation.ts ·
 *     'vendor_deep_search') — was_free=false, linked to the paid order.
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
  /** TRUE = consumed the free per-cycle allowance; FALSE = a paid ₱500 run. */
  wasFree: boolean;
  /** The paid order that funded a ₱500 run (NULL for the free run). */
  orderId: string | null;
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
  await admin.from('vendor_deep_search_uses').insert({
    vendor_profile_id: vendorProfileId,
    was_free: wasFree,
    order_id: orderId,
    dossier_id: dossierId,
  });

  return { status: 'complete', dossierId, dossier, model };
}
