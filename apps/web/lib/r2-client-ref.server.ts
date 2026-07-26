import 'server-only';
import { presignDisplayUrl } from '@/lib/uploads';
import { parseClientRef, type ClientRefPolicy } from '@/lib/r2-client-ref';

/**
 * Server half of the SEC-1 client-ref gate — the part that actually touches the
 * R2 signer. The pure validation logic (and every policy builder) lives in
 * `lib/r2-client-ref.ts`, which is `server-only`-free so it can be unit-tested
 * under `pnpm test:unit`.
 *
 * Import the policy builders from `@/lib/r2-client-ref`; import this module
 * only when you need to actually mint a URL.
 */

/**
 * Validates a client-supplied ref against a policy, then presigns it. Returns
 * `null` when the ref fails the policy — the call site renders "no image"
 * rather than leaking whether the object exists.
 *
 * Default TTL is 1 hour, not the 24h `presignDisplayUrl` default: these URLs go
 * straight back to a client for an immediate preview or download, so they have
 * no reason to outlive the page that asked for them.
 */
export async function presignClientRef(
  value: unknown,
  policy: ClientRefPolicy,
  opts: { ttlSeconds?: number } = {},
): Promise<string | null> {
  const parsed = parseClientRef(value, policy);
  if (!parsed) return null;
  return await presignDisplayUrl(parsed.bucket, parsed.key, opts.ttlSeconds ?? 60 * 60);
}
