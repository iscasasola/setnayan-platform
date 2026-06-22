'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

/**
 * Couple submits a feature_review — the first WRITER of public.feature_reviews
 * (the table existed read-only until now). Reached from the admin-requested
 * "we'd love your review" notification (review_request · admin account-access
 * model PR 3). Inserts via the COUPLE's own RLS-gated client: the
 * feature_reviews_couple_insert policy enforces couple_user_id = auth.uid() +
 * event ownership, so an admin can never forge a review on a couple's behalf.
 *
 * The default feature_key is 'SETNAYAN_EXPERIENCE' (a general experience review
 * a gifted couple is asked for) — distinct from per-feature keys (PANOOD, …) so
 * it never pollutes a specific feature's rating.
 */
export async function submitFeatureReview(formData: FormData) {
  const eventId = formData.get('event_id');
  const featureKey = formData.get('feature_key');
  const ratingRaw = formData.get('rating');
  const bodyRaw = formData.get('body');

  if (typeof eventId !== 'string' || eventId.length === 0) throw new Error('Invalid event.');
  if (typeof featureKey !== 'string' || featureKey.length === 0) throw new Error('Invalid feature.');
  const rating = typeof ratingRaw === 'string' ? Number.parseInt(ratingRaw, 10) : NaN;
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
    throw new Error('Pick a rating from 1 to 5 stars.');
  }
  const body =
    typeof bodyRaw === 'string' && bodyRaw.trim().length > 0 ? bodyRaw.trim().slice(0, 4000) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase.from('feature_reviews').insert({
    feature_key: featureKey,
    event_id: eventId,
    couple_user_id: user.id,
    rating,
    body,
  });

  // 23505 = unique violation → they already reviewed this feature. Treat as a
  // benign "already done" rather than an error (the page gates on it too).
  if (error && error.code !== '23505') {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/${eventId}/review`);
  redirect(`/dashboard/${eventId}/review?feature=${encodeURIComponent(featureKey)}&submitted=1`);
}
