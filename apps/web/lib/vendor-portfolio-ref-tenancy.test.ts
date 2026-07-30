/**
 * 🔴 A vendor's portfolio could publish ANOTHER vendor's government ID.
 *
 * `/v/[slug]` — the PUBLIC vendor page — resolves `portfolio_r2_keys` through
 * `resolvePortfolioUrls` → `displayUrlForStoredAsset`, which `lib/r2-client-ref.ts`
 * documents as signing "any r2:// ref for any of the five buckets with no tenancy
 * check whatsoever". The only validation on the write side was
 * `startsWith('r2://')`.
 *
 * So a vendor could store
 *   r2://setnayan-vendor-verification/vendors/{someone else}/verification/dti.pdf
 * in their OWN portfolio array, and their own public profile would publish it —
 * another vendor's DTI / BIR 2303 / Mayor's Permit, served to the open internet.
 * Strictly worse than the paperwork lane (#3902), which at least required being
 * signed in as the host.
 *
 * The fix pins every ref through `vendorOwnedMediaPolicy` — public media bucket
 * only, `vendors/{thisVendor}/` prefix only — inside the SHARED parser, so both
 * call sites and any future one inherit it. These tests exercise the policy
 * directly (it is pure) plus a source-scan on the wiring, because the parser is
 * module-private.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseClientRef, vendorOwnedMediaPolicy } from './r2-client-ref';

const MINE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const THEIRS = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

test('a vendor keeps their own portfolio media', () => {
  const policy = vendorOwnedMediaPolicy(MINE);
  for (const key of [
    `vendors/${MINE}/portfolio/shot-1.jpg`,
    `vendors/${MINE}/services/showcase/x.webp`,
    `vendors/${MINE}/logo/mark.png`,
  ]) {
    assert.ok(parseClientRef(`r2://setnayan-media/${key}`, policy), `${key} is legitimately theirs`);
  }
});

test("🔴 another vendor's VERIFICATION DOC is refused — the public-exposure bug", () => {
  // The exact attack: a private-bucket government ID smuggled into a portfolio
  // array, then published by the vendor's own public page.
  assert.equal(
    parseClientRef(
      `r2://setnayan-vendor-verification/vendors/${THEIRS}/verification/dti.pdf`,
      vendorOwnedMediaPolicy(MINE),
    ),
    null,
  );
  // …and not even their OWN verification doc: that bucket is private and has its
  // own flow (vendorVerificationDocPolicy). A portfolio is public by definition.
  assert.equal(
    parseClientRef(
      `r2://setnayan-vendor-verification/vendors/${MINE}/verification/dti.pdf`,
      vendorOwnedMediaPolicy(MINE),
    ),
    null,
  );
});

test("another vendor's public media is refused too", () => {
  assert.equal(
    parseClientRef(`r2://setnayan-media/vendors/${THEIRS}/portfolio/shot.jpg`, vendorOwnedMediaPolicy(MINE)),
    null,
  );
});

test('every other private bucket is refused from a portfolio ref', () => {
  for (const bucket of [
    'setnayan-thread-files',       // payment screenshots, dispute evidence
    'setnayan-vendor-contracts',   // signed contracts, paperwork scans
    'setnayan-samples',
  ]) {
    assert.equal(
      parseClientRef(`r2://${bucket}/vendors/${MINE}/portfolio/x.jpg`, vendorOwnedMediaPolicy(MINE)),
      null,
      `${bucket} must never be reachable from a portfolio ref`,
    );
  }
});

test('an empty vendor id allows NOTHING — the fail-closed default', () => {
  // The call sites pass `?? ''`. That can never cost a real gallery (the id is the
  // PK of a row selected by the caller's own user_id, and the write is an
  // UPDATE keyed on user_id — no row ⇒ nothing persisted), but if it is ever
  // reached it must allow nothing rather than everything.
  assert.equal(
    parseClientRef(`r2://setnayan-media/vendors/${MINE}/portfolio/x.jpg`, vendorOwnedMediaPolicy('')),
    null,
  );
});

test('the WIRING: both call sites pass a vendor id into the shared parser', () => {
  // The parser is module-private, so its enforcement is verified through the
  // policy above; this pins that the enforcement is actually reached. Guard the
  // consumer, not just the rule.
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'vendor-dashboard', 'actions.ts'),
    'utf8',
  );
  assert.match(
    src,
    /function parsePortfolioRefs\([\s\S]{0,200}?vendorProfileId: string,\n\)/,
    'parsePortfolioRefs must REQUIRE a vendor id — no default, so a caller cannot forget it',
  );
  assert.match(src, /const policy = vendorOwnedMediaPolicy\(vendorProfileId\);/);
  assert.match(src, /if \(!parseClientRef\(trimmed, policy\)\) continue;/, 'refs must be filtered by the policy');
  const calls = src.match(/parsePortfolioRefs\(/g) ?? [];
  assert.equal(calls.length, 3, 'expected the definition + exactly 2 call sites');
  assert.equal(
    (src.match(/vendor_profile_id \?\? ''/g) ?? []).length,
    2,
    'both call sites must thread the vendor id',
  );
});
