import 'server-only';
import { connect, type ClientHttp2Session } from 'node:http2';
import { createAdminClient } from '@/lib/supabase/admin';
import type { PushMessage } from '@/lib/push-message';
import { APNS_HOST, apnsConfigFrom, apnsJwt, apnsRequest, apnsTokenIsGone, type ApnsConfig } from '@/lib/apns-request';

/**
 * The APNs channel — native push to the iPhone app, next to `sendWebPush` in the
 * one funnel (`lib/push-send.server.ts`), sent from the same `PushMessage` and for
 * the same `PUSH_ENABLED_TYPES` (owner 2026-10-31: "The notification on the phone
 * not on the app").
 *
 * HTTP/2 to Apple with an ES256 provider token signed by the .p8 key, read from
 * five server env vars: APNS_KEY_P8 · APNS_KEY_ID · APNS_TEAM_ID · APNS_BUNDLE_ID
 * (com.setnayan.app) · APNS_ENV (production | sandbox). ⚠ When any is missing
 * the channel is a QUIET NO-OP (`isApnsConfigured()`), exactly like Web Push
 * without VAPID — the owner pastes the key into Vercel himself; no code here ever
 * prints, logs or returns it.
 *
 * Dead tokens (410 / BadDeviceToken / Unregistered) are pruned, like a 404/410
 * Web Push endpoint.
 */

let cachedJwt: { token: string; atSec: number; keyId: string } | null = null;

function config(): ApnsConfig | null {
  return apnsConfigFrom(process.env);
}

export function isApnsConfigured(): boolean {
  return config() !== null;
}

function providerToken(cfg: ApnsConfig): string {
  const nowSec = Math.floor(Date.now() / 1000);
  if (cachedJwt && cachedJwt.keyId === cfg.keyId && nowSec - cachedJwt.atSec < 50 * 60) return cachedJwt.token;
  const token = apnsJwt(cfg, nowSec);
  cachedJwt = { token, atSec: nowSec, keyId: cfg.keyId };
  return token;
}

function post(
  session: ClientHttp2Session,
  deviceToken: string,
  req: { headers: Record<string, string>; body: string },
): Promise<{ status: number; reason: string | null }> {
  return new Promise((resolve) => {
    const stream = session.request({ ':method': 'POST', ':path': `/3/device/${deviceToken}`, ...req.headers });
    let status = 0;
    let data = '';
    stream.setEncoding('utf8');
    stream.on('response', (h) => {
      status = Number(h[':status'] ?? 0);
    });
    stream.on('data', (chunk: string) => {
      data += chunk;
    });
    stream.on('end', () => {
      let reason: string | null = null;
      try {
        reason = data ? ((JSON.parse(data) as { reason?: string }).reason ?? null) : null;
      } catch {
        reason = null;
      }
      resolve({ status, reason });
    });
    stream.on('error', () => resolve({ status: 0, reason: 'stream_error' }));
    stream.setTimeout(10_000, () => {
      stream.close();
      resolve({ status: 0, reason: 'timeout' });
    });
    stream.end(req.body);
  });
}

/** Send one templated notice to every iPhone this user has registered. Never throws. */
export async function sendApns(userId: string, message: PushMessage): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  let session: ClientHttp2Session | null = null;
  try {
    const admin = createAdminClient();
    const { data: rows, error } = await admin
      .from('push_subscriptions')
      .select('id, endpoint')
      .eq('user_id', userId)
      .eq('kind', 'apns');
    if (error) {
      console.error('[apns] device lookup failed:', error.message);
      return;
    }
    if (!rows || rows.length === 0) return;

    const req = apnsRequest(message, cfg, providerToken(cfg));
    session = connect(APNS_HOST[cfg.env]);
    session.on('error', (e) => console.error('[apns] session error:', e.message));
    const gone: string[] = [];
    await Promise.all(
      (rows as { id: string; endpoint: string }[]).map(async (row) => {
        const res = await post(session!, row.endpoint, req);
        if (apnsTokenIsGone(res.status, res.reason)) gone.push(row.id);
        else if (res.status !== 200) console.error('[apns] send refused:', res.status, res.reason);
      }),
    );
    if (gone.length > 0) await admin.from('push_subscriptions').delete().in('id', gone);
  } catch (e) {
    console.error('[apns] sendApns threw:', e instanceof Error ? e.message : 'unknown');
  } finally {
    session?.close();
  }
}
