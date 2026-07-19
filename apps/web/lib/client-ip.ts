import 'server-only';

/**
 * Best-effort client IP from request headers — consolidates the ad-hoc
 * x-forwarded-for parsing scattered across the codebase (waitlist, seat-lookup,
 * venue-scene, join, redeem). ⚠ x-forwarded-for's left-most entry is
 * client-influenceable upstream of Vercel's own append, so treat IP-keyed limits
 * as BEST-EFFORT and prefer identity keys (user.id / api_key_id) as the strong layer.
 */
export function clientIp(headers: Headers): string | null {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = headers.get('x-real-ip')?.trim();
  return real && real.length ? real : null;
}
