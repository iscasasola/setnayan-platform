'use server';

/**
 * V2 Phase F · Host-side wrapper actions.
 *
 * Wraps the cancelGig() vendor-dashboard action in a FormData adapter so
 * the host page can dispatch via `<form action={cancelGigFromHost}>`. The
 * underlying cancel logic lives in /vendor-dashboard/manpower/actions.ts
 * because the RLS policy permits either host OR vendor to UPDATE
 * status='cancelled' (the host-reads-own-event SELECT policy + the UPDATE
 * being non-vendor-scoped means the host's auth.uid() can cancel via the
 * standard supabase-server client).
 */

import { redirect } from 'next/navigation';
import { cancelGig } from '@/app/vendor-dashboard/manpower/actions';

export async function cancelGigFromHost(formData: FormData): Promise<void> {
  const gigId = formData.get('gig_id');
  const eventId = formData.get('event_id');
  const reason = formData.get('reason');

  if (typeof gigId !== 'string' || typeof eventId !== 'string') {
    redirect('/dashboard');
  }
  const reasonStr = typeof reason === 'string' ? reason : '';

  const result = await cancelGig(gigId, reasonStr);
  if (result.status === 'ok') {
    redirect(`/dashboard/${eventId}/manpower?cancelled=1`);
  }
  const message =
    result.status === 'error'
      ? result.message
      : result.status === 'not_signed_in'
        ? 'Sign in to manage gigs.'
        : 'Could not cancel this gig.';
  redirect(
    `/dashboard/${eventId}/manpower?error=` + encodeURIComponent(message),
  );
}
