'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

/**
 * Recommendations panel · vendor-scoped server actions (Phase 3a).
 *
 * BOTH writes use the NORMAL user-scoped server client (`@/lib/supabase/server`),
 * NEVER the service-role admin client — so RLS enforces ownership:
 *   • vendor_recommendation_optins  · owner ALL policy (vendor owns own rows)
 *   • vendor_recommendation_feedback · owner INSERT + SELECT policy
 * The vendor_profile_id is ALWAYS resolved server-side from the authenticated
 * user (via fetchOwnVendorProfile) — never trusted from the submitted form — so
 * a vendor can't write a row scoped to another profile even if they tamper with
 * the payload. RLS would reject it anyway (defence in depth); resolving it
 * server-side just means we never echo a foreign id back into a write.
 */

const PANEL_PATH = '/vendor-dashboard/recommendations';

/** Resolve the current user → their own vendor_profile_id, or bounce. */
async function ensureProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, vendorProfileId: profile.vendor_profile_id };
}

function back(msg: string): never {
  redirect(`${PANEL_PATH}?error=${encodeURIComponent(msg)}`);
}

/**
 * setOptIn — turn an opt-in (cannibalization-risk) recommendation ON or OFF for
 * this vendor. Upserts vendor_recommendation_optins ON CONFLICT
 * (vendor_profile_id, tile_id, service_code), flipping `enabled`.
 *
 * The (tile_id, service_code) pairing is validated against the live admin map
 * (vendor_service_recommendations · is_active · is_opt_in) so a vendor can only
 * toggle a real opt-in offer that exists for one of their leaves — not smuggle
 * an arbitrary pairing into their opt-in table.
 */
export async function setOptIn(formData: FormData) {
  const { supabase, vendorProfileId } = await ensureProfile();

  const tileId = String(formData.get('tile_id') ?? '').trim();
  const serviceCode = String(formData.get('service_code') ?? '').trim();
  const enabled = String(formData.get('enabled') ?? '') === 'true';
  if (!tileId || !serviceCode) back('Missing recommendation reference.');

  // Validate the pairing is a real, active OPT-IN recommendation. (Non-opt-in
  // recs are always-on and have no toggle, so they must never land here.)
  const { data: rec } = await supabase
    .from('vendor_service_recommendations')
    .select('id')
    .eq('tile_id', tileId)
    .eq('service_code', serviceCode)
    .eq('is_opt_in', true)
    .eq('is_active', true)
    .maybeSingle();
  if (!rec) back('That recommendation is no longer available.');

  const { error } = await supabase.from('vendor_recommendation_optins').upsert(
    {
      vendor_profile_id: vendorProfileId, // resolved server-side, never from form
      tile_id: tileId,
      service_code: serviceCode,
      enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'vendor_profile_id,tile_id,service_code' },
  );
  if (error) back(error.message);

  revalidatePath(PANEL_PATH);
  redirect(`${PANEL_PATH}?saved=1`);
}

const FEEDBACK_TYPES = ['not_a_fit', 'suggest_add'] as const;
type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/**
 * flagFeedback — record vendor feedback on the recommendation map for an admin
 * to review (status defaults to 'pending'):
 *   • not_a_fit  — "this recommendation doesn't fit my work" (tile_id +
 *                  service_code reference the flagged rec)
 *   • suggest_add — "I'd also recommend this SKU under this leaf" (tile_id +
 *                  optional service_code the vendor picked, optional note)
 *
 * The UNIQUE (vendor_profile_id, tile_id, feedback_type, service_code) means a
 * vendor can flag the same pairing once. A duplicate insert (23505) is handled
 * gracefully — we treat it as already-flagged (idempotent), not an error.
 */
export async function flagFeedback(formData: FormData) {
  const { supabase, vendorProfileId } = await ensureProfile();

  const typeRaw = String(formData.get('feedback_type') ?? '').trim();
  if (!(FEEDBACK_TYPES as readonly string[]).includes(typeRaw)) {
    back('Unknown feedback type.');
  }
  const feedbackType = typeRaw as FeedbackType;

  const tileId = String(formData.get('tile_id') ?? '').trim();
  if (!tileId) back('Missing category reference.');

  const serviceCodeRaw = String(formData.get('service_code') ?? '').trim();
  // service_code is nullable in the table. For not_a_fit it identifies the
  // flagged SKU; for suggest_add it's the (optional) SKU the vendor picked.
  const serviceCode = serviceCodeRaw.length > 0 ? serviceCodeRaw : null;

  const noteRaw = String(formData.get('note') ?? '').trim();
  const note = noteRaw.length > 0 ? noteRaw.slice(0, 1000) : null;

  // Validate the tile is one this vendor actually has recommendations for —
  // a flag must reference a real leaf in the map, not an arbitrary tile.
  const { data: tileRec } = await supabase
    .from('vendor_service_recommendations')
    .select('id')
    .eq('tile_id', tileId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (!tileRec) back('That category is no longer available to flag.');

  const { error } = await supabase.from('vendor_recommendation_feedback').insert({
    vendor_profile_id: vendorProfileId, // resolved server-side, never from form
    tile_id: tileId,
    feedback_type: feedbackType,
    service_code: serviceCode,
    note,
  });

  // 23505 = unique_violation → already flagged this exact pairing. Idempotent:
  // treat as success so the UI just shows "pending review" (no scary error).
  if (error && error.code !== '23505') {
    back(error.message);
  }

  revalidatePath(PANEL_PATH);
  redirect(`${PANEL_PATH}?flagged=1`);
}
