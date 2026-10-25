/**
 * person-page-link.test.ts — a People name opens the account's page by its slug, else by its public handle,
 * else nothing (owner 2026-10-25: "i cannot click their names i should be able to see it because they have
 * account already").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { personPageHref } from '@/lib/person-page-link';

test('a slug is the address', () => {
  assert.equal(personPageHref({ slug: 'cale-ice', publicId: 'S89U-ABCDEFGHJK' }), '/u/cale-ice');
  assert.equal(personPageHref({ slug: 'Cale-Ice' }), '/u/cale-ice');
});

test('no slug → the account’s public handle, which /u resolves too', () => {
  assert.equal(personPageHref({ slug: null, publicId: 'S89U-ABCDEFGHJK' }), '/u/S89U-ABCDEFGHJK');
  assert.equal(personPageHref({ publicId: 's89u-abcdefghjk' }), '/u/S89U-ABCDEFGHJK');
});

test('no account → no door', () => {
  // A person node nobody has claimed is not an account.
  assert.equal(personPageHref({ slug: null, publicId: 'S89P-ABCDEFGHJK' }), null);
  assert.equal(personPageHref({ slug: null, publicId: null }), null);
  assert.equal(personPageHref({}), null);
  assert.equal(personPageHref(null), null);
  // A malformed slug or handle is never pasted into a URL.
  assert.equal(personPageHref({ slug: '../admin', publicId: 'S89U-<script>' }), null);
});
