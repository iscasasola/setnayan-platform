'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ADD_ONS } from '@/lib/add-ons-catalog';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { emitNotification } from '@/lib/notification-emit';
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

  const note = noteRaw ? noteRaw.slice(0, NOTE_MAX) : null;

  const { error } = await supabase.from('vendor_feature_recommendations').insert({
    event_id: eventId,
    vendor_profile_id: profile.vendor_profile_id, // resolved server-side, never from form
    recommended_by_user_id: user.id,
    addon_key: addonKey,
    note,
  });

  // 23505 = unique_violation → a suggestion for this (event, vendor, add-on)
  // already exists. Idempotent: treat as success so a double-submit just shows
  // "Suggested ✓" rather than a scary error (it also never resurfaces a
  // suggestion the couple already dismissed). Any OTHER error is real.
  if (error && error.code !== '23505') {
    back(error.message);
  }

  // Notify the couple ONLY on a fresh suggestion (never the idempotent
  // re-submit, so we don't re-ping them). Delivery is the whole point — a
  // suggestion otherwise just sits in the Studio hub until they happen to visit.
  // emitNotification fires the in-app card always + an email (the type is on the
  // email allowlist) so it reaches a couple who isn't currently in the app.
  // Recipient lookup needs the admin client — the vendor can't read the couple's
  // event_members under RLS — but the INSERT above already cleared the RLS
  // accepted-thread gate, so this only addresses an already-authorized message.
  // Best-effort: emitNotification fails soft, so a notify hiccup never fails the
  // suggestion the couple can already see in their hub.
  if (!error) {
    const addonLabel = ADD_ONS.find((a) => a.key === addonKey)?.label ?? 'a service';
    const admin = createAdminClient();
    const { data: members } = await admin
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('member_type', 'couple');
    await Promise.all(
      (members ?? []).map((m) =>
        emitNotification({
          userId: (m as { user_id: string }).user_id,
          type: 'vendor_feature_suggested',
          title: `${profile.business_name} suggested ${addonLabel}`,
          body: note,
          relatedUrl: `/dashboard/${eventId}/studio`,
        }),
      ),
    );
  }

  revalidatePath(PANEL_PATH);
  redirect(`${PANEL_PATH}?suggested=1`);
}
