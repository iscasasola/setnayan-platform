'use server';

import { revalidatePath } from 'next/cache';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import { createClient } from '@/lib/supabase/server';

// Coordinator "recommend a feature" prompt (owner 2026-06-22).
//
// A booked coordinator (event delegate / moderator) suggests a paid Studio
// add-on; the couple sees a "Suggested by your coordinator" badge in the Studio
// hub and buys or dismisses it. RLS does the real gating
// (coordinator_feature_recommendations): the coordinator can only INSERT/SELECT
// on events they're an accepted delegate of, and ONLY the couple can resolve
// (dismiss) a recommendation. These actions add validation + revalidation on
// top of that boundary — they never bypass it (no admin client).

// Recommendable add-ons = real, buyable, not-free catalog entries. A free or
// coming-soon feature has nothing for the couple to buy, so it can't be
// recommended (also rejects junk keys).
const RECOMMENDABLE_KEYS = new Set(
  ADD_ONS.filter(
    (a) => a.status !== 'coming_soon' && a.tier !== 'free' && Boolean(a.serviceKey),
  ).map((a) => a.key),
);

const NOTE_MAX = 280;

function str(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === 'string' ? v : '';
}

/**
 * Coordinator → couple: suggest a buyable add-on. Idempotent — re-recommending
 * an add-on that's already on the couple's list is a no-op (ON CONFLICT DO
 * NOTHING), so it never resurfaces a suggestion the couple already dismissed.
 * RLS rejects any event the caller isn't an accepted delegate of.
 */
export async function recommendFeature(formData: FormData) {
  const eventId = str(formData, 'event_id');
  const addonKey = str(formData, 'addon_key');
  const noteRaw = str(formData, 'note').trim();

  if (!eventId || !RECOMMENDABLE_KEYS.has(addonKey)) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('coordinator_feature_recommendations').upsert(
    {
      event_id: eventId,
      addon_key: addonKey,
      note: noteRaw ? noteRaw.slice(0, NOTE_MAX) : null,
      recommended_by_user_id: user.id,
    },
    { onConflict: 'event_id,addon_key', ignoreDuplicates: true },
  );

  revalidatePath(`/dashboard/${eventId}/studio`);
}

/**
 * Couple → dismiss a coordinator's suggestion. Only the couple can resolve a
 * recommendation (RLS UPDATE policy); flips a pending row to dismissed so the
 * badge clears and it can't reappear.
 */
export async function dismissRecommendation(formData: FormData) {
  const eventId = str(formData, 'event_id');
  const addonKey = str(formData, 'addon_key');

  if (!eventId || !addonKey) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('coordinator_feature_recommendations')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('addon_key', addonKey)
    .eq('status', 'pending');

  revalidatePath(`/dashboard/${eventId}/studio`);
}

/**
 * Couple → dismiss a VENDOR's suggestion (vendor-side twin of
 * dismissRecommendation, owner 2026-06-30). Only the couple can resolve a
 * recommendation (RLS `vfr_couple_update`, scoped to current_couple_event_ids());
 * flips a pending row to dismissed so the "Suggested by your vendors" strip
 * clears and it can't reappear.
 *
 * A vendor recommendation is keyed by (event_id, vendor_profile_id, addon_key)
 * — unlike the coordinator table there can be one per vendor, so we MUST narrow
 * by vendor_profile_id too (otherwise dismissing Vendor A's Papic suggestion
 * would also clear Vendor B's). The render passes vendor_profile_id alongside
 * addon_key; both are couple-readable under RLS, so trusting them here only
 * scopes the UPDATE — it can never reach another couple's event (the UPDATE
 * policy's USING/WITH CHECK still bounds it to current_couple_event_ids()).
 */
export async function dismissVendorRecommendation(formData: FormData) {
  const eventId = str(formData, 'event_id');
  const vendorProfileId = str(formData, 'vendor_profile_id');
  const addonKey = str(formData, 'addon_key');

  if (!eventId || !vendorProfileId || !addonKey) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('vendor_feature_recommendations')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .eq('addon_key', addonKey)
    .eq('status', 'pending');

  revalidatePath(`/dashboard/${eventId}/studio`);
}
