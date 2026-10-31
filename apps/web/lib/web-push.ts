import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { pushWireBody, type PushMessage } from '@/lib/push-message';

/**
 * Server-only Web Push fan-out (compliance/push-offline — Apple guideline 4.2).
 *
 * Sends an encrypted Web Push message to every browser/device a user has
 * registered (rows in public.push_subscriptions). Used ALONGSIDE the existing
 * in-app notification + Resend email in lib/notification-emit.ts — push is
 * strictly best-effort and never blocks or rolls back the primary action.
 *
 * Gated entirely on the VAPID env vars. When NEXT_PUBLIC_VAPID_PUBLIC_KEY +
 * VAPID_PRIVATE_KEY are unset, this no-ops and returns immediately, so the
 * build and the site work with zero push configuration. The day the owner
 * pastes VAPID keys (generated via `npx web-push generate-vapid-keys`) into
 * the environment, every notification emit also fires a push without any code
 * change — same pattern as the Resend-keyed email path.
 *
 * web-push is lazy-imported so the bundle stays clean for builds where push
 * isn't configured.
 */

/*
  🔑 THERE IS NO PAYLOAD TYPE HERE ANY MORE. A push is a `PushMessage`, and only
  `pushMessage()` in lib/push-message.ts can make one (owner 2026-10-31, "fix the
  way how the notification messages the phones") — so a sender cannot hand this
  file a title it wrote inline. Callers go through lib/push-send.server.ts.
*/

export function isWebPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

/**
 * Fan a payload out to all of a user's push subscriptions. Resolves quietly on
 * any error (missing keys, no subscriptions, send failures). Stale endpoints
 * (HTTP 404 / 410 Gone) are pruned from the table via the service-role client.
 */
export async function sendWebPush(
  userId: string,
  message: PushMessage,
): Promise<void> {
  if (!isWebPushConfigured()) return;

  try {
    const admin = createAdminClient();
    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('id,endpoint,p256dh,auth')
      .eq('user_id', userId)
      // The iPhone app's APNs tokens share this table (kind = 'apns') and go
      // through lib/apns.ts — never through the Web Push service.
      .eq('kind', 'web');

    if (error) {
      console.error('[web-push] subscription lookup failed:', error.message);
      return;
    }
    if (!subs || subs.length === 0) return;

    // Lazy-import so the bundle stays clean when push isn't used.
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:hello@setnayan.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );

    // `Topic` (RFC 8030 §5.4): the push service itself replaces an undelivered
    // message with the same topic — the network half of "replaces, never stacks";
    // the service worker's `tag` + `renotify` is the device half.
    const options = { topic: message.topic, TTL: 24 * 60 * 60 };

    const staleIds: string[] = [];

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh ?? '', auth: sub.auth ?? '' },
            },
            pushWireBody(message),
            options,
          );
        } catch (e: unknown) {
          // 404 / 410 = the Push Service dropped this endpoint; prune it so we
          // stop trying. Other errors are transient — log and move on.
          const statusCode =
            e && typeof e === 'object' && 'statusCode' in e
              ? (e as { statusCode?: number }).statusCode
              : undefined;
          if (statusCode === 404 || statusCode === 410) {
            staleIds.push(sub.id);
          } else {
            console.error('[web-push] send failed:', e);
          }
        }
      }),
    );

    if (staleIds.length > 0) {
      await admin.from('push_subscriptions').delete().in('id', staleIds);
    }
  } catch (e) {
    console.error('[web-push] sendWebPush threw:', e);
  }
}
