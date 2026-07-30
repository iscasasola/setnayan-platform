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

import { cspViolationSummary, blockedOriginOf } from './csp-report';

const legacy = (body: Record<string, unknown>) => JSON.stringify({ 'csp-report': body });
const reportingApi = (body: Record<string, unknown>) =>
  JSON.stringify([{ type: 'csp-violation', body }]);

test('parses the legacy report-uri shape', () => {
  const got = cspViolationSummary(
    legacy({ 'effective-directive': 'script-src', 'blocked-uri': 'https://cdn.evil.test/x.js' }),
  );
  assert.deepEqual(got, { directive: 'script-src', blockedOrigin: 'https://cdn.evil.test' });
});

test('parses the Reporting-API array shape', () => {
  const got = cspViolationSummary(
    reportingApi({ effectiveDirective: 'connect-src', blockedURL: 'https://api.thing.test/v1/x' }),
  );
  assert.deepEqual(got, { directive: 'connect-src', blockedOrigin: 'https://api.thing.test' });
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
  assert.deepEqual(got, { directive: 'img-src', blockedOrigin: 'https://media.setnayan.com' });
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
