'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { submitVendorReply, flagReviewAsFake } from '@/lib/reviews';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

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
  await requireVendorProfile(supabase);
  await submitVendorReply(supabase, reviewId, reply);

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
