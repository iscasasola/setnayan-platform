import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { getEditorialEligibility } from '@/lib/editorial-vendor-media';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import type { ExistingMedia } from './_components/editorial-media-studio';
import { EditorialMediaBody, type EditorialEligibilityView } from './editorial-media-body';
import { resolveEventFeeGate } from '@/lib/vendor-event-fee-access.server';
import { EventLockedPage } from '@/app/vendor-dashboard/_components/event-locked-by-fee';

export const metadata = { title: 'From your camera · Supplier' };

/**
 * Vendor "From Your Vendors" submit surface (iteration 0046, Inc 2). Visible
 * only to the couple's RECOMMENDED pick (event_vendors.selection_match_rank=1)
 * for a category on this event. They add up to 3 photos + 3 five-second clips
 * of their day-of service; clips bake to a boomerang in the browser. The media
 * auto-shows on the couple's editorial once it clears the NSFW screen.
 */
export default async function VendorEditorialMediaPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // ── THE BOOKING FEE UNLOCKS THE EVENT (owner, 2026-09-20) ────────────────
  // A per-event workroom is item 1/5/6/7 of the ruling. Flag OFF ⇒ the stage is
  // always 'unlocked' and this is a no-op. Flag ON and the fee unsettled ⇒ a
  // PAGE that says the amount, the due date and where to pay — never a redirect
  // and never a 404.
  const feeGate = await resolveEventFeeGate(profile.vendor_profile_id, eventId);
  if (feeGate.stage !== 'unlocked') {
    return <EventLockedPage eventId={eventId} gate={feeGate} />;
  }

  const admin = createAdminClient();
  // ⏱ ONE ROUND TRIP: the eligibility and the event's name ask nothing of each other. Only the eligibility can throw,
  // and it was the first of the two, so the batch rejects exactly when, and with what, it did alone.
  const [eligibility, { data: ev, error: evErr }] = await Promise.all([
    getEditorialEligibility(admin, eventId, profile.vendor_profile_id),
    admin.from('events').select('display_name').eq('event_id', eventId).maybeSingle(),
  ]);
  // Hard gate (matches the submit action): only show the upload studio when the
  // booking is the couple's recommended pick AND confirmed complete.
  const eventVendorId = eligibility.eligible ? eligibility.eventVendorId : null;

  if (evErr) console.error('[supabase-error] editorial-media: event name read', evErr);

  // Existing submissions by this vendor on this event (any moderation state —
  // the vendor sees their own pending/blocked rows with a status).
  let existing: ExistingMedia[] = [];
  // C-5 (supplier audit 2026-11-17): a REFUSED read hid "Already on their editorial" and showed the full allowance.
  let existingUnread = false;
  if (eventVendorId) {
    const { data: rows, error: rowsErr } = await admin
      .from('editorial_vendor_media')
      .select('media_id, media_type, still_r2_key, boomerang_r2_key, caption, moderation_state, hidden_by_couple')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', profile.vendor_profile_id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (rowsErr) {
      console.error('[supabase-error] editorial-media: own submissions read', rowsErr);
      existingUnread = true;
    }
    existing = await Promise.all(
      ((rows ?? []) as Array<Record<string, unknown>>).map(async (r) => ({
        mediaId: String(r.media_id),
        type: r.media_type === 'clip' ? ('clip' as const) : ('photo' as const),
        stillUrl: (await displayUrlForStoredAsset(String(r.still_r2_key ?? ''))) ?? '',
        boomerangUrl:
          r.media_type === 'clip'
            ? await displayUrlForStoredAsset(String(r.boomerang_r2_key ?? ''))
            : null,
        caption: (r.caption as string | null) ?? null,
        moderationState: String(r.moderation_state ?? 'unscreened'),
        hiddenByCouple: Boolean(r.hidden_by_couple),
      })),
    );
  }

  const view: EditorialEligibilityView = eligibility.unread
    ? { kind: 'unread' }
    : eventVendorId
    ? { kind: 'open', existing, existingUnread }
    : eligibility.isRecommendedPick
      ? { kind: 'almost', disputed: Boolean(eligibility.isDisputed) }
      : { kind: 'not-recommended' };
  return (
    <EditorialMediaBody
      eventId={eventId}
      eventName={evErr ? null : ((ev?.display_name as string | null) ?? null)}
      vendorProfileId={profile.vendor_profile_id}
      view={view}
    />
  );
}
