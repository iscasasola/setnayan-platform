/**
 * The CSP report sink must be USEFUL and must not become the leak.
 *
 * A browser CSP report carries `document-uri`, `referrer` and a full `blocked-uri`.
 * On this product those strings routinely contain event slugs, guest tokens in
 * query strings and signed R2 URLs — exactly what the observability rule keeps out
 * of logs ("no PII in logs", iteration 0035). So the minimiser keeps two fields
 * (directive + blocked ORIGIN) and drops path, query and fragment.
 *
 * The privacy half of these tests matters more than the parsing half: a security
 * control that logs tokens is worse than the gap it measures.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { cspViolationSummary, blockedOriginOf, routeShapeOf } from './csp-report';

const legacy = (body: Record<string, unknown>) => JSON.stringify({ 'csp-report': body });
const reportingApi = (body: Record<string, unknown>) =>
  JSON.stringify([{ type: 'csp-violation', body }]);

test('parses the legacy report-uri shape', () => {
  const got = cspViolationSummary(
    legacy({ 'effective-directive': 'script-src', 'blocked-uri': 'https://cdn.evil.test/x.js' }),
  );
  assert.deepEqual(got, { directive: 'script-src', blockedOrigin: 'https://cdn.evil.test', path: 'unknown' });
});

test('parses the Reporting-API array shape', () => {
  const got = cspViolationSummary(
    reportingApi({ effectiveDirective: 'connect-src', blockedURL: 'https://api.thing.test/v1/x' }),
  );
  assert.deepEqual(got, { directive: 'connect-src', blockedOrigin: 'https://api.thing.test', path: 'unknown' });
});

test('🔴 the PATH, QUERY and FRAGMENT are dropped — this is the PII guard', () => {
  // The realistic leak: a guest token in a query string, or a signed R2 URL.
  const got = cspViolationSummary(
    legacy({
      'effective-directive': 'img-src',
      'blocked-uri':
        'https://media.setnayan.com/events/abc-123/guest-selfies/g-9/photo.jpg?X-Amz-Signature=deadbeef&token=SECRET',
      'document-uri': 'https://www.setnayan.com/maria-and-jose?guest=SECRET_TOKEN',
      referrer: 'https://www.setnayan.com/maria-and-jose?guest=SECRET_TOKEN',
    }),
  );
  assert.deepEqual(got, {
    directive: 'img-src',
    blockedOrigin: 'https://media.setnayan.com',
    // `path` was added 2026-08-02 so a violation can be LOCATED. It must not
    // weaken this guard: `maria-and-jose` is a couple's public slug, so the root
    // is not a known app route and the whole path anonymises. The secret scan
    // below is what actually holds the line, and it is unchanged.
    path: '/:slug',
  });
  const serialised = JSON.stringify(got);
  for (const secret of ['SECRET', 'deadbeef', 'abc-123', 'guest-selfies', 'maria-and-jose']) {
    assert.equal(serialised.includes(secret), false, `the summary must not carry "${secret}"`);
  }
});

test('CSP keywords pass through — they are the most diagnostic values', () => {
  // `inline` means a nonce is needed; `eval` means something compiles at runtime.
  // Mapping these to a URL parse would throw away the finding.
  assert.equal(blockedOriginOf('inline'), 'inline');
  assert.equal(blockedOriginOf('eval'), 'eval');
  assert.equal(blockedOriginOf('data'), 'data');
  assert.equal(blockedOriginOf('blob:'), 'blob');
});

test('an unparseable blocked-uri is labelled, never echoed', () => {
  // Where a token would hide if we logged the raw string as a fallback.
  assert.equal(blockedOriginOf('not a url ?token=SECRET'), 'unparseable');
});

test('an unknown directive is bucketed, never echoed as free text', () => {
  const got = cspViolationSummary(
    legacy({ 'effective-directive': 'made-up-src ?token=SECRET', 'blocked-uri': 'https://x.test/a' }),
  );
  assert.equal(got?.directive, 'other');
});

test('a directive arriving with its value keeps only the token', () => {
  const got = cspViolationSummary(
    legacy({ 'violated-directive': 'script-src https://allowed.test', 'blocked-uri': 'https://x.test/a' }),
  );
  assert.equal(got?.directive, 'script-src');
});

test('garbage and empty bodies yield null, never a fabricated summary', () => {
  for (const bad of ['', 'not json', '{}', '[]', JSON.stringify({ 'csp-report': {} })]) {
    assert.equal(cspViolationSummary(bad), null, `expected null for: ${bad}`);
  }
});

/* ── The header itself ──────────────────────────────────────────────────────── */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CONFIG = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'next.config.ts'),
  'utf8',
);

test('it is REPORT-ONLY — the enforced header is untouched', () => {
  assert.match(CONFIG, /key: 'Content-Security-Policy-Report-Only'/);
  // The enforced CSP must still be the frame-ancestors-only one. A same-PR flip to
  // enforcement is the failure mode this guards: the origin allowlist is a guess
  // until the reports say otherwise, and guessing wrong takes the site down.
  assert.match(
    CONFIG,
    /key: 'Content-Security-Policy',\s*\n\s*value:\s*\n?\s*"frame-ancestors 'self'/,
    'the ENFORCED policy must stay frame-ancestors-only until the reports are boring',
  );
});

test('the decks are excluded, so they cannot bury the signal', () => {
  // /keynote + /proto execute inline Babel-standalone from public/ and would emit a
  // constant stream of known violations. They are robots-disallowed internal decks.
  assert.match(CONFIG, /source: '\/\(\(\?!keynote\|proto\)\.\*\)'/);
});

test("script-src keeps 'unsafe-inline'/'unsafe-eval' ON PURPOSE", () => {
  // Not an oversight: a strict script-src fires on Next's own inline hydration
  // bootstrap on every page load and drowns the origin signal. Tightening it needs
  // a nonce in middleware and deserves its own measurement.
  assert.match(CONFIG, /script-src 'self' 'unsafe-inline' 'unsafe-eval'/);
});

test('the policy points at the sink, and locks the cheap wins', () => {
  assert.match(CONFIG, /report-uri \/api\/csp-report/);
  // These three cost nothing to enforce later and are worth measuring now.
  for (const d of ["object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
    assert.ok(CONFIG.includes(d), `expected ${d} in the report-only policy`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   ROUTE SHAPE (2026-08-02) — where the violation happened, without who
   ═══════════════════════════════════════════════════════════════════════════
   Added because a live `img-src r2://setnayan-media` violation could not be
   traced to a page: the summary kept the directive and the origin and dropped
   the document URL entirely, so a real broken image had to be hunted by grep.
   The fix must satisfy BOTH constraints at once — locate the surface, identify
   nobody (retention schedule class 9: "no PII in logs"). */

test('routeShapeOf strips every identifying segment', () => {
  assert.equal(
    routeShapeOf('https://www.setnayan.com/dashboard/044f7e64-95aa-4dcb-84c1-7263bf494eaa/seating'),
    '/dashboard/:id/seating',
    'a UUID event id must never reach the log',
  );
  assert.equal(
    routeShapeOf('https://www.setnayan.com/v/S89B-RJ7TT7BWWQ'),
    '/v/:id',
    'canonical public ids are ids too',
  );
  assert.equal(routeShapeOf('https://www.setnayan.com/admin/orders/12345'), '/admin/orders/:id');
  // An opaque claim/seat token is the highest-value secret that could appear.
  assert.equal(
    routeShapeOf('https://www.setnayan.com/papic/seat/aVeryLongOpaqueClaimToken123'),
    '/papic/seat/:id',
  );
});

test('routeShapeOf drops query and fragment — a query can carry a token', () => {
  assert.equal(
    routeShapeOf('https://www.setnayan.com/explore?tile=catering&token=secret#frag'),
    '/explore',
  );
});

test('routeShapeOf keeps the static skeleton a developer needs', () => {
  assert.equal(routeShapeOf('https://www.setnayan.com/'), '/');
  assert.equal(routeShapeOf('https://www.setnayan.com/privacy'), '/privacy');
  // A short, non-numeric, dot-bearing segment is a real path piece, not an id.
  // `offline.html` is a public FILE, not an app route — so it anonymises. That
  // is the safe direction: unknown root ⇒ /:slug, never a guessed passthrough.
  assert.equal(routeShapeOf('https://www.setnayan.com/offline.html'), '/:slug');
  assert.equal(routeShapeOf('https://www.setnayan.com/maria-and-jose'), '/:slug');
});

test('routeShapeOf never throws — a malformed report must not cost us the directive', () => {
  for (const bad of ['', 'not a url', '://////', null, undefined, 42, {}]) {
    assert.doesNotThrow(() => routeShapeOf(bad as unknown));
  }
  assert.equal(routeShapeOf(null), 'unknown');
});

test('the summary now carries the path, and the route logs it', () => {
  const report = JSON.stringify({
    'csp-report': {
      'effective-directive': 'img-src',
      'blocked-uri': 'r2://setnayan-media/some/key.jpg',
      'document-uri': 'https://www.setnayan.com/dashboard/044f7e64-95aa-4dcb-84c1-7263bf494eaa/seating',
    },
  });
  const summary = cspViolationSummary(report);
  assert.ok(summary);
  assert.equal(summary.directive, 'img-src');
  assert.equal(summary.path, '/dashboard/:id/seating');
  // The real prod violation this was written for: a raw internal ref reaching
  // the browser. The origin must survive so it stays recognisable in the log.
  assert.match(summary.blockedOrigin, /setnayan-media/);
});
