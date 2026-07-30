/**
 * SEC-1 regression lock — the client-supplied-R2-ref gate.
 *
 * Node built-in test runner via tsx (`pnpm test:unit`). Imports the PURE module
 * `./r2-client-ref` (no `server-only`, no SDK) — the same split
 * `lib/bucket-routing.test.ts` uses, because `import 'server-only'` throws
 * outside an RSC context.
 *
 * What these lock down: an authenticated caller who is authorised for event A /
 * vendor A must NOT be able to get event B's or vendor B's object signed by
 * handing its key to a server action. Every `assert.equal(…, null)` below is a
 * refusal that the pre-fix code allowed.
 *
 * ⚠ MUTATION-CHECKED. These tests are only meaningful if they FAIL when the
 * guard is neutralised. Verified by deleting the two tenancy checks from
 * `parseClientRef` (the bucket comparison and the prefix match), i.e. restoring
 * the pre-fix "sign whatever you're handed" behaviour: **11 of the 22 tests
 * fail**, including every cross-tenant case. Re-run that mutation if you ever
 * relax this file — a suite that still passes against the mutant is vacuous.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseClientRef,
  requireClientRef,
  R2RefRefused,
  PUBLIC_R2_BUCKET,
  PRIVATE_R2_BUCKETS,
  stdMediaPolicy,
  eventMediaPolicy,
  walkthroughVideoPolicy,
  patiktokClipPolicy,
  guestSelfiePolicy,
  vendorPaymentQrPolicy,
  vendorVerificationDocPolicy,
  editorialVendorMediaPolicy,
} from './r2-client-ref';

const EVENT_A = '11111111-1111-4111-8111-111111111111';
const EVENT_B = '22222222-2222-4222-8222-222222222222';
const VENDOR_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const VENDOR_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const GUEST_A = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const ZONE_A = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

// ---------------------------------------------------------------------------
// 1. The core exploit: another tenant's key must be refused.
// ---------------------------------------------------------------------------

test('SEC-1 · a couple authorised for event A cannot get event B’s object signed', () => {
  const policy = stdMediaPolicy(EVENT_A);
  assert.equal(
    parseClientRef(
      `r2://setnayan-media/events/${EVENT_B}/std-background/uuid-photo.jpg`,
      policy,
    ),
    null,
  );
});

test('SEC-1 · a vendor cannot get another vendor’s payment QR signed', () => {
  assert.equal(
    parseClientRef(
      `r2://setnayan-media/vendors/${VENDOR_B}/payment-qr/uuid-qr.png`,
      vendorPaymentQrPolicy(VENDOR_A),
    ),
    null,
  );
});

test('SEC-1 · a vendor cannot get another vendor’s VERIFICATION documents signed', () => {
  // The crown jewel: DTI / BIR 2303 / Mayor's Permit / government IDs.
  assert.equal(
    parseClientRef(
      `r2://setnayan-vendor-verification/vendors/${VENDOR_B}/verification/dti/uuid-permit.pdf`,
      vendorVerificationDocPolicy(VENDOR_A),
    ),
    null,
  );
});

test('SEC-1 · a guest cannot get another guest’s selfie signed', () => {
  const otherGuest = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  assert.equal(
    parseClientRef(
      `r2://setnayan-media/events/${EVENT_A}/guest-selfies/${otherGuest}/uuid.jpg`,
      guestSelfiePolicy(EVENT_A, GUEST_A),
    ),
    null,
  );
});

// ---------------------------------------------------------------------------
// 2. Bucket containment — a media-bucket flow may never reach a PRIVATE bucket.
//    This is the half that actually leaks secrets, because setnayan-media is
//    already served unsigned over the public R2 host.
// ---------------------------------------------------------------------------

test('SEC-1 · a media-bucket policy refuses EVERY private bucket, even at a matching prefix', () => {
  const policy = eventMediaPolicy(EVENT_A);
  for (const bucket of PRIVATE_R2_BUCKETS) {
    assert.equal(
      parseClientRef(`r2://${bucket}/events/${EVENT_A}/payment-proof/uuid.jpg`, policy),
      null,
      `${bucket} must be refused by a media-bucket policy`,
    );
  }
});

test('SEC-1 · the vendor-verification policy refuses the PUBLIC bucket (no downgrade)', () => {
  assert.equal(
    parseClientRef(
      `r2://setnayan-media/vendors/${VENDOR_A}/verification/dti/uuid.pdf`,
      vendorVerificationDocPolicy(VENDOR_A),
    ),
    null,
  );
});

test('SEC-1 · an unknown bucket name is refused', () => {
  assert.equal(
    parseClientRef(
      `r2://setnayan-media-evil/events/${EVENT_A}/std-background/x.jpg`,
      stdMediaPolicy(EVENT_A),
    ),
    null,
  );
});

// ---------------------------------------------------------------------------
// 3. Prefix confusion — `event-123` vs `event-1234`.
// ---------------------------------------------------------------------------

test('SEC-1 · prefix confusion: event id A is not a prefix of a longer sibling id', () => {
  // The classic: without the mandatory trailing slash, `events/{A}` would
  // startsWith-match `events/{A}extra/…`.
  const sibling = `${EVENT_A}extra`;
  assert.equal(
    parseClientRef(
      `r2://setnayan-media/events/${sibling}/std-background/uuid.jpg`,
      stdMediaPolicy(EVENT_A),
    ),
    null,
  );
});

test('SEC-1 · prefix confusion: short numeric ids do not cross-match', () => {
  assert.equal(parseClientRef('r2://setnayan-media/events/1234/x.jpg', eventMediaPolicy('123')), null);
  assert.ok(parseClientRef('r2://setnayan-media/events/123/x.jpg', eventMediaPolicy('123')));
});

test('SEC-1 · prefix confusion: a sibling zone under the same event is refused', () => {
  const otherZone = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  assert.equal(
    parseClientRef(
      `r2://setnayan-media/zone-walkthroughs/${EVENT_A}/${otherZone}/uuid.mp4`,
      walkthroughVideoPolicy(EVENT_A, ZONE_A),
    ),
    null,
  );
});

test('SEC-1 · a policy prefix without a trailing slash is a hard programming error', () => {
  // Guards against a future call site widening the gate by accident.
  assert.throws(
    () => parseClientRef('r2://setnayan-media/events/123/x.jpg', { prefixes: ['events/123'] }),
    /must be a non-empty string ending in/,
  );
  assert.throws(
    () => parseClientRef('r2://setnayan-media/x.jpg', { prefixes: [] }),
    /at least one prefix/,
  );
});

// ---------------------------------------------------------------------------
// 4. Traversal + structurally hostile keys.
// ---------------------------------------------------------------------------

test('SEC-1 · `..` segments are refused even when the prefix matches', () => {
  const policy = eventMediaPolicy(EVENT_A);
  assert.equal(
    parseClientRef(
      `r2://setnayan-media/events/${EVENT_A}/../${EVENT_B}/hero.jpg`,
      policy,
    ),
    null,
  );
  assert.equal(
    parseClientRef(`r2://setnayan-media/events/${EVENT_A}/./hero.jpg`, policy),
    null,
  );
});

test('SEC-1 · absolute keys, backslashes and control characters are refused', () => {
  const policy = { prefixes: ['x/'] } as const;
  // Absolute key (double slash after the bucket).
  assert.equal(parseClientRef('r2://setnayan-media//x/a.jpg', policy), null);
  // Backslash — normalisation ambiguity on any Windows-ish intermediary.
  assert.equal(parseClientRef('r2://setnayan-media/x/a\\b.jpg', policy), null);
  // C0 controls + DEL — header / log injection.
  assert.equal(parseClientRef('r2://setnayan-media/x/a\u0000b.jpg', policy), null);
  assert.equal(parseClientRef('r2://setnayan-media/x/a\nb.jpg', policy), null);
  assert.equal(parseClientRef('r2://setnayan-media/x/a\rb.jpg', policy), null);
  assert.equal(parseClientRef('r2://setnayan-media/x/a\u001fb.jpg', policy), null);
  assert.equal(parseClientRef('r2://setnayan-media/x/a\u007fb.jpg', policy), null);
  // A plain space (0x20) is LEGAL in an S3 key and must still be accepted —
  // the guard rejects control bytes, not ordinary printable characters.
  assert.deepEqual(parseClientRef('r2://setnayan-media/x/a b.jpg', policy), {
    bucket: PUBLIC_R2_BUCKET,
    key: 'x/a b.jpg',
  });
});

test('SEC-1 · an over-long key is refused', () => {
  assert.equal(
    parseClientRef(`r2://setnayan-media/x/${'a'.repeat(1100)}`, { prefixes: ['x/'] }),
    null,
  );
});

test('SEC-1 · the bare prefix itself is not a signable object', () => {
  assert.equal(
    parseClientRef(`r2://setnayan-media/events/${EVENT_A}/`, eventMediaPolicy(EVENT_A)),
    null,
  );
});

// ---------------------------------------------------------------------------
// 5. Non-r2 input — the SSRF / legacy-passthrough closure.
// ---------------------------------------------------------------------------

test('SEC-1 · a bare http(s) URL is refused (closes the legacy-passthrough SSRF)', () => {
  const policy = vendorPaymentQrPolicy(VENDOR_A);
  // displayUrlForStoredAsset returns these VERBATIM, and decodeQrFromR2 fetches
  // whatever it gets back — this is the SSRF primitive.
  assert.equal(parseClientRef('http://169.254.169.254/latest/meta-data/', policy), null);
  assert.equal(parseClientRef('https://evil.example/x.png', policy), null);
  assert.equal(parseClientRef('file:///etc/passwd', policy), null);
});

test('SEC-1 · non-string and malformed input is refused, never thrown on', () => {
  const policy = eventMediaPolicy(EVENT_A);
  for (const bad of [null, undefined, 42, {}, [], true, '', '   ', 'r2://', 'r2://bucket-only', 'r2:///leading']) {
    assert.equal(parseClientRef(bad, policy), null, `${JSON.stringify(bad)} must be refused`);
  }
});

// ---------------------------------------------------------------------------
// 6. Legitimate access still works — the "don't break the product" half.
// ---------------------------------------------------------------------------

test('legit · every real uploader prefix is accepted by its own policy', () => {
  const cases: ReadonlyArray<readonly [string, ReturnType<typeof eventMediaPolicy>]> = [
    // std-background-picker.tsx / std-media-picker.tsx
    [`events/${EVENT_A}/std-background/uuid-photo.jpg`, stdMediaPolicy(EVENT_A)],
    [`events/${EVENT_A}/std-video/uuid-clip.mp4`, stdMediaPolicy(EVENT_A)],
    [`events/${EVENT_A}/std-video-poster/uuid-poster.jpg`, stdMediaPolicy(EVENT_A)],
    // site-chrome / editor media panels
    [`events/${EVENT_A}/site-music/uuid-song.mp3`, eventMediaPolicy(EVENT_A)],
    [`events/${EVENT_A}/landing-page-hero/uuid.jpg`, eventMediaPolicy(EVENT_A)],
    // walkthrough-manager.tsx
    [`zone-walkthroughs/${EVENT_A}/${ZONE_A}/uuid-walk.mp4`, walkthroughVideoPolicy(EVENT_A, ZONE_A)],
    // /api/patiktok/upload
    [`patiktok/clips/${EVENT_A}/uuid.webm`, patiktokClipPolicy(EVENT_A)],
    // /api/guest-selfie
    [`events/${EVENT_A}/guest-selfies/${GUEST_A}/uuid.jpg`, guestSelfiePolicy(EVENT_A, GUEST_A)],
    // add-payment-method.tsx
    [`vendors/${VENDOR_A}/payment-qr/uuid-qr.png`, vendorPaymentQrPolicy(VENDOR_A)],
    // editorial-media-studio.tsx — TENANTED as of SEC-1 lane #3 (was a flat
    // `editorial-vendor/` prefix that could only be contained, never owned).
    [
      `editorial-vendor/${VENDOR_A}/${EVENT_A}/uuid-still.jpg`,
      editorialVendorMediaPolicy(VENDOR_A, EVENT_A),
    ],
  ];
  for (const [key, policy] of cases) {
    const got = parseClientRef(`r2://setnayan-media/${key}`, policy);
    assert.deepEqual(got, { bucket: PUBLIC_R2_BUCKET, key }, `must accept ${key}`);
  }
});

test('legit · vendor verification docs still resolve in the private bucket', () => {
  const key = `vendors/${VENDOR_A}/verification/dti_registration/uuid-dti.pdf`;
  assert.deepEqual(
    parseClientRef(`r2://setnayan-vendor-verification/${key}`, vendorVerificationDocPolicy(VENDOR_A)),
    { bucket: 'setnayan-vendor-verification', key },
  );
});

test('legit · surrounding whitespace is tolerated', () => {
  const key = `events/${EVENT_A}/std-background/uuid.jpg`;
  assert.deepEqual(
    parseClientRef(`  r2://setnayan-media/${key}  `, stdMediaPolicy(EVENT_A)),
    { bucket: PUBLIC_R2_BUCKET, key },
  );
});

// ---------------------------------------------------------------------------
// 7. requireClientRef throws rather than returning null.
// ---------------------------------------------------------------------------

test('requireClientRef throws R2RefRefused on a cross-tenant ref and returns on a valid one', () => {
  assert.throws(
    () =>
      requireClientRef(
        `r2://setnayan-media/events/${EVENT_B}/std-background/x.jpg`,
        stdMediaPolicy(EVENT_A),
      ),
    (err: unknown) => err instanceof R2RefRefused,
  );
  const key = `events/${EVENT_A}/std-background/x.jpg`;
  assert.deepEqual(requireClientRef(`r2://setnayan-media/${key}`, stdMediaPolicy(EVENT_A)), {
    bucket: PUBLIC_R2_BUCKET,
    key,
  });
});

test('requireClientRef’s message does not disclose bucket, key or existence', () => {
  try {
    requireClientRef('r2://setnayan-vendor-verification/vendors/x/verification/secret.pdf', eventMediaPolicy(EVENT_A));
    assert.fail('should have thrown');
  } catch (err) {
    const msg = (err as Error).message;
    assert.ok(!msg.includes('vendor-verification'), 'must not name the bucket');
    assert.ok(!msg.includes('secret.pdf'), 'must not echo the key');
  }
});
