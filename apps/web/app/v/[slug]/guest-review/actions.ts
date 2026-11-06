'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSessionForEvent } from '@/lib/guest-one-path.server';
import {
  GUEST_REVIEW_LINE_MAX,
  GUEST_REVIEW_REFUSAL_LINE,
  guestReviewGiftFor,
  parseShownAs,
  submitGuestReview,
} from '@/lib/guest-reviews';
import type { GuestReviewSendState } from './_components/guest-review-form';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Send a guest review — the QR door's half of THE ONE WRITER (`submitGuestReview` → `vendor_guest_review_submit`).
 *
 * 🔒 WHO IS SENDING is never read from the form: the guest is the pass this browser holds for THIS event, or the seat
 * the signed-in account is bound to (`readGuestSessionForEvent`). The writer then re-checks the door check-in (or a
 * received scanner claim), that this shop is booked on the event, that the card is the shop's and the shot is the
 * guest's own. Every refusal comes back as a sentence the screen shows in place.
 */
export async function sendGuestReview(_prev: GuestReviewSendState, form: FormData): Promise<GuestReviewSendState> {
  const slug = String(form.get('slug') ?? '');
  const eventId = String(form.get('event_id') ?? '');
  const serviceId = String(form.get('service_id') ?? '');
  const captureId = String(form.get('capture_id') ?? '');
  const stars = Number(form.get('rating_overall'));
  const lineRaw = String(form.get('line') ?? '').trim();

  if (!UUID.test(eventId)) return { status: 'refused', message: GUEST_REVIEW_REFUSAL_LINE.not_at_event };
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
    return { status: 'refused', message: GUEST_REVIEW_REFUSAL_LINE.bad_stars };
  }
  if (lineRaw.length > GUEST_REVIEW_LINE_MAX) return { status: 'refused', message: GUEST_REVIEW_REFUSAL_LINE.line_too_long };

  const session = await readGuestSessionForEvent(eventId);
  if (!session) return { status: 'refused', message: GUEST_REVIEW_REFUSAL_LINE.not_at_event };

  const admin = createAdminClient();
  const { data: shop, error: shopErr } = await admin
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .eq('business_slug', slug)
    .maybeSingle();
  if (shopErr || !shop) return { status: 'refused', message: GUEST_REVIEW_REFUSAL_LINE.unknown };
  const vendorProfileId = (shop as { vendor_profile_id: string }).vendor_profile_id;

  const sent = await submitGuestReview(admin, {
    eventId,
    guestId: session.guest_id,
    vendorProfileId,
    serviceId: UUID.test(serviceId) ? serviceId : null,
    stars,
    line: lineRaw.length > 0 ? lineRaw : null,
    captureId: UUID.test(captureId) ? captureId : null,
    shownAs: parseShownAs(form.get('shown_as')),
  });
  if (!sent.ok) return { status: 'refused', message: GUEST_REVIEW_REFUSAL_LINE[sent.refusal] };

  const { data: guest } = await admin
    .from('guests')
    .select('first_name')
    .eq('guest_id', session.guest_id)
    .maybeSingle();
  const firstName = (guest as { first_name?: string | null } | null)?.first_name?.trim() || 'you';
  const gift = await guestReviewGiftFor(vendorProfileId);

  // The shop's page and its own Reviews list read the new row on their next render.
  revalidatePath(`/v/${slug}`);
  revalidatePath('/vendor-dashboard/website');
  return { status: 'sent', firstName, giftLine: gift?.line ?? null };
}
