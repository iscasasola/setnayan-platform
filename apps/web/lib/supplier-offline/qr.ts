/**
 * 🔳 THE OFFLINE CLIENT QR, NO STOCK (owner 24 Nov 2026, DECISION_LOG 7d618cb3 "Offline QR: each phone signs its own
 * codes, no stock"; R8). It EXTENDS the shipped Add-a-client invite (`lib/own-clients.ts` — the same door,
 * `/<shop>/invite`), never a second QR system: the invite link carries one more key, `oq`, beside `ci`.
 *
 *   · THE KEY. The first time a member opens the dashboard online on a phone, the phone makes an ECDSA P-256 key pair
 *     with `extractable: false`; the private key stays in the phone's IndexedDB and cannot be copied off it. Only the
 *     public half is registered (`vendor_offline_devices`). The server stores no secret.
 *   · THE CODE. Offline, each QR gets a new random code id and is signed by the phone over every field below. As many
 *     as needed: nothing to refill, nothing to run out of, no "codes left".
 *   · THE PAYLOAD — and nothing else (NO personal data: the client's name stays on the supplier's phone and travels in
 *     its queued copy): code id · phone (device id) · shop · member (an opaque tag, a hash of their account id) · date
 *     and time · schedule · the amount shown · the made-offline mark · the phone's time.
 *   · THE CHECK. The server verifies the signature against that phone's ACTIVE public key with node:crypto
 *     (`./qr.server.ts`) and takes each code id once. A stopped phone, an edited payload or a code used twice is refused.
 *
 * This module is isomorphic (the phone signs with WebCrypto); the verification lives in `qr.server.ts` so no node
 * module ever reaches a browser bundle.
 */
import { shopInvitePath } from '@/lib/shop-address';

/** The invite door's key for an offline QR (beside `ci`, `CLIENT_INVITE_PARAM`). */
export const OFFLINE_QR_PARAM = 'oq';

export type OfflineQrFields = {
  /** a new random UUID per QR — `vendor_offline_code_uses.code_id` */
  codeId: string;
  /** the phone's key (`vendor_offline_devices.device_id`) */
  deviceId: string;
  /** `vendor_profile_id` */
  shop: string;
  /** `memberTagOf(member user id)` */
  member: string;
  /** the client's date, YYYY-MM-DD */
  date: string;
  /** HH:MM, or null when no time was picked */
  time: string | null;
  /** the schedule (`vendor_schedule_pools.pool_id`), or null for a shop with one schedule */
  poolId: string | null;
  /** the amount the QR showed (whole ₱), or null — kept for the record; nothing is charged from it */
  amountPhp: number | null;
  /** made offline — always true for a code made by this module */
  madeOffline: true;
  /** the phone's clock, ISO */
  phoneTime: string;
};

/** A public key as the server keeps it: an EC P-256 JWK, never with the private part. */
export type PublicKeyJwk = { kty: 'EC'; crv: 'P-256'; x: string; y: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DEVICE_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
export const OFFLINE_QR_TOKEN_RE =
  /^v2\.[0-9a-f]{32}\.[A-Za-z0-9_-]{16,64}\.[0-9a-f]{32}\.[A-Za-z0-9_-]{10}\.\d{8}\.(?:\d{4}|-)\.(?:[0-9a-f]{32}|-)\.(?:\d{1,9}|-)\.1\.[0-9a-z]{1,9}\.[A-Za-z0-9_-]{86}$/;

const enc = new TextEncoder();

export function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64url(s: string): Uint8Array | null {
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

/** Is this the public half of an EC P-256 key — and ONLY the public half? */
export function isPublicKeyJwk(v: unknown): v is PublicKeyJwk {
  if (!v || typeof v !== 'object') return false;
  const k = v as Record<string, unknown>;
  return (
    k.kty === 'EC' &&
    k.crv === 'P-256' &&
    typeof k.x === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(k.x) &&
    typeof k.y === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(k.y) &&
    !('d' in k)
  );
}

/** The member, as the QR carries them: an opaque tag nobody can read a person from. */
export async function memberTagOf(userId: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`setnayan-offline-member:${userId.toLowerCase()}`)));
  return b64url(digest).slice(0, 10);
}

/** A new random code id — one per QR. */
export function newOfflineCodeId(): string {
  return crypto.randomUUID();
}

/** The phone's key, made once online. The private half is NOT extractable: it can sign, never be read or copied. */
export async function newPhoneKey(): Promise<{ deviceId: string; privateKey: CryptoKey; publicJwk: PublicKeyJwk }> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify'])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const publicJwk: PublicKeyJwk = { kty: 'EC', crv: 'P-256', x: String(jwk.x), y: String(jwk.y) };
  return { deviceId: compact(crypto.randomUUID()), privateKey: pair.privateKey, publicJwk };
}

function validFields(f: OfflineQrFields): boolean {
  return (
    UUID.test(f.codeId) &&
    DEVICE_ID_RE.test(f.deviceId) &&
    UUID.test(f.shop) &&
    /^[A-Za-z0-9_-]{10}$/.test(f.member) &&
    /^\d{4}-\d{2}-\d{2}$/.test(f.date) &&
    (f.time === null || /^\d{2}:\d{2}$/.test(f.time)) &&
    (f.poolId === null || UUID.test(f.poolId)) &&
    (f.amountPhp === null || (Number.isInteger(f.amountPhp) && f.amountPhp >= 0 && f.amountPhp < 1e9)) &&
    f.madeOffline === true &&
    Number.isFinite(Date.parse(f.phoneTime))
  );
}

/** The exact text the signature covers (every field, in one order). */
export function offlineQrMessage(f: OfflineQrFields): string {
  return [
    'v2',
    compact(f.codeId),
    f.deviceId,
    compact(f.shop),
    f.member,
    f.date.replace(/-/g, ''),
    f.time ? f.time.replace(':', '') : '-',
    f.poolId ? compact(f.poolId) : '-',
    f.amountPhp === null ? '-' : String(f.amountPhp),
    '1',
    Math.floor(Date.parse(f.phoneTime) / 1000).toString(36),
  ].join('.');
}

/** Sign the fields with the phone's private key → the token the QR carries. Null when a field is bad. */
export async function signOfflineQr(f: OfflineQrFields, privateKey: CryptoKey): Promise<string | null> {
  if (!validFields(f)) return null;
  const message = offlineQrMessage(f);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, enc.encode(message)));
  return sig.length === 64 ? `${message}.${b64url(sig)}` : null;
}

export type ParsedOfflineQr = { fields: OfflineQrFields; message: string; sig: string };

/** Read a token back into its fields — shape only; `qr.server.ts` decides whether it is genuine. */
export function parseOfflineQrToken(raw: unknown): ParsedOfflineQr | null {
  if (typeof raw !== 'string' || !OFFLINE_QR_TOKEN_RE.test(raw)) return null;
  const [, code, device, shop, member, date, time, pool, amt, , phone, sig] = raw.split('.') as string[];
  if (!code || !device || !shop || !member || !date || !time || !pool || !amt || !phone || !sig) return null;
  const seconds = parseInt(phone, 36);
  if (!Number.isFinite(seconds)) return null;
  const fields: OfflineQrFields = {
    codeId: expand(code),
    deviceId: device,
    shop: expand(shop),
    member,
    date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`,
    time: time === '-' ? null : `${time.slice(0, 2)}:${time.slice(2, 4)}`,
    poolId: pool === '-' ? null : expand(pool),
    amountPhp: amt === '-' ? null : Number(amt),
    madeOffline: true,
    phoneTime: new Date(seconds * 1000).toISOString(),
  };
  if (!validFields(fields)) return null;
  const message = raw.slice(0, raw.lastIndexOf('.'));
  // The fields must say back exactly what was signed — no second spelling of the same token.
  if (offlineQrMessage(fields) !== message) return null;
  return { fields, message, sig };
}

/** The link the QR opens: the shop's invite door (the shipped `shopInvitePath`), carrying the token. */
export function offlineQrUrl(origin: string, slug: string, token: string): string {
  return `${origin.replace(/\/$/, '')}${shopInvitePath(encodeURIComponent(slug))}?${OFFLINE_QR_PARAM}=${encodeURIComponent(token)}`;
}
