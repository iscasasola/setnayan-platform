/**
 * vendor-public-line.test.ts — the fifth reader-with-no-writer, and the guard
 * that says so out loud.
 *
 * `tagline`, `website`, `social_feature_opt_out` and `same_day_available` all
 * had live readers and, for a real vendor, no writer: their only writer was
 * `saveVendorProfile`, whose form was retired 2026-07-05. Nothing errored. The
 * Day-of "Get help" shortlist matched nobody because `same_day_available` was
 * FALSE for every row; every verified shop was eligible for a public Facebook
 * post because `social_feature_opt_out` was FALSE for every row and no control
 * existed to change it.
 *
 * 🔑 THE GENERAL RULE THIS ENFORCES: grep the column and ask whether every hit
 * is a READ — and then ask whether the writer is REACHABLE. A writer in an
 * action nobody calls is the bug, not the fix, which is exactly how these four
 * spent a month looking writable. So the source-text tests below check both:
 * an action writes the column, AND the card that posts to it is rendered.
 *
 * These tests read SOURCE TEXT where the thing being checked is a cross-file
 * relationship — importing a `'use server'` module or a React tree from a unit
 * test is not possible, and a second hand-typed list would be the very bug.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TAGLINE_MAX,
  WEBSITE_MAX,
  parseTagline,
  parseWebsiteUrl,
} from './vendor-public-line';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(HERE, rel), 'utf8');

const PUBLIC_LINE_ACTION = '../app/vendor-dashboard/shop/public-line-actions.ts';
const VISIBILITY_ACTION = '../app/vendor-dashboard/shop/visibility-actions.ts';
const PUBLIC_LINE_CARD = '../app/vendor-dashboard/shop/_components/public-line-card.tsx';
const VISIBILITY_CARD = '../app/vendor-dashboard/shop/_components/visibility-card.tsx';
const SHOP_PAGE = '../app/vendor-dashboard/shop/page.tsx';

// ── parseTagline ─────────────────────────────────────────────────────────────

test('parseTagline: blank and non-string collapse to NULL', () => {
  assert.equal(parseTagline(''), null);
  assert.equal(parseTagline('   '), null);
  assert.equal(parseTagline('\n\t '), null);
  assert.equal(parseTagline(null), null);
});

test('parseTagline: trims and collapses inner whitespace to one line', () => {
  assert.equal(parseTagline('  Wedding   films  '), 'Wedding films');
  // A textarea paste must not store a multi-line value in a field every
  // reader renders on a single row.
  assert.equal(parseTagline('Wedding\nfilms\r\nacross Luzon'), 'Wedding films across Luzon');
});

test('parseTagline: truncates rather than rejecting an over-long line', () => {
  const long = 'a'.repeat(TAGLINE_MAX + 40);
  const out = parseTagline(long);
  assert.equal(out?.length, TAGLINE_MAX);
});

test('parseTagline: collapses BEFORE truncating, so padding never eats the cap', () => {
  const padded = `${'  '.repeat(30)}hello`;
  assert.equal(parseTagline(padded), 'hello');
});

// ── parseWebsiteUrl ──────────────────────────────────────────────────────────

test('parseWebsiteUrl: blank is a valid save that clears the column', () => {
  assert.deepEqual(parseWebsiteUrl(''), { ok: true, value: null });
  assert.deepEqual(parseWebsiteUrl('   '), { ok: true, value: null });
  assert.deepEqual(parseWebsiteUrl(null), { ok: true, value: null });
});

test('parseWebsiteUrl: a bare host gains https://', () => {
  assert.deepEqual(parseWebsiteUrl('yourstudio.com'), {
    ok: true,
    value: 'https://yourstudio.com/',
  });
  assert.deepEqual(parseWebsiteUrl('www.yourstudio.com/portfolio'), {
    ok: true,
    value: 'https://www.yourstudio.com/portfolio',
  });
});

test('parseWebsiteUrl: http and https are both kept as given', () => {
  const https = parseWebsiteUrl('https://yourstudio.com/a?b=c');
  assert.equal(https.ok && https.value, 'https://yourstudio.com/a?b=c');
  const http = parseWebsiteUrl('http://yourstudio.com/');
  assert.equal(http.ok && http.value, 'http://yourstudio.com/');
});

test('parseWebsiteUrl: a non-http(s) scheme is REFUSED, never coerced', () => {
  // The whole point of the parse. Both API routes hand `website` to callers
  // who will linkify it; a stored `javascript:` is the exploit. Prefixing
  // https:// onto these would "fix" them into something that still runs.
  for (const bad of [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'vbscript:msgbox(1)',
  ]) {
    const res = parseWebsiteUrl(bad);
    assert.equal(res.ok, false, `${bad} must be refused`);
  }
});

test('parseWebsiteUrl: a hostname with no dot is refused', () => {
  // `new URL('https://mysite')` parses happily — without this check a typo
  // saves as a dead link nothing in the dashboard would ever surface.
  assert.equal(parseWebsiteUrl('mysite').ok, false);
  assert.equal(parseWebsiteUrl('https://localhost').ok, false);
  assert.equal(parseWebsiteUrl('trailing.').ok, false);
});

test('parseWebsiteUrl: whitespace inside the value is refused', () => {
  assert.equal(parseWebsiteUrl('your studio.com').ok, false);
  assert.equal(parseWebsiteUrl('visit us at yourstudio.com').ok, false);
});

test('parseWebsiteUrl: an absurdly long value is refused, not truncated', () => {
  // Truncating a URL would store a DIFFERENT destination, which is worse than
  // refusing — the vendor would see a saved link pointing somewhere else.
  const long = `https://yourstudio.com/${'a'.repeat(WEBSITE_MAX)}`;
  assert.equal(parseWebsiteUrl(long).ok, false);
});

test('parseWebsiteUrl: every refusal carries a message a shop owner can act on', () => {
  for (const bad of ['javascript:alert(1)', 'mysite', 'a b.com']) {
    const res = parseWebsiteUrl(bad);
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.ok(res.error.length > 0);
      // No Postgres codes, no stack language leaking to the vendor.
      assert.ok(!/\b\d{5}\b|undefined_column|URL constructor/i.test(res.error));
    }
  }
});

// ── the writers exist AND are reachable ──────────────────────────────────────

test('all four columns are WRITTEN by a vendor-reachable action', () => {
  const publicLine = read(PUBLIC_LINE_ACTION);
  const visibility = read(VISIBILITY_ACTION);

  // Written into a patch that reaches .update() on vendor_profiles.
  assert.match(publicLine, /patch\.tagline\s*=/);
  assert.match(publicLine, /patch\.website\s*=/);
  assert.match(publicLine, /\.from\('vendor_profiles'\)\s*\n?\s*\.update\(patch\)/);

  assert.match(visibility, /same_day_available:\s*sameDayAvailable/);
  assert.match(visibility, /social_feature_opt_out:\s*socialFeatureOptOut/);
  assert.match(visibility, /\.from\('vendor_profiles'\)\s*\n?\s*\.update\(/);
});

test('the cards that post to those actions are actually RENDERED', () => {
  // The failure mode that created this whole class of bug: the writer existed,
  // in an action with no caller. An unrendered card is the same defect.
  const page = read(SHOP_PAGE);
  assert.match(page, /import \{ PublicLineCard \}/);
  assert.match(page, /import \{ VisibilityCard \}/);
  assert.match(page, /<PublicLineCard\b/);
  assert.match(page, /<VisibilityCard\b/);

  assert.match(read(PUBLIC_LINE_CARD), /updatePublicLine\(/);
  assert.match(read(VISIBILITY_CARD), /updateVisibilityPreferences\(/);
});

// ── the absent-means-false hazard ────────────────────────────────────────────

test('the checkbox action refuses to write without its presence marker', () => {
  const src = read(VISIBILITY_ACTION);
  // An unticked checkbox posts NOTHING, so `=== 'on'` alone cannot tell
  // "vendor cleared it" from "form never asked". Without this guard, any
  // future caller posting an unrelated FormData would silently re-enable
  // social posting for a vendor who had opted out.
  //
  // Match the GUARD STATEMENT, not the bare name — the lesson recorded in
  // vendor-compatibility.test.ts, where the first cut asserted on the name and
  // was satisfied by the explanatory comment above the guard, so deleting the
  // condition left the test green. A name appearing is not a name being used.
  const guardRe = /if \(!formData\.get\('visibility_fields_present'\)\) \{/;
  assert.match(src, guardRe, 'the presence-marker guard statement is gone');
  const guardIdx = src.search(guardRe);
  const writeIdx = src.indexOf('.update(');
  assert.ok(writeIdx > -1, '.update() not found — did the write move?');
  assert.ok(guardIdx < writeIdx, 'the marker must be checked BEFORE the write');
  // …and the guard must actually return, not merely log.
  assert.match(
    src.slice(guardIdx, writeIdx),
    /return \{ ok: false/,
    'the guard falls through instead of refusing the save',
  );
});

test('the visibility card posts the presence marker it is gated on', () => {
  // If the card ever stops posting this, the action refuses every save —
  // loudly, which is the correct direction to fail, but this catches it first.
  assert.match(read(VISIBILITY_CARD), /set\('visibility_fields_present'/);
});

test('the text action uses has() per field, so a missing key never blanks a column', () => {
  const src = read(PUBLIC_LINE_ACTION);
  assert.match(src, /formData\.has\('tagline'\)/);
  assert.match(src, /formData\.has\('website'\)/);
  // And an empty patch must be a no-op, not a write of two NULLs.
  assert.match(src, /Object\.keys\(patch\)\.length === 0/);
});

test('neither action reintroduces the full-payload shape', () => {
  // `vendor-compatibility.test.ts` guards the same hazard on the orphaned
  // full-form action; these two carry the identical absent-means-false shape,
  // so they must never grow into a whole-profile write.
  // Matched in WRITE shape only (`key:` in a patch object, or `patch.key =`).
  // A bare mention is fine and expected — both docblocks quote the migration
  // comment that lists is_published among the non-identity writes.
  const FORBIDDEN = ['is_published', 'business_name', 'contact_email', 'contact_phone', 'services'];
  for (const rel of [PUBLIC_LINE_ACTION, VISIBILITY_ACTION]) {
    const src = read(rel);
    for (const key of FORBIDDEN) {
      assert.ok(
        !new RegExp(`(^|[\\s{,])${key}\\s*:`, 'm').test(src),
        `${rel} must not write ${key}`,
      );
      assert.ok(
        !new RegExp(`patch\\.${key}\\s*=`).test(src),
        `${rel} must not write ${key}`,
      );
    }
  }
});

// ── the verified lock must not swallow these ─────────────────────────────────

test('the four fields stay OUT of the verified-locked inline editor', () => {
  // `updateVendorProfileField` refuses every field outside GALLERY_MEDIA_FIELDS
  // once a shop is verified. Both booleans only ACT on a verified shop, so
  // adding them there would make them settable only by the vendors they can
  // never apply to — and a tagline change would become an admin ticket.
  // 20270503892144_vendor_correction_requests.sql names the split: "Non-identity
  // writes (is_published, tagline, portfolio, opt-outs, compatibility arrays)
  // stay vendor-editable."
  const actions = read('../app/vendor-dashboard/actions.ts');
  const start = actions.indexOf('const INLINE_PROFILE_FIELDS');
  assert.ok(start > -1, 'INLINE_PROFILE_FIELDS not found — did it move?');
  const block = actions.slice(start, actions.indexOf('])', start));
  for (const key of ['tagline', 'website', 'same_day_available', 'social_feature_opt_out']) {
    assert.ok(
      !block.includes(`'${key}'`),
      `${key} must not be an INLINE_PROFILE_FIELDS key — the verified lock would block it`,
    );
  }
});
