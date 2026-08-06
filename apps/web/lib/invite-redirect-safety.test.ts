/**
 * The invite-redirect slug allowlist.
 *
 * 🔴 Why this exists. `/[slug]/redeem` took `slug` from the QUERY STRING and
 * built its redirect as `new URL('/' + slug, origin)`. A slug of `/example.com`
 * becomes `//example.com` — protocol-relative — and the browser leaves the site.
 * Reproduced against live production on 2026-08-06:
 *     /cale-ice/redeem?slug=/example.com&token=x  ->  location: https://example.com/
 * No valid token was needed; the not-found branch redirects first.
 *
 * A link that starts with our own domain and lands on someone else's site is a
 * phishing primitive, aimed at people we have taught to tap invitation links.
 *
 * The allowlist is also what stops `?slug=%` — the lookup uses ILIKE, where `%`
 * is a WILDCARD that matched an arbitrary event.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

/** Must stay identical to SAFE_SLUG in app/[slug]/redeem/route.ts. */
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,99}$/;

/** What the route does with a candidate slug, reduced to its decision. */
function redirectTarget(rawSlug: string, origin = 'https://www.setnayan.com'): string {
  const slug = rawSlug.trim().toLowerCase();
  return SAFE_SLUG.test(slug)
    ? new URL(`/${slug}`, origin).toString()
    : new URL('/', origin).toString();
}

test('THE BUG: a protocol-relative slug can no longer leave the site', () => {
  // Each of these produced an off-site redirect before the fix.
  for (const evil of [
    '/example.com',
    '//example.com',
    '\\\\example.com',
    'https://example.com',
    '/\\example.com',
    '///example.com',
  ]) {
    const got = redirectTarget(evil);
    assert.ok(
      got.startsWith('https://www.setnayan.com/'),
      `${evil} escaped the origin -> ${got}`,
    );
    assert.equal(got, 'https://www.setnayan.com/', `${evil} must fall back to the root`);
  }
});

test('the ILIKE wildcard is rejected, so ?slug=% cannot match an arbitrary event', () => {
  for (const pattern of ['%', '_', 'cale%', '%ice', 'c_le-ice']) {
    assert.equal(redirectTarget(pattern), 'https://www.setnayan.com/');
  }
});

test('path traversal and query/fragment smuggling are rejected', () => {
  for (const evil of ['../admin', 'cale-ice/../../etc', 'cale-ice?x=1', 'cale-ice#f', 'a b']) {
    assert.equal(redirectTarget(evil), 'https://www.setnayan.com/');
  }
});

test('real slugs still work, and a stray capital is normalised rather than dumped at the root', () => {
  assert.equal(redirectTarget('cale-ice'), 'https://www.setnayan.com/cale-ice');
  assert.equal(redirectTarget('maria-and-jose'), 'https://www.setnayan.com/maria-and-jose');
  assert.equal(redirectTarget('  Cale-Ice  '), 'https://www.setnayan.com/cale-ice');
  assert.equal(redirectTarget('papic-pool-test-simple-event'),
    'https://www.setnayan.com/papic-pool-test-simple-event');
});

test('empty and absurd input fall back to the root, never to caller text', () => {
  assert.equal(redirectTarget(''), 'https://www.setnayan.com/');
  assert.equal(redirectTarget('-leading-hyphen'), 'https://www.setnayan.com/');
  assert.equal(redirectTarget('x'.repeat(200)), 'https://www.setnayan.com/');
});

test('the route file still uses the allowlist and never interpolates the raw query slug', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync('app/[slug]/redeem/route.ts', 'utf8');
  assert.match(src, /const SAFE_SLUG = \/\^\[a-z0-9\]/, 'SAFE_SLUG must stay in the route');
  assert.match(src, /SAFE_SLUG\.test\(slug\)/, 'the route must test the slug');
  // The /welcome hop must use the DB value, not the query value.
  assert.match(src, /\$\{event\.slug\}\/welcome/, 'the +1 hop must redirect via event.slug');
  assert.doesNotMatch(
    src,
    /new URL\(`\/\$\{rawSlug\}/,
    'the raw query slug must never be interpolated into a URL',
  );
});
