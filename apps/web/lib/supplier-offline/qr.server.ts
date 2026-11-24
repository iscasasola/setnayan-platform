import 'server-only';
import { createPublicKey, verify } from 'node:crypto';

import { isPublicKeyJwk, unb64url, type ParsedOfflineQr } from './qr';

/**
 * 🔳 The server half of the offline client QR (owner 24 Nov 2026, DECISION_LOG 7d618cb3): the signature is checked with
 * node:crypto against the phone's registered PUBLIC key (`vendor_offline_devices.public_key`). WebCrypto signs ECDSA in
 * the IEEE P1363 form (r‖s, 64 bytes), so node reads it that way. A key that is not exactly an EC P-256 public key, a
 * signature of the wrong length, or a message that does not say back the fields is refused.
 */
export function verifyOfflineQrSignature(parsed: ParsedOfflineQr, publicKey: unknown): boolean {
  if (!isPublicKeyJwk(publicKey)) return false;
  const sig = unb64url(parsed.sig);
  if (!sig || sig.length !== 64) return false;
  try {
    const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: publicKey.x, y: publicKey.y }, format: 'jwk' });
    return verify('sha256', Buffer.from(parsed.message, 'utf8'), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig));
  } catch {
    return false;
  }
}
