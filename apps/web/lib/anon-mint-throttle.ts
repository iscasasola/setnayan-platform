import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import type { createAdminClient } from '@/lib/supabase/admin';

/**
 * Durable per-IP throttle for anonymous-draft onboarding mints.
 *
 * Anonymous sign-in (`signInAnonymously`) creates a real account + event from
 * nothing, so without a per-IP cap a script can mint them unbounded. The
 * in-memory limiter (lib/rate-limit.ts) is per-instance AND keyed on user.id —
 * useless here, since every anon mint produces a FRESH uid. This calls the
 * `claim_anon_mint_slot` RPC (durable, cross-instance, self-purging) instead.
 *
 * Privacy: only a salted SHA-256 hash of the IP is stored server-side, never the
 * raw address (RA 10173 data-minimization).
 */

const MAX_PER_WINDOW = 5;
const WINDOW_SECONDS = 60 * 60 * 24; // 24 hours

/**
 * Salted hash of the caller's IP. Returns '' when no IP header is present (a
 * proxy stripped it) so the throttle no-ops rather than hard-block a real user.
 */
async function ipHash(): Promise<string> {
  const h = await headers();
  const raw =
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    h.get('x-real-ip')?.trim() ||
    '';
  if (!raw) return '';
  const salt =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    'setnayan-anon-throttle';
  return createHash('sha256').update(`${salt}:${raw}`).digest('hex');
}

/**
 * Returns true when the caller's IP may mint another anonymous-draft session,
 * false when it has exhausted its window. Fails OPEN on a missing IP or any
 * infra error — a throttle glitch must never lock a legitimate couple out of
 * creating their event.
 */
export async function allowAnonMint(
  admin: ReturnType<typeof createAdminClient>,
): Promise<boolean> {
  try {
    const hash = await ipHash();
    if (!hash) return true;
    const { data, error } = await admin.rpc('claim_anon_mint_slot' as never, {
      p_ip_hash: hash,
      p_max: MAX_PER_WINDOW,
      p_window_seconds: WINDOW_SECONDS,
    } as never);
    if (error) {
      console.error('[anon-mint-throttle] claim_anon_mint_slot error:', error.message);
      return true; // fail open
    }
    return data !== false;
  } catch (e) {
    console.error('[anon-mint-throttle] failed:', e);
    return true; // fail open
  }
}
