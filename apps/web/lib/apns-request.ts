/**
 * apns-request.ts — WHAT ONE APNs REQUEST SAYS, AND THE TOKEN THAT SIGNS IT.
 *
 * The pure half of `lib/apns.ts` (owner 2026-10-31: replies reach the phone, and
 * inside the iPhone app Web Push cannot — so the app gets real APNs). Kept free of
 * `server-only` and of the network so `lib/apns-request.test.ts` runs every rule:
 *
 *   · the body is the template's `PushMessage` and nothing else — `aps.alert`
 *     title/body, the badge, a sound, and the `url` a tap opens;
 *   · `apns-collapse-id` is the template's collapse key (≤64 bytes, hashed down
 *     when longer) — so a new RSVP notice REPLACES the last one on the lock
 *     screen, the same rule as the Web Push `tag`;
 *   · `apns-priority` reads the message's level (lib/push-levels.ts);
 *   · the provider token is an ES256 JWT (`kid` = APNS_KEY_ID, `iss` =
 *     APNS_TEAM_ID) signed with the .p8 key — read from the environment by the
 *     caller, never logged, never returned.
 */
import { createHash, createPrivateKey, sign } from 'node:crypto';
import type { PushMessage } from './push-message';

export const APNS_HOST = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
} as const;

export type ApnsEnv = keyof typeof APNS_HOST;

export type ApnsConfig = {
  keyP8: string;
  keyId: string;
  teamId: string;
  bundleId: string;
  env: ApnsEnv;
};

/** Reads the five server env vars. null (the channel is a quiet no-op) when any is missing. */
export function apnsConfigFrom(env: Record<string, string | undefined>): ApnsConfig | null {
  const keyP8 = env.APNS_KEY_P8?.replace(/\\n/g, '\n').trim();
  const keyId = env.APNS_KEY_ID?.trim();
  const teamId = env.APNS_TEAM_ID?.trim();
  const bundleId = env.APNS_BUNDLE_ID?.trim();
  const rawEnv = env.APNS_ENV?.trim().toLowerCase();
  if (!keyP8 || !keyId || !teamId || !bundleId) return null;
  const apnsEnv: ApnsEnv = rawEnv === 'sandbox' ? 'sandbox' : 'production';
  return { keyP8, keyId, teamId, bundleId, env: apnsEnv };
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');

/** The ES256 provider token. Apple accepts one for up to an hour; the caller reuses it ~50 minutes. */
export function apnsJwt(cfg: Pick<ApnsConfig, 'keyP8' | 'keyId' | 'teamId'>, nowSec: number): string {
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: cfg.keyId }));
  const claims = b64url(JSON.stringify({ iss: cfg.teamId, iat: nowSec }));
  const input = `${header}.${claims}`;
  const key = createPrivateKey(cfg.keyP8);
  const signature = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' });
  return `${input}.${b64url(signature)}`;
}

/** `apns-collapse-id` may be at most 64 bytes. A longer key keeps its kind and becomes a hash. */
export function apnsCollapseId(collapseKey: string): string {
  if (Buffer.byteLength(collapseKey, 'utf8') <= 64) return collapseKey;
  const kind = (collapseKey.split(':')[0] ?? 'n').slice(0, 16);
  return `${kind}:${createHash('sha256').update(collapseKey).digest('hex').slice(0, 40)}`;
}

/** A device token is hex (64 today; Apple says it may grow). Anything else is refused before saving. */
export function isApnsDeviceToken(token: unknown): token is string {
  return typeof token === 'string' && /^[0-9a-f]{64,200}$/i.test(token);
}

/** Headers + JSON body for POST /3/device/<token>. */
export function apnsRequest(
  message: PushMessage,
  cfg: Pick<ApnsConfig, 'bundleId'>,
  jwt: string,
): { headers: Record<string, string>; body: string } {
  const aps: Record<string, unknown> = {
    alert: { title: message.title, body: message.body },
    sound: 'default',
  };
  if (message.badge !== null) aps.badge = message.badge;
  return {
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': cfg.bundleId,
      'apns-push-type': 'alert',
      // 10 = deliver now; 5 = the Low evening summary, sent when it suits the phone.
      'apns-priority': message.level === 'low' ? '5' : '10',
      'apns-collapse-id': apnsCollapseId(message.collapseKey),
    },
    body: JSON.stringify({ aps, url: message.url }),
  };
}

/** Apple's answers that mean "this token is dead — stop sending to it". */
export function apnsTokenIsGone(status: number, reason: string | null): boolean {
  return status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered' || reason === 'DeviceTokenNotForTopic';
}
