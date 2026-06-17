/**
 * /api/notify — Supabase database webhook handler for push notifications.
 *
 * Supabase fires this route on every INSERT into `chat_messages` via the
 * `chat_messages_notify_webhook` DB trigger (net.http_post → this endpoint).
 *
 * Architecture contract:
 * - Returns 200 immediately (Supabase webhooks retry on non-2xx).
 * - All DB reads and push sends run inside Next.js `after()`.
 * - Uses the service-role admin client — the webhook call is unauthenticated.
 * - 10-minute dedup window on `chat_threads.last_push_notified_at` prevents
 *   flooding vendors with push notifications for rapid-fire messages.
 *
 * Push delivery:
 * - web  → Web Push API via `web-push` npm package + VAPID keys.
 *          Token stored in vendor_push_tokens.token is the serialised
 *          PushSubscription JSON (endpoint + keys.p256dh + keys.auth).
 * - android/ios → stubbed; native FCM/APNs wired in V1.5.
 */

import 'server-only';

import { after, NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
// Delivery
// ---------------------------------------------------------------------------

function isVapidConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    process.env.VAPID_PRIVATE_KEY,
  );
}

async function sendWebPush(
  subscriptionJson: string,
  payload: PushPayload,
): Promise<{ ok: boolean; permanentFailure: boolean }> {
  if (!isVapidConfigured()) {
    console.warn('[notify] VAPID keys not set — skipping web push');
    return { ok: false, permanentFailure: false };
  }

  let parsed: { endpoint: string; keys: { p256dh: string; auth: string } };
  try {
    parsed = JSON.parse(subscriptionJson);
  } catch {
    console.error('[notify] web push token is not valid JSON — marking stale');
    return { ok: false, permanentFailure: true };
  }

  if (!parsed?.endpoint || !parsed?.keys?.p256dh || !parsed?.keys?.auth) {
    console.error('[notify] web push token missing endpoint/p256dh/auth — marking stale');
    return { ok: false, permanentFailure: true };
  }

  try {
    const webpush = (await import('web-push')).default;
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:hello@setnayan.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );

    await webpush.sendNotification(
      { endpoint: parsed.endpoint, keys: parsed.keys },
      JSON.stringify(payload),
    );

    return { ok: true, permanentFailure: false };
  } catch (err: unknown) {
    const statusCode =
      err && typeof err === 'object' && 'statusCode' in err
        ? (err as { statusCode?: number }).statusCode
        : undefined;

    // 404 / 410 = push endpoint expired or unsubscribed — prune the token.
    if (statusCode === 404 || statusCode === 410) {
      return { ok: false, permanentFailure: true };
    }

    console.error('[notify] web push send failed', err);
    return { ok: false, permanentFailure: false };
  }
}

async function sendPushToToken(
  token: string,
  platform: 'android' | 'ios' | 'web',
  payload: PushPayload,
): Promise<{ ok: boolean; permanentFailure: boolean }> {
  if (platform === 'web') {
    return sendWebPush(token, payload);
  }

  // Native Android/iOS — stubbed until V1.5 FCM/APNs wiring.
  console.warn(`[notify] native push (${platform}) not yet wired — skipping`);
  return { ok: false, permanentFailure: false };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const secret = process.env.SUPABASE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[notify] SUPABASE_WEBHOOK_SECRET is not set');
    return NextResponse.json({ error: 'misconfigured' }, { status: 500 });
  }

  if (req.headers.get('x-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let payload: SupabaseWebhookPayload;
  try {
    payload = (await req.json()) as SupabaseWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // The DB trigger sends raw row data, not the Supabase dashboard webhook shape.
  // Normalise: if payload has no `.type`, treat the whole object as the record.
  const record: ChatMessageRecord | null =
    payload.type === 'INSERT' && payload.record
      ? payload.record
      : !payload.type && (payload as unknown as ChatMessageRecord).message_id
        ? (payload as unknown as ChatMessageRecord)
        : null;

  if (!record) {
    return NextResponse.json({ ok: true, skipped: 'not_a_chat_message_insert' });
  }

  // Couple or coordinator sent — notify vendor.
  // Vendor-sent messages are handled by the stamp_vendor_first_reply DB trigger.
  if (record.sender_role === 'vendor') {
    return NextResponse.json({ ok: true, skipped: 'vendor_sent_skip' });
  }

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
    // Dedup: skip if we notified this thread within the last 10 minutes.
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
      const msSinceLast = Date.now() - new Date(thread.last_push_notified_at).getTime();
      if (msSinceLast < 10 * 60 * 1000) return;
    }

    // Stamp before sending so concurrent firings hit the guard.
    await admin
      .from('chat_threads')
      .update({ last_push_notified_at: new Date().toISOString() })
      .eq('thread_id', thread_id);

    const { data: tokens, error: tokensError } = await admin
      .from('vendor_push_tokens')
      .select('id, token, platform')
      .eq('vendor_profile_id', vendor_profile_id)
      .eq('is_active', true);

    if (tokensError || !tokens || tokens.length === 0) {
      if (tokensError) console.error('[notify] failed to read vendor_push_tokens', tokensError.message);
      return;
    }

    const pushPayload: PushPayload = {
      title: 'New message',
      body: body.slice(0, 100),
      data: { thread_id, type: 'new_message' },
    };

    const results = await Promise.allSettled(
      tokens.map(async (row) => {
        const result = await sendPushToToken(
          row.token,
          row.platform as 'android' | 'ios' | 'web',
          pushPayload,
        );

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
    console.error('[notify] processPushNotification threw', err);
  }
}
