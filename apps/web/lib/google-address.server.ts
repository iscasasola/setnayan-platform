import 'server-only';

/**
 * google-address.server.ts — does a DOMAIN route its mail to Google (a Google
 * Workspace domain)? The one place that asks DNS. Pure rule in
 * `google-address.ts` (`mxPointsAtGoogle`); this file only fetches and caches.
 *
 * Only a domain arrives here — never an address (see the route's docblock).
 * Fails CLOSED into `false`: a lookup that could not run leaves the ordinary
 * email + password form in place, which is exactly today's behaviour — never
 * worse than before, and never a door that does not exist.
 */
import { resolveMx } from 'node:dns/promises';
import { isGoogleNamedDomain, mxPointsAtGoogle, normalizeDomain } from './google-address';

const TTL_MS = 6 * 60 * 60_000;
const LOOKUP_TIMEOUT_MS = 2_500;
const MAX_CACHED = 2_000;

const cache = new Map<string, { google: boolean; until: number }>();

function remember(domain: string, google: boolean): boolean {
  if (cache.size >= MAX_CACHED) {
    const now = Date.now();
    for (const [k, v] of cache) if (v.until <= now) cache.delete(k);
    if (cache.size >= MAX_CACHED) cache.clear();
  }
  cache.set(domain, { google, until: Date.now() + TTL_MS });
  return google;
}

/** `lookup` is injectable for the test; production uses the system resolver. */
export async function isGoogleMailDomain(
  raw: string | null | undefined,
  lookup: (domain: string) => Promise<{ exchange: string; priority: number }[]> = resolveMx,
): Promise<boolean> {
  const domain = normalizeDomain(raw);
  if (!domain) return false;
  if (isGoogleNamedDomain(domain)) return true;
  const hit = cache.get(domain);
  if (hit && hit.until > Date.now()) return hit.google;
  try {
    const records = await Promise.race([
      lookup(domain),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('mx timeout')), LOOKUP_TIMEOUT_MS)),
    ]);
    return remember(domain, mxPointsAtGoogle(records));
  } catch {
    // NXDOMAIN / no MX is a real answer ("not Google") and is cached; a timeout
    // is cached too, briefly, by the same TTL — a slow resolver must not be
    // asked again on every keystroke.
    return remember(domain, false);
  }
}
