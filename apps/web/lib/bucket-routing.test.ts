/**
 * Unit suite for `bucketForPrefix` — the path-prefix → R2-bucket router
 * (Node built-in test runner via tsx · `pnpm test:unit`).
 *
 * Privacy-critical regression lock (2026-07-04 Data Flow Map audit, gap #1):
 * payment-proof screenshots MUST route to the PRIVATE `threadFiles` bucket,
 * never the public `media` bucket. The original bug matched only the singular
 * `payment-screenshot/` prefix while the writers pass the PLURAL
 * `payment-screenshots/…`, so proofs fell through to the public default.
 *
 * Imports the mapping from `./bucket-routing` (pure, client-safe) — NOT
 * `./storage`, whose top-of-file `import 'server-only'` throws under the Node
 * test runner. `storage.ts` re-exports the same function for app callers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bucketForPrefix } from './bucket-routing';

test('payment proofs route to the PRIVATE thread-files bucket (plural prefix — what the writers actually pass)', () => {
  // The exact prefixes both server-side writers use.
  assert.equal(
    bucketForPrefix('payment-screenshots/inline-checkout/user-123'),
    'threadFiles',
  );
  assert.equal(
    bucketForPrefix('payment-screenshots/order-abc'),
    'threadFiles',
  );
  // Leading slash must not change the routing.
  assert.equal(
    bucketForPrefix('/payment-screenshots/order-abc'),
    'threadFiles',
  );
});

test('singular payment-screenshot/ prefix also routes private (legacy safety)', () => {
  assert.equal(
    bucketForPrefix('payment-screenshot/legacy-key'),
    'threadFiles',
  );
});

test('off-platform vendor-payment receipts route PRIVATE (F10, 2026-07-30)', () => {
  // These wrote to the PUBLIC media bucket until 2026-07-30: the couple's
  // bank-transfer screenshot for an off-platform vendor payment, carrying
  // reference numbers and partial account numbers. Same PII class as the
  // checkout proofs above; the client now passes bucket="thread-files" and this
  // prefix rule makes the routing sufficient on its own.
  assert.equal(bucketForPrefix('payment-proof/events/evt-123'), 'threadFiles');
  assert.equal(bucketForPrefix('/payment-proof/events/evt-123'), 'threadFiles');
});

test('the OLD receipt prefix would have leaked — proving the fix is the prefix, not luck', () => {
  // The original path was `events/<id>/payment-proof`, which starts with
  // "events/" and therefore takes the public default. Pinned so nobody
  // "tidies" the prefix back to an event-first shape and silently re-opens it.
  assert.equal(bucketForPrefix('events/evt-123/payment-proof'), 'media');
});

test('public-asset prefixes still route to the media bucket', () => {
  assert.equal(bucketForPrefix('merchant-qr/vendor-1'), 'media');
  assert.equal(bucketForPrefix('vendor-logo/vendor-1'), 'media');
  assert.equal(bucketForPrefix('profile-photo/user-1'), 'media');
});

test('unknown prefixes fall back to the public media bucket', () => {
  assert.equal(bucketForPrefix('something-else/x'), 'media');
  assert.equal(bucketForPrefix(''), 'media');
});

test('a look-alike prefix does NOT leak proofs into media', () => {
  // Anything that starts with the plural proof prefix is private; a different
  // segment that merely contains the word "payment" is not misrouted.
  assert.notEqual(
    bucketForPrefix('payment-screenshots/anything'),
    'media',
  );
});
