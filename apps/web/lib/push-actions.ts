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

/**
 * 📱 THE IPHONE APP'S YES (owner 2026-10-31 — replies reach the phone, and Web Push
 * cannot reach inside the app). The Capacitor plugin hands the page an APNs device
 * token; it is saved here as kind 'apns' (migration 20271300404545), through the same
 * RLS-scoped client and unique `endpoint` upsert as a browser row, so a phone that
 * re-registers collapses onto one row, re-homed to whoever is signed in. The same
 * action, not a new one: the server-action budget is at its ceiling.
 */
type SaveApnsArgs = { apnsToken: string };

/**
 * 🔕 MUTE THIS CHAT (Unichat drawing v3 · controller ruling 21 Nov 2026) — a phone-notice preference for ONE chat, for
 * ONE person: `muted: true` writes the viewer's own `chat_thread_mutes` row, `false` removes it (Pattern A — RLS holds
 * user_id = auth.uid(), so nobody can mute for someone else). Folded into this action, not a new one: the server-action
 * budget is at its ceiling. The bell row and unread counts are untouched; only the buzz stops (lib/chat-mutes.ts).
 */
type MuteChatArgs = { muteThreadId: string; muted: boolean };

export type PushActionResult = { ok: true } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function savePushSubscription(
  sub: SaveArgs | SaveApnsArgs | MuteChatArgs,
): Promise<PushActionResult> {
  if (sub && 'muteThreadId' in sub) return muteChat(sub);
  const apns = sub && 'apnsToken' in sub;
  if (apns) {
    if (!isApnsDeviceToken(sub.apnsToken)) return { ok: false, error: 'bad_token' };
  } else if (!sub?.endpoint || !sub?.p256dh || !sub?.auth) {
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
      ...(apns
        ? { endpoint: sub.apnsToken.toLowerCase(), p256dh: null, auth: null, kind: 'apns' }
        : { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth, kind: 'web' }),
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

async function muteChat({ muteThreadId, muted }: MuteChatArgs): Promise<PushActionResult> {
  if (typeof muteThreadId !== 'string' || !UUID_RE.test(muteThreadId) || typeof muted !== 'boolean') {
    return { ok: false, error: 'bad_request' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'not_authenticated' };
  const { error } = muted
    ? await supabase
        .from('chat_thread_mutes')
        .upsert({ thread_id: muteThreadId, user_id: user.id }, { onConflict: 'thread_id,user_id', ignoreDuplicates: true })
    : await supabase.from('chat_thread_mutes').delete().eq('thread_id', muteThreadId).eq('user_id', user.id);
  if (error) {
    console.error('[push] mute chat failed:', error.message);
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
