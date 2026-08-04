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
  /**
   * WHERE it happened, as a route SHAPE — `/dashboard/:id/seating`, never the
   * real URL. Added 2026-08-02.
   *
   * The summary previously kept only directive + origin, and that is one field
   * short of actionable: a live `img-src r2://setnayan-media` violation (a raw
   * internal storage ref reaching a browser as an image source — a broken image
   * for a real user) could not be traced to a page, so finding it meant grepping
   * the codebase blind.
   *
   * Ids are stripped rather than the field being dropped, because BOTH things
   * are true: the retention schedule commits to "no PII in logs" (class 9), and
   * a violation you cannot locate is a violation you will not fix. The shape
   * satisfies both — `/dashboard/:id/seating` names the surface and identifies
   * nobody.
   */
  path: string;
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
/**
 * Every top-level route the app actually serves. A first segment IN this set is
 * a static route name and is safe to log; anything else at the root is a
 * user-owned slug — a couple's public page (`/maria-and-jose`), a vendor
 * (`/some-studio`) — and naming it in a log identifies a real wedding.
 *
 * Derived from `apps/web/app/*`. Missing an entry costs nothing but precision:
 * the path collapses to `/:slug`, which is the safe direction.
 */
const STATIC_ROUTE_ROOTS = new Set([
  '3d_plan', 'about', 'acceptable-use', 'admin', 'alaala', 'api', 'auth', 'blog',
  'claim', 'cookies', 'creators', 'dashboard', 'demo-capture', 'dev', 'download',
  'explore', 'features', 'forgot-password', 'health', 'help', 'host',
  'how-it-works', 'join', 'login', 'monogram', 'onboarding', 'open-shop', 'pa3d',
  'pabati', 'palogo', 'panood', 'papic', 'patiktok', 'pawebsite', 'pricing',
  'privacy', 'proposals', 'prototype', 'realstories', 'receipts', 'refunds',
  'reset-password', 'samahan', 'setnayan-ai', 'signup', 'site-editor', 'terms',
  'tl', 'tour', 'u', 'v', 'vendor', 'vendor-dashboard', 'vendor-invite',
  'vendors', 'waitlist', 'wall', 'why-setnayan',
]);

/**
 * Reduce a report's document URL to a route SHAPE — `/dashboard/:id/seating` —
 * so a violation can be LOCATED without naming anyone.
 *
 * ⚠ THE CONSTRAINT THAT SHAPES THIS. `csp-report.test.ts` carries a deliberate
 * PII guard asserting the summary leaks none of a signed-URL signature, a guest
 * token, an event folder id, **or a couple's public slug** (`maria-and-jose`).
 * A naive "strip UUIDs and numbers" pass satisfies the first three and fails the
 * last, because a slug is just a short word segment — and `/maria-and-jose` in a
 * log names a real wedding. So the rule is inverted: a first segment is kept
 * ONLY if it is a route the app actually serves; every other root becomes
 * `/:slug`. Unknown ⇒ anonymised is the safe direction.
 *
 * Dropped outright: origin, query and fragment (a query can carry a token).
 * Returns `'unknown'` rather than throwing — a malformed report is the norm here
 * and must never cost us the directive we DID parse.
 */
export function routeShapeOf(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) return 'unknown';
  let pathname: string;
  try {
    pathname = new URL(raw, 'https://x.invalid').pathname;
  } catch {
    return 'unknown';
  }
  const segs = pathname.split('/').filter((x) => x.length > 0);
  if (segs.length === 0) return '/';
  if (!STATIC_ROUTE_ROOTS.has(segs[0]!)) return '/:slug';

  const shaped = segs.map((seg, i) => {
    if (i === 0) return seg;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(seg)) return ':id';
    if (/^S89[A-Z]-[0-9A-Z]{10}$/.test(seg)) return ':id';
    if (/^\d+$/.test(seg)) return ':id';
    if (seg.length >= 24 && !seg.includes('.')) return ':id';
    // A nested segment under a known root is a route name unless it looks like
    // an id — but a slug can nest too (`/v/some-vendor`), so anything that is
    // not plainly a route word is anonymised.
    return /^[a-z0-9][a-z0-9-]*$/i.test(seg) && seg.length <= 20 ? seg : ':id';
  });
  const out = `/${shaped.join('/')}`;
  return out.length > 120 ? `${out.slice(0, 120)}…` : out;
}

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

  const path = routeShapeOf(body['documentURL'] ?? body['document-uri']);

  return { directive, blockedOrigin, path };
}
