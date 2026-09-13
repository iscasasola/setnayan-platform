'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { readGuestSession } from '@/lib/guest-session';

/**
 * Server action backing the guest-facing push-notification ask on the Seat
 * Pass (C8: notifications finally have a subscriber). Mirrors
 * apps/web/lib/push-actions.ts (the authenticated-user version), adapted for
 * guests: a guest has no Supabase auth identity (readGuestSession() reads a
 * signed cookie, never auth.uid()), so this writes via the service-role admin
 * client after verifying that session — exactly how the /[slug]/seat/claim
 * route writes scan_events for the same guest.
 *
 * The client subscribes to the browser Push Service (VAPID) first, then calls
 * this with the serialized subscription.
 */

type SaveArgs = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type GuestPushActionResult = { ok: true } | { ok: false; error: string };

export async function saveGuestPushSubscription(
  sub: SaveArgs,
): Promise<GuestPushActionResult> {
  if (!sub?.endpoint || !sub?.p256dh || !sub?.auth) {
    return { ok: false, error: 'incomplete_subscription' };
  }

  const session = await readGuestSession();
  if (!session) return { ok: false, error: 'not_a_guest' };

  const admin = createAdminClient();

  // Confirm the session's guest still exists (mirrors the /claim route's own
  // guest lookup) rather than trusting the cookie's event_id blindly.
  const { data: guest, error: guestErr } = await admin
    .from('guests')
    .select('guest_id, event_id')
    .eq('guest_id', session.guest_id)
    .eq('event_id', session.event_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (guestErr || !guest) return { ok: false, error: 'guest_not_found' };

  // Upsert on the unique endpoint: re-subscribing on the same browser
  // collapses onto one row (and re-homes it if a different guest's session is
  // active on that browser, mirroring savePushSubscription's re-home).
  const { error } = await admin.from('guest_push_subscriptions').upsert(
    {
      guest_id: guest.guest_id,
      event_id: guest.event_id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    console.error('[guest-push] saveGuestPushSubscription failed:', error.message);
    return { ok: false, error: 'save_failed' };
  }
  return { ok: true };
}
