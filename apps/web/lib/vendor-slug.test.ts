/**
 * Shop web-address parsing.
 *
 * The reserved-word case is the one that matters. Vendors, events and users
 * share ONE top-level namespace, and `app/[slug]/page.tsx` answers
 * `RESERVED_SLUGS.has(slug)` with notFound() BEFORE it looks for a vendor — so
 * a shop allowed to claim `pricing` would hold an address that resolves
 * nowhere. Until this file existed the parser checked shape only.
 *
 * Run: pnpm --filter @setnayan/web test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RESERVED_SLUGS } from './reserved-slugs';
import {
  VENDOR_SLUG_RESERVED_ERROR,
  VENDOR_SLUG_RE,
  parseVendorSlug,
} from './vendor-slug';

test('a normal address is lowercased and accepted', () => {
  assert.equal(parseVendorSlug('  Bloom-And-Vine  '), 'bloom-and-vine');
});

test('blank / absent input clears the address rather than erroring', () => {
  assert.equal(parseVendorSlug(''), null);
  assert.equal(parseVendorSlug('   '), null);
  assert.equal(parseVendorSlug(null), null);
  assert.equal(parseVendorSlug(undefined), null);
});

test('a bad shape is refused', () => {
  for (const bad of ['ab', 'has spaces', 'Ünicode', 'under_score', 'a'.repeat(33)]) {
    assert.throws(
      () => parseVendorSlug(bad),
      /Slug must be/,
      `${JSON.stringify(bad)} must be refused`,
    );
  }
});

test('every reserved word is refused as a shop address', () => {
  // Only the words that are shape-valid can reach the reserved check at all —
  // 'u', 'v' and 'sw.js' are already refused by the format. Asserting over the
  // whole list keeps this honest as the list grows.
  const reachable = [...RESERVED_SLUGS].filter((w) => VENDOR_SLUG_RE.test(w));
  assert.ok(reachable.length > 40, 'precondition: the reserved list was read');

  const accepted: string[] = [];
  for (const word of reachable) {
    try {
      parseVendorSlug(word);
      accepted.push(word);
    } catch (e) {
      assert.equal(
        (e as Error).message,
        VENDOR_SLUG_RESERVED_ERROR,
        `${word} must be refused as RESERVED, not as a bad shape`,
      );
    }
  }
  assert.deepEqual(
    accepted,
    [],
    'these reserved words were accepted as shop addresses — each would resolve nowhere',
  );
});

test('a word that merely CONTAINS a reserved word is fine', () => {
  assert.equal(parseVendorSlug('pricing-studio'), 'pricing-studio');
  assert.equal(parseVendorSlug('explore-manila'), 'explore-manila');
});
