'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { connectEventForUser } from '@/lib/event-account-link';
import { connectQuery } from '@/lib/invite-arrival';
import { captureEvent } from '@/lib/analytics';

/**
 * THE YES on "This invitation is for <name>. Save it to <email>?" — the ONLY
 * thing that binds a seat through `/join/{id}/connect` (2026-09-30).
 *
 * `guestId` is the seat the page showed. It is not trusted as a grant: a
 * forged id binds nothing, because `connectEventForUser` re-finds the seat this
 * account may hold here and binds only when it IS that id, un-refused. Then it
 * hands back to the connect route, which now finds the account inside and
 * lands them exactly as before (reply sheet · Reply door · set-password gate).
 */
export async function confirmSeatLinkAction(
  eventId: string,
  guestId: string,
  thenReply: boolean,
  approved: string | null,
): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const carry = connectQuery({ thenReply, approved });
  if (!user) redirect(`/login?next=${encodeURIComponent(`/join/${eventId}/connect${carry}`)}`);
  const { connected } = await connectEventForUser(eventId, user.id, user.email ?? null, {
    confirmedGuestId: guestId,
    coupleApproval: approved,
  });
  if (!connected) {
    const again = new URLSearchParams(carry.slice(1));
    again.set('failed', '1');
    redirect(`/join/${eventId}/connect/confirm?${again.toString()}`);
  }
  // The growth-loop metric login/signup used to fire when they auto-bound a
  // seat — now fired where the person actually said yes.
  void captureEvent({
    distinctId: user.id,
    event: 'guest_account_linked',
    properties: { ref: 'guest' },
  }).catch(() => {
    // Telemetry failure never blocks. Silent.
  });
  redirect(`/join/${eventId}/connect${carry}`);
}
