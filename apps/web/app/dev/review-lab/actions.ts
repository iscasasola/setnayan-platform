'use server';

import type { GuestReviewSendState } from '@/app/v/[slug]/guest-review/_components/guest-review-form';

/** The lab's Send — writes nothing; answers the thank-you so the in-place swap can be seen. */
export async function labSendGuestReview(_prev: GuestReviewSendState, _form: FormData): Promise<GuestReviewSendState> {
  return { status: 'sent', firstName: 'Gabriel', giftLine: null };
}
