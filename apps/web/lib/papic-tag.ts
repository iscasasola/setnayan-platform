/**
 * lib/papic-tag.ts — pure parsers for the Papic scan-to-tag leg.
 *
 * A paparazzo tags a capture by scanning a printed Setnayan QR. Two kinds:
 *   - GUEST QR (the place card / invitation) carries guests.qr_token, encoded as
 *       {appUrl}/{slug}?invite={token}   (invitation surfaces, lib/qr.ts)
 *       {appUrl}/{slug}?g={token}        (seating print pack place card)
 *     and the bare 32-hex token for hand-typed flows. Reused via parseGuestQrPayload.
 *   - TABLE QR (the seating sign) carries the table, encoded as
 *       {appUrl}/{slug}?t={public_id}    (seating print pack table sign)
 *     where public_id is S89T-<10 Crockford>. We also accept the 32-hex
 *     event_tables.qr_token inside a ?t= param (the publish-QR migration
 *     reserved it for this fan-out), and a bare S89T-… id.
 *
 * Pure + DOM-free so the unit suite (tsx --test lib/**) can import it. The live
 * decode (BarcodeDetector / jsQR) lives in lib/qr-scan.ts (browser-only).
 */

import { parseGuestQrPayload } from './checkin';

// Crockford base32 (no I/L/O/U) per generate_public_id / Account_ID_Format.md.
const TABLE_PUBLIC_ID = /^S89T-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$/i;
const HEX32 = /^[0-9a-f]{32}$/i;

/**
 * Extract a table reference (public_id, normalized upper; or qr_token, lower)
 * from whatever a QR scan produced. A bare 32-hex is NOT treated as a table —
 * that shape belongs to the guest token, so it's only honored inside an explicit
 * `?t=` param. Returns null when the payload isn't a table code.
 */
export function parseTableQrPayload(raw: string): string | null {
  const text = (raw ?? '').trim();
  if (!text) return null;
  // Bare table public_id (unambiguous — guest tokens never carry the S89T- prefix).
  if (TABLE_PUBLIC_ID.test(text)) return text.toUpperCase();
  try {
    const t = new URL(text).searchParams.get('t');
    if (t) {
      const v = t.trim();
      if (TABLE_PUBLIC_ID.test(v)) return v.toUpperCase();
      if (HEX32.test(v)) return v.toLowerCase();
    }
  } catch {
    // not a URL — fall through
  }
  return null;
}

export type PapicTagScan =
  | { kind: 'guest'; token: string }
  | { kind: 'table'; ref: string };

/**
 * Classify a scanned/pasted payload into a guest or table tag target, or null
 * when it's neither (a master event QR, a Papic claim link, junk, …). Guest is
 * tried first (the common scan); the table form is unambiguous (?t= / S89T-),
 * so the two never collide on a real printed code.
 */
export function parsePapicTagScan(raw: string): PapicTagScan | null {
  // Null-safe: parseGuestQrPayload calls raw.trim() with no guard, so a stray
  // null/undefined from a future caller would throw — but the tag action's
  // contract is "never throws". Coerce here so this stays true by construction.
  const safe = raw ?? '';
  const guest = parseGuestQrPayload(safe);
  if (guest) return { kind: 'guest', token: guest };
  const table = parseTableQrPayload(safe);
  if (table) return { kind: 'table', ref: table };
  return null;
}
