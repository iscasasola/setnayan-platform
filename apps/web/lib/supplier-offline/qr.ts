/**
 * 🔳 THE OFFLINE CLIENT QR (owner 24 Nov 2026, DECISION_LOG "The supplier dashboard works offline…": "if the supplier
 * lost internet or ran out of load, they can still book and create QR Codes by demand. when offline, QR Codes has that
 * data that this was created offline").
 *
 * It EXTENDS the shipped Add-a-client invite (`lib/own-clients.ts` — the same door, `/<shop>/invite`), never a second QR
 * system: the invite link carries one more key, `oq`, beside `ci`.
 *
 * What the code carries — and nothing else (NO personal data: the client's name stays on the supplier's phone and
 * travels in its queued copy):
 *   · the code id (one of the member device's one-time codes, `vendor_offline_codes`);
 *   · the date and time picked, and the schedule;
 *   · the member, as an opaque tag (a hash of their account id — it names nobody to anyone who reads the QR);
 *   · the made-offline mark;
 *   · the phone's time;
 *   · an HMAC-SHA256 over all of the above with THAT code's own secret, so nothing in it can be edited.
 *
 * Isomorphic and pure: the phone signs offline with WebCrypto, the server verifies with the same functions.
 */
import { shopInvitePath } from '@/lib/shop-address';

/** The invite door's key for an offline QR (beside `ci`, `CLIENT_INVITE_PARAM`). */
export const OFFLINE_QR_PARAM = 'oq';

export type OfflineQrFields = {
  /** `vendor_offline_codes.code_id` */
  codeId: string;
  /** the client's date, YYYY-MM-DD */
  date: string;
  /** HH:MM, or null when no time was picked */
  time: string | null;
  /** the schedule (`vendor_schedule_pools.pool_id`), or null for a shop with one schedule */
  poolId: string | null;
  /** `memberTagOf(member user id)` */
  member: string;
  /** made offline — always true for a code made by this module */
  madeOffline: true;
  /** the phone's clock, ISO */
  phoneTime: string;
};

const HEX_UUID = /^[0-9a-f]{32}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const OFFLINE_QR_TOKEN_RE = /^v1\.[0-9a-f]{32}\.\d{8}\.(?:\d{4}|-)\.(?:[0-9a-f]{32}|-)\.[A-Za-z0-9_-]{10}\.1\.[0-9a-z]{1,9}\.[A-Za-z0-9_-]{43}$/;

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function unb64url(s: string): Uint8Array | null {
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const compact = (uuid: string) => uuid.replace(/-/g, '').toLowerCase();
const expand = (hex: string) => `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

/** A code's secret: 32 random bytes, base64url (43 characters) — the `vendor_offline_codes.secret` shape. */
export function newOfflineCodeSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

/** The member, as the QR carries them: an opaque tag nobody can read a person from. */
export async function memberTagOf(userId: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`setnayan-offline-member:${userId.toLowerCase()}`)));
  return b64url(digest).slice(0, 10);
}

/** The exact text the signature covers (every field, in one order). */
export function offlineQrMessage(f: OfflineQrFields): string {
  const phone = Math.floor(Date.parse(f.phoneTime) / 1000).toString(36);
  return [
    'v1',
    compact(f.codeId),
    f.date.replace(/-/g, ''),
    f.time ? f.time.replace(':', '') : '-',
    f.poolId ? compact(f.poolId) : '-',
    f.member,
    '1',
    phone,
  ].join('.');
}

async function hmac(secret: string, message: string): Promise<Uint8Array | null> {
  const key = unb64url(secret);
  if (!key || key.length !== 32) return null;
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(message)));
}

function validFields(f: OfflineQrFields): boolean {
  return (
    UUID.test(f.codeId) &&
    /^\d{4}-\d{2}-\d{2}$/.test(f.date) &&
    (f.time === null || /^\d{2}:\d{2}$/.test(f.time)) &&
    (f.poolId === null || UUID.test(f.poolId)) &&
    /^[A-Za-z0-9_-]{10}$/.test(f.member) &&
    f.madeOffline === true &&
    Number.isFinite(Date.parse(f.phoneTime))
  );
}

/** Sign the fields with the code's own secret → the token the QR carries. Null when a field or the secret is bad. */
export async function signOfflineQr(f: OfflineQrFields, secret: string): Promise<string | null> {
  if (!validFields(f)) return null;
  const message = offlineQrMessage(f);
  const sig = await hmac(secret, message);
  return sig ? `${message}.${b64url(sig)}` : null;
}

export type ParsedOfflineQr = { fields: OfflineQrFields; message: string; sig: string };

/** Read a token back into its fields — shape only; `verifyOfflineQr` decides whether it is genuine. */
export function parseOfflineQrToken(raw: unknown): ParsedOfflineQr | null {
  if (typeof raw !== 'string' || !OFFLINE_QR_TOKEN_RE.test(raw)) return null;
  const [, code, date, time, pool, member, , phone, sig] = raw.split('.') as string[];
  if (!code || !HEX_UUID.test(code) || !date || !time || !pool || !member || !phone || !sig) return null;
  const seconds = parseInt(phone, 36);
  if (!Number.isFinite(seconds)) return null;
  const fields: OfflineQrFields = {
    codeId: expand(code),
    date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
    time: time === '-' ? null : `${time.slice(0, 2)}:${time.slice(2, 4)}`,
    poolId: pool === '-' ? null : expand(pool),
    member,
    madeOffline: true,
    phoneTime: new Date(seconds * 1000).toISOString(),
  };
  if (!validFields(fields)) return null;
  return { fields, message: raw.slice(0, raw.lastIndexOf('.')), sig };
}

/** Is the token signed by this secret, over exactly these fields? Constant-time over the signature. */
export async function verifyOfflineQr(parsed: ParsedOfflineQr, secret: string): Promise<boolean> {
  if (offlineQrMessage(parsed.fields) !== parsed.message) return false;
  const want = await hmac(secret, parsed.message);
  const got = unb64url(parsed.sig);
  if (!want || !got || got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want[i]! ^ got[i]!;
  return diff === 0;
}

/** The link the QR opens: the shop's invite door (the shipped `shopInvitePath`), carrying the token. */
export function offlineQrUrl(origin: string, slug: string, token: string): string {
  return `${origin.replace(/\/$/, '')}${shopInvitePath(encodeURIComponent(slug))}?${OFFLINE_QR_PARAM}=${encodeURIComponent(token)}`;
}
