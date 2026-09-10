/**
 * tagline-and-about-run-the-contact-filter.test.ts — E2 (CLEANUPS bundle,
 * 2026-09-11).
 *
 * GOAL: applying the owner's already-settled rule (2026-07-23 chat;
 * 2026-07-27 card text: "no placing of contact information or anything to
 * bypass our app") to the shop's own About paragraph and tagline — the same
 * `findVendorTextViolation` gate that already runs on chat text and on
 * service-card/package text (`lib/service-text-integrity.ts`).
 *
 * Two save paths are wired here for the first time:
 *   · `updatePublicLine` (app/vendor-dashboard/shop/public-line-actions.ts) —
 *     the tagline. The shop's own WEBSITE field on the same action is
 *     deliberately left unchecked (owner question 3, still open).
 *   · `updateVendorWebsiteField` case `'microsite_about'`
 *     (app/vendor-dashboard/actions.ts ~900) — the About paragraph. Every
 *     other field that switch saves (sections, featured picks, accent, hero
 *     photo, video refs) is deliberately left unchecked — none of them are
 *     free text a vendor could hide a phone number in.
 *
 * Both actions are `'use server'` files that import `next/cache` and a
 * Supabase server client, so they cannot run end-to-end under plain
 * `node:test` (no Next.js request context, no live database) — the same
 * constraint documented for `redirect-keeps-params.test.ts`. This is
 * therefore a SOURCE-SCAN guard, exactly like that one: it proves the wiring
 * is present and scoped correctly, not the runtime behaviour of
 * `findVendorTextViolation` itself, which
 * `lib/service-text-integrity.test.ts` already locks (flag on/off, blank
 * handling, the detector's rule matrix).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const APP = path.join(HERE, '..', 'app');

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '');
}

const PUBLIC_LINE = path.join(APP, 'vendor-dashboard', 'shop', 'public-line-actions.ts');
const WEBSITE_FIELD = path.join(APP, 'vendor-dashboard', 'actions.ts');

/* ── tagline save ───────────────────────────────────────────────────────── */

test('public-line-actions.ts imports the card-text integrity gate', () => {
  const src = stripComments(readFileSync(PUBLIC_LINE, 'utf8'));
  assert.ok(
    src.includes("from '@/lib/service-text-integrity'") && src.includes('findVendorTextViolation'),
    'updatePublicLine no longer imports findVendorTextViolation.',
  );
});

test('public-line-actions.ts runs the gate on the tagline field', () => {
  const src = stripComments(readFileSync(PUBLIC_LINE, 'utf8'));
  assert.match(
    src,
    /findVendorTextViolation\(\[\s*\{\s*field:\s*'Tagline'/,
    'The tagline save no longer runs findVendorTextViolation on a "Tagline" field.',
  );
});

test('public-line-actions.ts does NOT run the gate on the website field (owner question 3, open)', () => {
  const src = stripComments(readFileSync(PUBLIC_LINE, 'utf8'));
  // The gate call itself only names 'tagline' — website must never appear
  // inside the findVendorTextViolation([...]) array literal.
  const callMatch = src.match(/findVendorTextViolation\(\[[\s\S]*?\]\)/);
  assert.ok(callMatch, 'Could not find the findVendorTextViolation(...) call to inspect.');
  assert.ok(
    !callMatch[0].includes('website') && !callMatch[0].includes('Website'),
    'The tagline gate call now also names the website field — owner question 3 ' +
      'is still open on whether the shop\'s own site may carry contact details.',
  );
});

/* ── About save ─────────────────────────────────────────────────────────── */

test('vendor-dashboard/actions.ts imports the card-text integrity gate', () => {
  const src = stripComments(readFileSync(WEBSITE_FIELD, 'utf8'));
  assert.ok(
    src.includes("from '@/lib/service-text-integrity'") && src.includes('findVendorTextViolation'),
    'updateVendorWebsiteField no longer imports findVendorTextViolation.',
  );
});

test('vendor-dashboard/actions.ts runs the gate on microsite_about, scoped to that field only', () => {
  const src = stripComments(readFileSync(WEBSITE_FIELD, 'utf8'));
  assert.match(
    src,
    /if \(field === 'microsite_about'\) \{\s*const viol = findVendorTextViolation\(\[\s*\{\s*field:\s*'About'/,
    "The About save no longer guards findVendorTextViolation behind field === 'microsite_about', " +
      'or no longer names the field "About".',
  );
});
