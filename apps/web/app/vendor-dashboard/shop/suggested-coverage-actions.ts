'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { resolveVendorRoleForProfile, canManageVendor } from '@/lib/vendor-role';
import { vendorCategoryForLeaf } from '@/lib/vendor-packages';
import {
  fetchPendingSignupCoverageSuggestion,
  resolveSuggestedTradeLeaves,
  markSignupSuggestionResolved,
} from '@/lib/vendor-signup-coverage-suggest-reader';

/**
 * Server actions behind My Shop's "Your website suggests you also do…" card
 * (C5, 2026-08-28). Two actions, both re-resolve everything server-side —
 * neither ever trusts a key posted from the browser, mirroring `/open-shop`'s
 * own "the server re-resolves; it never trusts the post" rule.
 *
 * ⚖ SUGGESTED, NEVER APPLIED (the ruling's second condition). This is the
 * ONLY place a signup suggestion can ever change `vendor_profiles.services` —
 * and only because a signed-in shop admin pressed a button naming exactly
 * which of ITS OWN currently-open suggestions to add. Nothing upstream of
 * this file writes to `services` on its own.
 */

export type SuggestedCoverageActionResult =
  | { ok: true; addedLabels: string[] }
  | { ok: false; error: string };

type CallerVendorProfile =
  | { error: string }
  | { supabase: Awaited<ReturnType<typeof createClient>>; profile: NonNullable<Awaited<ReturnType<typeof fetchOwnVendorProfile>>> };

async function loadCallerVendorProfile(): Promise<CallerVendorProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Please sign in again.' };

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { error: 'No shop found for this account.' };

  const role = await resolveVendorRoleForProfile(supabase, user.id, profile.vendor_profile_id);
  if (!canManageVendor(role)) {
    return { error: 'Only shop admins can change what your shop covers.' };
  }
  return { supabase, profile };
}

/**
 * Add the picked suggestions to the shop's coverage. `pickedKeys` is a set of
 * `canonical_service` keys the vendor ticked on screen — re-validated against
 * the SAME suggestion set this shop currently has open (never trusted as-is),
 * so a stale or hand-crafted post can only ever add a trade this shop was
 * actually shown.
 */
export async function applySuggestedCoverage(
  _prev: SuggestedCoverageActionResult | null,
  formData: FormData,
): Promise<SuggestedCoverageActionResult> {
  const loaded = await loadCallerVendorProfile();
  if ('error' in loaded) return { ok: false, error: loaded.error };
  const { supabase, profile } = loaded;
  const vendorProfileId = profile.vendor_profile_id as string;

  const dossierIdRaw = Number(formData.get('dossier_id'));
  const pickedKeys = new Set(
    formData.getAll('trade_key').filter((v): v is string => typeof v === 'string' && v.length > 0),
  );
  if (!Number.isFinite(dossierIdRaw) || pickedKeys.size === 0) {
    return { ok: false, error: 'Pick at least one to add.' };
  }

  const pending = await fetchPendingSignupCoverageSuggestion(
    vendorProfileId,
    (profile.services ?? []) as string[],
  );
  if (!pending || pending.dossierId !== dossierIdRaw) {
    // The suggestion already resolved (another tab, or already actioned) —
    // not an error the vendor caused; just nothing left to add.
    return { ok: true, addedLabels: [] };
  }
  const confirmed = pending.suggestions.filter((s) => pickedKeys.has(s.key));
  if (confirmed.length === 0) return { ok: true, addedLabels: [] };

  const leaves = await resolveSuggestedTradeLeaves(confirmed.map((c) => c.key));
  const existingServices = ((profile.services ?? []) as string[]).filter(Boolean);
  const wanted: string[] = [];
  for (const leaf of leaves) {
    const coarse = vendorCategoryForLeaf(leaf.canonicalService, leaf.tileId);
    if (!wanted.includes(coarse)) wanted.push(coarse);
    if (!wanted.includes(leaf.canonicalService)) wanted.push(leaf.canonicalService);
  }
  const services = [...existingServices, ...wanted.filter((s) => !existingServices.includes(s))];

  const { error } = await supabase
    .from('vendor_profiles')
    .update({ services, updated_at: new Date().toISOString() })
    .eq('vendor_profile_id', vendorProfileId);
  if (error) {
    const friendly = /row-level security/i.test(error.message)
      ? 'Only shop admins can change what your shop covers.'
      : 'Could not save just now — please try again.';
    return { ok: false, error: friendly };
  }

  await markSignupSuggestionResolved(vendorProfileId, pending.dossierId);

  revalidatePath('/vendor-dashboard/shop');
  revalidatePath('/vendor-dashboard/services');
  if (profile.business_slug) revalidatePath(`/v/${profile.business_slug}`);
  revalidatePath('/explore');

  return { ok: true, addedLabels: confirmed.map((c) => c.label) };
}

/** "Not now" — dismisses the current suggestion without touching coverage. */
export async function dismissSuggestedCoverage(
  _prev: SuggestedCoverageActionResult | null,
  formData: FormData,
): Promise<SuggestedCoverageActionResult> {
  const loaded = await loadCallerVendorProfile();
  if ('error' in loaded) return { ok: false, error: loaded.error };
  const { profile } = loaded;
  const vendorProfileId = profile.vendor_profile_id as string;

  const dossierIdRaw = Number(formData.get('dossier_id'));
  if (Number.isFinite(dossierIdRaw)) {
    await markSignupSuggestionResolved(vendorProfileId, dossierIdRaw);
  }
  revalidatePath('/vendor-dashboard/shop');
  return { ok: true, addedLabels: [] };
}
