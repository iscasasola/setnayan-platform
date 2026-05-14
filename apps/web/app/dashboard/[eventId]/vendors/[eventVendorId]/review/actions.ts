'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createReview, type ReviewAxis } from '@/lib/reviews';

const AXES: ReadonlyArray<ReviewAxis> = [
  'overall',
  'communication',
  'quality',
  'value',
  'on_time',
];

function parseRating(raw: FormDataEntryValue | null): number {
  if (typeof raw !== 'string') {
    throw new Error('Rating is required.');
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 5) {
    throw new Error('Each rating must be 1–5 stars.');
  }
  return n;
}

/**
 * Couple-side submission. Validates everything client-side schema-style,
 * then delegates the RLS-gated INSERT to lib/reviews.ts. On success, sends
 * the user back to the vendor tracker with the new review already counted
 * via revalidatePath.
 */
export async function submitCoupleReview(formData: FormData) {
  const eventId = formData.get('event_id');
  const eventVendorId = formData.get('event_vendor_id');
  const vendorProfileId = formData.get('vendor_profile_id');

  if (
    typeof eventId !== 'string'
    || typeof eventVendorId !== 'string'
    || typeof vendorProfileId !== 'string'
  ) {
    throw new Error('Invalid input');
  }

  const ratings = {} as Record<ReviewAxis, number>;
  for (const axis of AXES) {
    ratings[axis] = parseRating(formData.get(`rating_${axis}`));
  }

  const bodyRaw = formData.get('body');
  let body: string | null = null;
  if (typeof bodyRaw === 'string') {
    const trimmed = bodyRaw.trim();
    if (trimmed.length > 4000) {
      throw new Error('Review body must be 4000 characters or fewer.');
    }
    body = trimmed.length > 0 ? trimmed : null;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await createReview(supabase, {
    vendorProfileId,
    eventId,
    coupleUserId: user.id,
    ratings,
    body,
  });

  revalidatePath(`/dashboard/${eventId}/vendors`);
  redirect(`/dashboard/${eventId}/vendors?reviewed=${eventVendorId}`);
}
