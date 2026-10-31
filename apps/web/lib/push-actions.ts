'use server';

import { createClient } from '@/lib/supabase/server';
import { isApnsDeviceToken } from '@/lib/apns-request';

/**
 * Server actions backing the profile "Push notifications" toggle
 * (compliance/push-offline). The client subscribes to the browser Push Service
 * (VAPID), then calls savePushSubscription with the serialized subscription;
 * unsubscribing calls removePushSubscription with the endpoint.
 *
 * Writes go through the RLS-scoped user client (NOT the admin client) so a user
 * can only ever touch their own push_subscriptions rows — the policies in
 * 20261107000000_push_subscriptions.sql enforce user_id = auth.uid().
 */

type SaveArgs = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type PushActionResult = { ok: true } | { ok: false; error: string };

export async function savePushSubscription(
  sub: SaveArgs,
): Promise<PushActionResult> {
  if (!sub?.endpoint || !sub?.p256dh || !sub?.auth) {
    return { ok: false, error: 'incomplete_subscription' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  // Upsert on the unique endpoint: re-subscribing on the same browser collapses
  // onto one row (and re-homes it to whoever is signed in now). last_seen_at is
  // refreshed so we can later prune long-dormant subscriptions.
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      kind: 'web',
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );

  if (error) {
    console.error('[push] savePushSubscription failed:', error.message);
    return { ok: false, error: 'save_failed' };
  }
  return { ok: true };
}

export async function removePushSubscription(
  endpoint: string,
): Promise<PushActionResult> {
  if (!endpoint) return { ok: false, error: 'missing_endpoint' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'not_authenticated' };

  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint);

  if (error) {
    console.error('[push] removePushSubscription failed:', error.message);
    return { ok: false, error: 'delete_failed' };
  }
  return { ok: true };
}

/**
 * 📱 THE IPHONE APP'S YES (owner 2026-10-31 — replies reach the phone, and Web
 * Push cannot reach inside the app). The Capacitor push plugin hands the page
 * the APNs device token after the one-time ask; it is saved as a push
 * subscription of kind 'apns' (migration 20271300404545), through the same
 * RLS-scoped client and the same unique `endpoint` upsert as a browser row — so a
 * phone that re-registers collapses onto one row, re-homed to whoever is signed in.
 */
export async function saveApnsDeviceToken(token: string): Promise<PushActionResult> {
  if (!isApnsDeviceToken(token)) return { ok: false, error: 'bad_token' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'not_authenticated' };
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: token.toLowerCase(),
      p256dh: null,
      auth: null,
      kind: 'apns',
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' },
  );
  if (error) {
    console.error('[push] saveApnsDeviceToken failed:', error.message);
    return { ok: false, error: 'save_failed' };
  }
  return { ok: true };
}
