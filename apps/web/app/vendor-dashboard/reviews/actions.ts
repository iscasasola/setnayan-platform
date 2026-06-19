'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { submitVendorReply, flagReviewAsFake } from '@/lib/reviews';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { emitNotification } from '@/lib/notification-emit';

async function requireVendorProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) throw new Error('Vendor profile not found.');
  return { user, profile };
}

/**
 * Post or edit a vendor reply on a review.
 * The DB trigger stamps vendor_reply_at on first write and refreshes it on
 * subsequent edits. RLS enforces the vendor owns the review's vendor_profile.
 */
export async function postVendorReply(formData: FormData) {
  const reviewId = formData.get('review_id');
  const reply = formData.get('reply');
  if (typeof reviewId !== 'string' || typeof reply !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const { profile } = await requireVendorProfile(supabase);
  await submitVendorReply(supabase, reviewId, reply);

  // Cross-account signal (Phase B · 2026-06-19): tell the couple the vendor
  // replied to their review. Resolve the review's couple_user_id + event_id
  // through the vendor's own session (RLS lets the vendor read reviews on their
  // profile). Best-effort — never blocks the reply that already saved. Skip
  // anonymized/deleted reviewers (couple_user_id NULL after ON DELETE SET NULL).
  try {
    const { data: review } = await supabase
      .from('vendor_reviews')
      .select('couple_user_id, event_id')
      .eq('review_id', reviewId)
      .maybeSingle();
    const coupleUserId = (review as { couple_user_id?: string | null } | null)
      ?.couple_user_id;
    if (coupleUserId) {
      const eventId = (review as { event_id?: string | null } | null)?.event_id;
      const vendorName = profile.business_name?.trim() || 'A vendor';
      await emitNotification({
        userId: coupleUserId,
        type: 'vendor_review_reply',
        title: `${vendorName} replied to your review`,
        body: 'A vendor responded to the review you left. Open it to read their reply.',
        relatedUrl: eventId ? `/dashboard/${eventId}/vendors` : '/dashboard',
      });
    }
  } catch (e) {
    console.error('[vendor-reviews] reply notify failed:', e);
  }

  revalidatePath('/vendor-dashboard/reviews');
}

/**
 * Vendor flags a review as fake/disputed, routing it to the HQ fake-flag
 * queue in /admin/reviews. A vendor can only flag a review once (unique
 * constraint surfaces a clear user-facing message on duplicates).
 */
export async function submitFlagAsFake(formData: FormData) {
  const reviewId = formData.get('review_id');
  const reason = formData.get('reason');
  if (typeof reviewId !== 'string' || typeof reason !== 'string') {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const { profile } = await requireVendorProfile(supabase);
  await flagReviewAsFake(supabase, reviewId, profile.vendor_profile_id, reason);

  revalidatePath('/vendor-dashboard/reviews');
}
