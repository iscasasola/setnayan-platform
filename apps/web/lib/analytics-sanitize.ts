// Analytics URL sanitizer — strips guest bearer tokens from anything that
// would otherwise be shipped to PostHog.
//
// A guest's QR/invite token (or a table public id) riding in a query string is
// a standing credential; letting it land in `$current_url` / `$referrer`
// leaks it into a third-party analytics store (RA 10173 + the open-browse
// privacy hardening, council §3 row 5(d)/§6). These helpers are pure and
// dependency-free so they can be unit-tested and reused by the client provider.

// `invite` = the guest QR token on invitation links; `t`/`g` = find-seat +
// guest deep-links; `token` = the generic bearer form.
export const SENSITIVE_QUERY_KEYS = ['invite', 't', 'g', 'token'] as const;

/**
 * Remove sensitive query params from a URL string (absolute or relative),
 * preserving path, remaining params, and hash. NEVER throws — returns the
 * input unchanged on any parse failure, so a malformed URL can never kill
 * telemetry (this runs on every captured event via `sanitize_properties`).
 */
export function stripSensitiveParams(rawUrl: string): string {
  try {
    const hasOrigin = /^[a-z]+:\/\//i.test(rawUrl);
    const url = new URL(rawUrl, 'http://placeholder.invalid');
    let mutated = false;
    for (const key of SENSITIVE_QUERY_KEYS) {
      if (url.searchParams.has(key)) {
        url.searchParams.delete(key);
        mutated = true;
      }
    }
    if (!mutated) return rawUrl;
    return hasOrigin ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return rawUrl;
  }
}

// The URL-bearing PostHog property keys worth scrubbing on every event.
const URL_PROPERTY_KEYS = [
  '$current_url',
  '$referrer',
  '$initial_current_url',
  '$initial_referrer',
];

/**
 * PostHog `sanitize_properties` hook — scrubs sensitive query params from the
 * URL-bearing properties of EVERY captured event (autocapture, pageleave, and
 * the manual `$pageview` alike), so a tokenized URL never leaves the browser.
 * Mutates and returns the same object (PostHog's contract); never throws.
 */
export function sanitizeAnalyticsProperties(
  properties: Record<string, unknown>,
): Record<string, unknown> {
  try {
    for (const key of URL_PROPERTY_KEYS) {
      const value = properties[key];
      if (typeof value === 'string') {
        properties[key] = stripSensitiveParams(value);
      }
    }
    return properties;
  } catch {
    return properties;
  }
}
