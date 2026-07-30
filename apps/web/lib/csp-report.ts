/**
 * csp-report.ts — turn a raw CSP violation body into the MINIMUM that is useful.
 *
 * Pure + client-safe (no I/O, no `server-only`) so the minimisation rules are
 * unit-testable, mirroring the `lib/r2-client-ref.ts` split. The route is the
 * only caller.
 *
 * ── WHY MINIMISE AT ALL ─────────────────────────────────────────────────────
 * A browser CSP report carries `document-uri`, `referrer` and a full
 * `blocked-uri`. On this product those strings routinely contain event slugs,
 * guest tokens in query strings, and signed R2 URLs — i.e. exactly the material
 * the observability rule keeps OUT of logs ("no PII in logs", iteration 0035).
 * A security control must not become the thing that leaks.
 *
 * What an allowlist actually needs is two fields: WHICH directive fired, and
 * WHICH ORIGIN was blocked. Path, query and fragment add nothing to that and are
 * dropped here rather than at the log call, so no future caller can re-widen it
 * by forgetting.
 */

export type CspViolationSummary = {
  /** e.g. `script-src`, `connect-src`. Never free text from the report. */
  directive: string;
  /** scheme+host only, e.g. `https://cdn.example.com`. Or a CSP keyword. */
  blockedOrigin: string;
};

/** Directives we are prepared to name. An unknown value is reported as `other`. */
const KNOWN_DIRECTIVES = new Set([
  'default-src', 'script-src', 'script-src-elem', 'script-src-attr',
  'style-src', 'style-src-elem', 'style-src-attr',
  'img-src', 'connect-src', 'font-src', 'media-src',
  'frame-src', 'child-src', 'object-src', 'worker-src', 'manifest-src',
  'form-action', 'frame-ancestors', 'base-uri',
]);

/**
 * CSP keywords that are NOT URLs and must pass through verbatim — they are the
 * most diagnostic values in the whole report (`inline` says a nonce is needed;
 * `eval` says a library is compiling at runtime).
 */
const KEYWORDS = new Set(['inline', 'eval', 'self', 'data', 'blob', 'filesystem', 'wasm-eval']);

/** scheme+host, nothing else. Returns null when there is no usable origin. */
export function blockedOriginOf(blockedUri: unknown): string | null {
  if (typeof blockedUri !== 'string' || blockedUri.length === 0) return null;
  const v = blockedUri.trim();
  if (KEYWORDS.has(v)) return v;
  // Opaque scheme-only values (`data:`, `blob:`) arrive with the colon.
  const bare = v.endsWith(':') ? v.slice(0, -1) : v;
  if (KEYWORDS.has(bare)) return bare;
  try {
    const u = new URL(v);
    return `${u.protocol}//${u.host}`;
  } catch {
    // Not a URL and not a keyword — say so rather than logging the raw string,
    // which is where a token would hide.
    return 'unparseable';
  }
}

/**
 * Parse + minimise. Accepts both shapes browsers send: the legacy
 * `{"csp-report": {...}}` (report-uri) and the Reporting-API array
 * `[{ "type": "csp-violation", "body": {...} }]`.
 *
 * Returns null for anything unrecognised — a report sink that cannot parse a body
 * has nothing to say, and inventing a summary would pollute the signal we are
 * collecting the reports to get.
 */
export function cspViolationSummary(rawBody: string): CspViolationSummary | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return null;
  }

  const body = ((): Record<string, unknown> | null => {
    if (Array.isArray(parsed)) {
      const first = parsed.find(
        (e): e is Record<string, unknown> =>
          !!e && typeof e === 'object' && (e as Record<string, unknown>).type === 'csp-violation',
      );
      const b = first?.body;
      return b && typeof b === 'object' ? (b as Record<string, unknown>) : null;
    }
    if (parsed && typeof parsed === 'object') {
      const legacy = (parsed as Record<string, unknown>)['csp-report'];
      if (legacy && typeof legacy === 'object') return legacy as Record<string, unknown>;
    }
    return null;
  })();
  if (!body) return null;

  const rawDirective =
    body['effectiveDirective'] ?? body['effective-directive'] ?? body['violatedDirective'] ?? body['violated-directive'];
  // A directive can arrive as `script-src https://x` — keep the token only.
  const token = typeof rawDirective === 'string' ? (rawDirective.split(/\s+/)[0] ?? '') : '';
  const directive = KNOWN_DIRECTIVES.has(token) ? token : 'other';

  const blockedOrigin = blockedOriginOf(body['blockedURL'] ?? body['blocked-uri']);
  if (!blockedOrigin) return null;

  return { directive, blockedOrigin };
}
