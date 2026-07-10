import 'server-only';
import { timingSafeEqual as nodeTimingSafeEqual } from 'node:crypto';

/**
 * Constant-time string comparison for secrets (cron/worker tokens, HMACs).
 * Guards length first (the length isn't the secret) then does a timing-safe byte
 * compare, so a secret can't be recovered via response-timing. Returns false on
 * any malformed input. Use everywhere a shared secret is checked instead of `!==`.
 */
export function secureCompare(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try {
    return nodeTimingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
