/**
 * 🍎 IS THIS REALLY FROM APPLE? — verify an App Store signed payload (JWS).
 *
 * Everything Apple tells us about a purchase arrives as a JWS signed by Apple:
 * the StoreKit 2 transaction the app hands us (`Transaction.jwsRepresentation`)
 * and every App Store Server Notification v2 (`signedPayload`, whose
 * `data.signedTransactionInfo` is another JWS). NOTHING in either may be read
 * until this says yes — a payload anyone can forge must never switch on a paid
 * item.
 *
 * WHAT "YES" MEANS — the same checks Apple's own `SignedDataVerifier` makes
 * offline (app-store-server-library), done with node:crypto so no third-party
 * code sits in the money path:
 *
 *   1 · the header is ES256 and carries a THREE-certificate `x5c` chain;
 *   2 · the chain's ROOT is Apple Root CA - G3 — pinned by its SHA-256
 *       fingerprint (`APPLE_ROOT_CA_G3_SHA256`, read 2026-10-18 from macOS's
 *       SystemRootCertificates keychain), never "any root that self-signs";
 *   3 · the intermediate was issued AND signed by that root, and the leaf by
 *       the intermediate; each certificate was valid at the moment Apple says
 *       it signed (`signedDate`), and the root signs itself;
 *   4 · the intermediate carries Apple's WWDR marker OID 1.2.840.113635.100.6.2.1
 *       and the leaf Apple's App Store receipt-signing OID
 *       1.2.840.113635.100.6.11.1 — so a certificate Apple issued for some
 *       OTHER purpose cannot sign a purchase;
 *   5 · the leaf's key verifies the signature over `header.payload`.
 *
 * Any failure returns `{ ok: false, reason }` and the payload is not returned
 * at all — there is no "decoded but unverified" door for a caller to misuse.
 *
 * NOT CHECKED (named, not hidden): online revocation (OCSP) of the leaf. Apple's
 * library makes that optional too; a revoked Apple signing key is an Apple-wide
 * incident, not a per-purchase risk.
 *
 * Pure: no I/O, no clock unless the caller passes none. Tests inject their own
 * root fingerprint and a fixture chain (lib/iap/apple-jws.test.ts).
 */

import { X509Certificate, verify as cryptoVerify } from 'node:crypto';

/** Apple Root CA - G3, SHA-256 of the DER — macOS SystemRootCertificates.keychain, read 2026-10-18. */
export const APPLE_ROOT_CA_G3_SHA256 =
  '63343ABFB89A6A03EBB57E9B3F5FA7BE7C4F5C756F3017B3A8C488C3653E9179';

/** DER of OID 1.2.840.113635.100.6.11.1 — Apple's App Store receipt-signing leaf. */
const LEAF_OID_DER = Buffer.from('060a2a864886f76364060b01', 'hex');
/** DER of OID 1.2.840.113635.100.6.2.1 — Apple's WWDR intermediate. */
const INTERMEDIATE_OID_DER = Buffer.from('060a2a864886f76364060201', 'hex');

export type JwsRefusal =
  | 'malformed'
  | 'bad_header'
  | 'bad_chain'
  | 'untrusted_root'
  | 'not_apple_purpose'
  | 'expired_certificate'
  | 'bad_signature';

export type JwsVerdict<T> = { ok: true; payload: T } | { ok: false; reason: JwsRefusal };

function b64urlToBuffer(part: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]*$/.test(part)) return null;
  try {
    return Buffer.from(part, 'base64url');
  } catch {
    return null;
  }
}

function parseJsonPart(part: string): Record<string, unknown> | null {
  const buf = b64urlToBuffer(part);
  if (!buf) return null;
  try {
    const v: unknown = JSON.parse(buf.toString('utf8'));
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function fingerprintHex(cert: X509Certificate): string {
  return cert.fingerprint256.replace(/:/g, '').toUpperCase();
}

function validAt(cert: X509Certificate, at: Date): boolean {
  const from = new Date(cert.validFrom).getTime();
  const to = new Date(cert.validTo).getTime();
  const t = at.getTime();
  return Number.isFinite(from) && Number.isFinite(to) && t >= from && t <= to;
}

/**
 * Verify an Apple-signed JWS and return its payload ONLY when every check passes.
 *
 * @param trustedRootSha256 the root fingerprints accepted (production: Apple's
 *   G3 only). Uppercase hex, no colons.
 * @param now the fallback validity instant when the payload has no `signedDate`.
 */
export function verifyAppleJws<T extends Record<string, unknown>>(
  jws: string,
  opts: { trustedRootSha256: readonly string[]; now?: Date },
): JwsVerdict<T> {
  if (typeof jws !== 'string' || jws.length > 64_000) return { ok: false, reason: 'malformed' };
  const parts = jws.split('.');
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) return { ok: false, reason: 'malformed' };
  const [h, p, s] = parts as [string, string, string];

  const header = parseJsonPart(h);
  if (!header || header.alg !== 'ES256') return { ok: false, reason: 'bad_header' };
  const x5c = header.x5c;
  if (!Array.isArray(x5c) || x5c.length !== 3 || !x5c.every((c) => typeof c === 'string')) {
    return { ok: false, reason: 'bad_header' };
  }

  let leaf: X509Certificate;
  let intermediate: X509Certificate;
  let root: X509Certificate;
  try {
    [leaf, intermediate, root] = (x5c as string[]).map((c) => new X509Certificate(Buffer.from(c, 'base64'))) as [
      X509Certificate,
      X509Certificate,
      X509Certificate,
    ];
  } catch {
    return { ok: false, reason: 'bad_chain' };
  }

  const trusted = new Set(opts.trustedRootSha256.map((f) => f.replace(/:/g, '').toUpperCase()));
  if (!trusted.has(fingerprintHex(root))) return { ok: false, reason: 'untrusted_root' };

  // The chain: root signs itself and the intermediate; the intermediate signs the leaf.
  try {
    if (!root.verify(root.publicKey)) return { ok: false, reason: 'bad_chain' };
    if (!intermediate.checkIssued(root) || !intermediate.verify(root.publicKey)) {
      return { ok: false, reason: 'bad_chain' };
    }
    if (!leaf.checkIssued(intermediate) || !leaf.verify(intermediate.publicKey)) {
      return { ok: false, reason: 'bad_chain' };
    }
  } catch {
    return { ok: false, reason: 'bad_chain' };
  }

  if (!intermediate.raw.includes(INTERMEDIATE_OID_DER) || !leaf.raw.includes(LEAF_OID_DER)) {
    return { ok: false, reason: 'not_apple_purpose' };
  }

  const signature = b64urlToBuffer(s);
  if (!signature || signature.length !== 64) return { ok: false, reason: 'bad_signature' };
  let signed = false;
  try {
    signed = cryptoVerify(
      'sha256',
      Buffer.from(`${h}.${p}`, 'ascii'),
      { key: leaf.publicKey, dsaEncoding: 'ieee-p1363' },
      signature,
    );
  } catch {
    signed = false;
  }
  if (!signed) return { ok: false, reason: 'bad_signature' };

  const payload = parseJsonPart(p);
  if (!payload) return { ok: false, reason: 'malformed' };

  // Validity at the instant Apple says it signed (the signature is now proven
  // Apple's, so its signedDate is too) — Apple's offline rule. Else: now.
  const signedDate = typeof payload.signedDate === 'number' ? new Date(payload.signedDate) : null;
  const at = signedDate && Number.isFinite(signedDate.getTime()) ? signedDate : (opts.now ?? new Date());
  if (![leaf, intermediate, root].every((c) => validAt(c, at))) {
    return { ok: false, reason: 'expired_certificate' };
  }

  return { ok: true, payload: payload as T };
}
