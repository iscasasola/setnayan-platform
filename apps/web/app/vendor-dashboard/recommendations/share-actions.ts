'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

/**
 * suggestToCouple — vendor → connected couple: "I'd add this buyable Studio
 * add-on to your event" (vendor-side twin of the coordinator's recommendFeature,
 * owner 2026-06-30). The couple sees it as a "Suggested by your vendors" strip in
 * their Studio hub and buys or dismisses it.
 *
 * Like the sibling recommendations actions, this uses the NORMAL user-scoped
 * server client (`@/lib/supabase/server`), NEVER the service-role admin client —
 * so RLS (vfr_vendor_insert) is the real boundary: the INSERT only lands if
 *   • recommended_by_user_id = auth.uid()  (we set it from the session), AND
 *   • the caller OWNS vendor_profile_id, AND
 *   • an ACCEPTED chat_threads row exists for (event_id, vendor_profile_id).
 * The vendor_profile_id is resolved server-side from the authenticated user
 * (fetchOwnVendorProfile) and NEVER trusted from the form, so a vendor can't
 * scope a suggestion to another profile; event_id comes from the form but is
 * gated by the accepted-thread check inside the RLS policy (a vendor can only
 * suggest to a couple they're connected to).
 */

const PANEL_PATH = '/vendor-dashboard/recommendations';

// Recommendable add-ons = real, buyable, not-free catalog entries (mirrors the
// Studio hub's isRecommendable + the coordinator action's RECOMMENDABLE_KEYS).
// A free / coming-soon feature has nothing for the couple to buy, so it can't be
// suggested (also rejects junk keys).
const RECOMMENDABLE_KEYS = new Set(
  ADD_ONS.filter(
    (a) => a.status !== 'coming_soon' && a.tier !== 'free' && Boolean(a.serviceKey),
  ).map((a) => a.key),
);

const NOTE_MAX = 280;

function back(msg: string): never {
  redirect(`${PANEL_PATH}?error=${encodeURIComponent(msg)}`);
}

export async function suggestToCouple(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const eventId = String(formData.get('event_id') ?? '').trim();
  const addonKey = String(formData.get('addon_key') ?? '').trim();
  const noteRaw = String(formData.get('note') ?? '').trim();

  if (!eventId) back('Pick a couple to suggest to.');
  if (!RECOMMENDABLE_KEYS.has(addonKey)) back('That add-on can’t be suggested.');

  const { error } = await supabase.from('vendor_feature_recommendations').insert({
    event_id: eventId,
    vendor_profile_id: profile.vendor_profile_id, // resolved server-side, never from form
    recommended_by_user_id: user.id,
    addon_key: addonKey,
    note: noteRaw ? noteRaw.slice(0, NOTE_MAX) : null,
  });

  // 23505 = unique_violation → a suggestion for this (event, vendor, add-on)
  // already exists. Idempotent: treat as success so a double-submit just shows
  // "Suggested ✓" rather than a scary error (it also never resurfaces a
  // suggestion the couple already dismissed).
  if (error && error.code !== '23505') {
    back(error.message);
  }

  revalidatePath(PANEL_PATH);
  redirect(`${PANEL_PATH}?suggested=1`);
}
