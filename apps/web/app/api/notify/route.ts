/**
 * /api/notify — Supabase database webhook handler for push notifications.
 *
 * Supabase fires this route on every INSERT into `chat_messages` via a
 * database webhook configured in the Supabase dashboard.
 *
 * Architecture contract:
 * - Returns 200 immediately (Supabase webhooks retry on non-2xx).
 * - All DB reads and push sends run inside Next.js `after()` so the webhook
 *   gets its 200 before any downstream work is attempted.
 * - Uses the service-role admin client — the webhook call is unauthenticated.
 * - A 10-minute dedup window on `chat_threads.last_push_notified_at` prevents
 *   flooding vendors with push notifications for rapid-fire messages.
 *
 * Supabase webhook POST payload shape (table INSERT event):
 * {
 *   "type": "INSERT",
 *   "table": "chat_messages",
 *   "schema": "public",
 *   "record": { ...all columns of the inserted row... },
 *   "old_record": null
 * }
 *
 * TODO (Phase 2 — before public vendor launch):
 * - Replace the sendPushToToken stub with real FCM / APNs / Web Push calls.
 *   FCM: POST to https://fcm.googleapis.com/v1/projects/{projectId}/messages:send
 *        with Authorization: Bearer {google-oauth-token} from service account.
 *   APNs: Use the `apn` npm package with p8 key + APPLE_TEAM_ID / APPLE_KEY_ID.
 *   Web Push: Use `web-push` with VAPID keys already in lib/web-push.ts.
 * - Add env vars: FCM_PROJECT_ID, FCM_SERVICE_ACCOUNT_JSON (or FCM_SERVER_KEY
 *   for the legacy HTTP v1), APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_APNS_KEY.
 * - On permanent delivery failure (FCM: 'UNREGISTERED', APNs: 410 Gone),
 *   set vendor_push_tokens.is_active = false to prune stale tokens.
 */

import 'server-only';

import { after, NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of the `chat_messages` INSERT record in the webhook payload. */
interface ChatMessageRecord {
  message_id: string;
  thread_id: string;
  event_id: string;
  vendor_profile_id: string;
  sender_user_id: string | null;
  sender_role: 'couple' | 'vendor' | 'coordinator';
  body: string;
  created_at: string;
}

interface SupabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: ChatMessageRecord | null;
  old_record: ChatMessageRecord | null;
}

interface PushPayload {
  title: string;
  body: string;
  data: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Push stub — replace with real FCM/APNs/Web Push in Phase 2.
// ---------------------------------------------------------------------------

/**
 * Stub push sender. Logs in development, warns in production.
 *
 * TODO: In Phase 2, wire FCM, APNs, and Web Push here.
 * Each call should return whether the delivery was permanent-failed
 * (invalid/unregistered token) so the caller can deactivate the token.
 */
async function sendPushToToken(
  token: string,
  platform: 'android' | 'ios' | 'web',
  payload: PushPayload,
): Promise<{ ok: boolean; permanentFailure: boolean }> {
  // TODO: Replace with real provider calls.
  // - android/ios: FCM HTTP v1 or APNs p8 key
  // - web: `web-push` with VAPID keys (see apps/web/lib/web-push.ts for the
  //   existing couple-side Web Push setup that can be extended here)
  if (process.env.NODE_ENV === 'development') {
    console.log('[notify] [DEV STUB] would send push', {
      platform,
      token: token.slice(0, 20) + '…',
      title: payload.title,
      body: payload.body,
    });
  } else {
    console.warn(
      '[notify] push stub — FCM/APNs/Web Push not yet wired.',
      `platform=${platform} thread=${payload.data.thread_id}`,
    );
  }
  return { ok: true, permanentFailure: false };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  // 1. Authenticate the webhook — reject anything without the shared secret.
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[notify] SUPABASE_WEBHOOK_SECRET is not set — rejecting all webhook calls.');
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  const incomingSecret = req.headers.get('x-webhook-secret');
  if (incomingSecret !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2. Parse the webhook payload.
  let payload: SupabaseWebhookPayload;
  try {
    payload = (await req.json()) as SupabaseWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // We only care about INSERT events on chat_messages.
  if (
    payload.type !== 'INSERT' ||
    payload.table !== 'chat_messages' ||
    !payload.record
  ) {
    return NextResponse.json({ ok: true, skipped: 'not_a_chat_message_insert' });
  }

  const record = payload.record;

  // Only notify when the sender is the couple (or coordinator) side.
  // Vendor messages don't need to push-notify the vendor themselves.
  if (record.sender_role === 'vendor') {
    return NextResponse.json({ ok: true, skipped: 'vendor_sent_skip' });
  }

  // 3. Return 200 immediately — all processing happens in after() so Supabase
  //    doesn't wait for DB + push work before getting its success response.
  after(async () => {
    await processPushNotification(record);
  });

  return NextResponse.json({ ok: true, queued: true });
}

// ---------------------------------------------------------------------------
// Background processing (runs inside after())
// ---------------------------------------------------------------------------

async function processPushNotification(record: ChatMessageRecord): Promise<void> {
  const admin = createAdminClient();
  const { thread_id, vendor_profile_id, body } = record;

  try {
    // 4. Read last_push_notified_at — dedup within a 10-minute window.
    const { data: thread, error: threadError } = await admin
      .from('chat_threads')
      .select('last_push_notified_at')
      .eq('thread_id', thread_id)
      .single();

    if (threadError || !thread) {
      console.error('[notify] failed to read chat_threads row', threadError?.message);
      return;
    }

    if (thread.last_push_notified_at) {
      const msSinceLast =
        Date.now() - new Date(thread.last_push_notified_at).getTime();
      const DEDUP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
      if (msSinceLast < DEDUP_WINDOW_MS) {
        // Within dedup window — skip.
        return;
      }
    }

    // 5. Stamp the thread immediately so concurrent webhook firings for the
    //    same thread also hit the dedup guard.
    const { error: stampError } = await admin
      .from('chat_threads')
      .update({ last_push_notified_at: new Date().toISOString() })
      .eq('thread_id', thread_id);

    if (stampError) {
      // Non-fatal — we still try to deliver once rather than block.
      console.warn('[notify] failed to stamp last_push_notified_at', stampError.message);
    }

    // 6. Look up the vendor's active push tokens.
    const { data: tokens, error: tokensError } = await admin
      .from('vendor_push_tokens')
      .select('id, token, platform')
      .eq('vendor_profile_id', vendor_profile_id)
      .eq('is_active', true);

    if (tokensError) {
      console.error('[notify] failed to read vendor_push_tokens', tokensError.message);
      return;
    }

    if (!tokens || tokens.length === 0) {
      // No active tokens — vendor hasn't enabled push on any device.
      return;
    }

    // 7. Build the push payload.
    const pushPayload: PushPayload = {
      title: 'New message',
      body: body.slice(0, 100),
      data: {
        thread_id,
        type: 'new_message',
      },
    };

    // 8. Deliver to all active tokens concurrently.
    const results = await Promise.allSettled(
      tokens.map(async (row) => {
        const result = await sendPushToToken(
          row.token,
          row.platform as 'android' | 'ios' | 'web',
          pushPayload,
        );

        // Mark stale tokens inactive on permanent delivery failure.
        if (result.permanentFailure) {
          await admin
            .from('vendor_push_tokens')
            .update({ is_active: false })
            .eq('id', row.id);
        }

        return result;
      }),
    );

    const failures = results.filter((r) => r.status === 'rejected').length;
    if (failures > 0) {
      console.warn(`[notify] ${failures}/${results.length} push(es) threw unexpectedly`);
    }
  } catch (err) {
    // Top-level catch so a bug here never propagates back and logs cleanly.
    console.error('[notify] processPushNotification threw', err);
  }
}
