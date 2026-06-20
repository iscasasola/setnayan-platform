/**
 * Best-effort in-memory sliding-window rate limiter.
 *
 * ⚠ HONEST LIMITATION: on serverless (Vercel) each instance has its own memory
 * and instances scale horizontally, so this bounds a flood that hits a single
 * warm instance — it is NOT a hard, cross-instance guarantee. It is a cheap
 * defense-in-depth backstop with ZERO new infra. A durable limiter (Upstash /
 * Cloudflare Rate Limiting) is the recommended follow-up for hot write routes.
 *
 * In /api/upload it sits BEHIND the real protection (structural per-seat path
 * scoping + tight per-object byte caps + reissue kill-switch); it just blunts a
 * naive presign flood from one caller.
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_TRACKED_KEYS = 10_000;

function sweepIfLarge(now: number): void {
  if (buckets.size < MAX_TRACKED_KEYS) return;
  for (const [key, b] of buckets) {
    if (now >= b.resetAt) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
};

/**
 * Allow up to `limit` calls per `windowMs` for a given `key`. Returns ok=false
 * once the window's budget is spent. The window is fixed (resets `windowMs`
 * after the first call in a window).
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  sweepIfLarge(now);

  const b = buckets.get(key);
  if (!b || now >= b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: b.resetAt - now };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count, retryAfterMs: 0 };
}
