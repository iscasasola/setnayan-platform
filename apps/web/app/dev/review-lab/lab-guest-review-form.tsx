'use client';

import type { ComponentProps } from 'react';
import { GuestReviewForm, type GuestReviewSendState } from '@/app/v/[slug]/guest-review/_components/guest-review-form';

/**
 * The lab's guest form — the SHIPPED form with a Send that writes nothing and answers the thank-you, so the in-place
 * swap can be seen. A CLIENT function, not a server action: a lab must not spend a route of the server-action budget
 * (`scripts/lint-server-action-budget.mjs`).
 */
async function labSend(): Promise<GuestReviewSendState> {
  return { status: 'sent', firstName: 'Gabriel', giftLine: null };
}

export function LabGuestReviewForm(props: Omit<ComponentProps<typeof GuestReviewForm>, 'action'>) {
  return <GuestReviewForm {...props} action={labSend} />;
}
