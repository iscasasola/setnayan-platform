/**
 * SEC-1 deferred lane #2 — the stored-ref WRITE paths.
 *
 * #3729 closed the read/display oracles but left five write paths persisting a
 * client-supplied `r2://` ref verbatim. Two are fixed here, and they are not the
 * same severity, which is the point worth encoding:
 *
 *   • PAPERWORK writes to `setnayan-vendor-contracts` — a PRIVATE bucket shared
 *     with signed contracts and platform receipts. Storing the raw field let a
 *     host put ANY key from that bucket onto their OWN paperwork row, and
 *     `paperwork/page.tsx` resolves stored refs into signed display URLs. That is
 *     a cross-tenant read oracle reached entirely through a row the attacker
 *     legitimately owns — the RLS-scoped UPDATE stops them writing to someone
 *     else's row, but cannot stop them naming someone else's KEY on their own.
 *
 *   • BUDGET PROOF writes to the public media bucket, so there is no
 *     confidentiality delta. Its guard buys containment and attribution.
 *
 * The guard is pure + client-safe precisely so this can be a real unit test
 * rather than a source scan.
 */
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';

import {
  parseClientRef,
  requireClientRef,
  paperworkScanPolicy,
  budgetPaymentProofPolicy,
  R2RefRefused,
} from './r2-client-ref';

const EVENT = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const CONTRACTS = 'setnayan-vendor-contracts';

/* ── paperwork · private bucket ─────────────────────────────────────────────── */

test('paperwork: the legitimate upload is accepted', () => {
  // Exactly what /api/upload mints for <FileUpload bucket="vendor-contracts"
  // pathPrefix={`paperwork/${eventId}/${documentType}`}> — verified against
  // encodeR2Ref + R2_BUCKETS.vendorContracts, so this pins the real contract and
  // would fail loudly if the bucket alias or key layout ever moved.
  const ref = `r2://${CONTRACTS}/paperwork/${EVENT}/psa_birth/abc-123.pdf`;
  const got = requireClientRef(ref, paperworkScanPolicy(EVENT));
  assert.equal(got.bucket, CONTRACTS);
  assert.equal(got.key, `paperwork/${EVENT}/psa_birth/abc-123.pdf`);
});

test('paperwork: ANOTHER event\'s scan is refused — the cross-tenant oracle', () => {
  const ref = `r2://${CONTRACTS}/paperwork/${OTHER}/psa_birth/secret.pdf`;
  assert.throws(
    () => requireClientRef(ref, paperworkScanPolicy(EVENT)),
    R2RefRefused,
    "a host must not be able to file another couple's PSA onto their own row",
  );
});

test('paperwork: a vendor CONTRACT in the same bucket is refused', () => {
  // The bucket also holds signed contracts and platform receipts. Sharing a
  // bucket must not mean sharing reachability.
  for (const key of [
    'contracts/some-vendor/signed-agreement.pdf',
    'receipts/2026/platform-receipt.pdf',
  ]) {
    assert.throws(
      () => requireClientRef(`r2://${CONTRACTS}/${key}`, paperworkScanPolicy(EVENT)),
      R2RefRefused,
      `${key} is in the same private bucket but is not this event's paperwork`,
    );
  }
});

test('paperwork: a PRIVATE-bucket key cannot be reached via the default bucket', () => {
  // The policy names the private bucket explicitly; a ref that omits it (or names
  // the public one) must not satisfy it.
  assert.equal(
    parseClientRef(`r2://setnayan-media/paperwork/${EVENT}/psa_birth/x.pdf`, paperworkScanPolicy(EVENT)),
    null,
  );
});

test('paperwork: traversal and legacy URLs are refused', () => {
  const policy = paperworkScanPolicy(EVENT);
  for (const bad of [
    `r2://${CONTRACTS}/paperwork/${EVENT}/../${OTHER}/psa.pdf`,
    `https://media.setnayan.com/paperwork/${EVENT}/psa.pdf`, // legacy URL ⇒ the SSRF shape
    `r2://${CONTRACTS}/paperwork/${EVENT}`,                   // prefix itself, no object
    '',
    'not-a-ref',
  ]) {
    assert.equal(parseClientRef(bad, policy), null, `expected refusal for: ${bad}`);
  }
});

test('paperwork: refusal is non-specific — never an existence oracle', () => {
  try {
    requireClientRef(`r2://${CONTRACTS}/paperwork/${OTHER}/psa.pdf`, paperworkScanPolicy(EVENT));
    assert.fail('should have thrown');
  } catch (e) {
    const msg = (e as Error).message;
    assert.equal(/exist|bucket|prefix|setnayan-/.test(msg), false,
      `the message must not leak why it failed — got: ${msg}`);
  }
});

/* ── budget proof · PRIVATE thread-files bucket ─────────────────────────────── */

/**
 * ⚠ THESE TWO TESTS ASSERTED A REF NO UPLOADER HAS EVER PRODUCED, which is
 * exactly why the broken feature shipped green. They pinned
 * `r2://setnayan-media/budget/<EVENT>/receipt.jpg` — public bucket, `budget/`
 * prefix — while the one uploader
 * (`_components/vendor-itemization-card.tsx`) mints
 * `payment-proof/events/<EVENT>/` in the PRIVATE thread-files bucket. A test is
 * only as real as the value it feeds in.
 */
test('budget proof: this event is accepted, another event is not', () => {
  const policy = budgetPaymentProofPolicy(EVENT);
  assert.ok(
    parseClientRef(`r2://setnayan-thread-files/payment-proof/events/${EVENT}/receipt.jpg`, policy),
    'the prefix the real uploader mints must be accepted',
  );
  assert.equal(
    parseClientRef(`r2://setnayan-thread-files/payment-proof/events/${OTHER}/receipt.jpg`, policy),
    null,
    'another event must not be reachable',
  );
});

test('budget proof: the PUBLIC bucket is unreachable from this policy', () => {
  // A bank-transfer screenshot is private. The policy now names the private
  // bucket explicitly, so a public-media ref must NOT satisfy it — the reverse
  // of what this file asserted until 2026-08-07.
  assert.equal(
    parseClientRef(
      `r2://setnayan-media/payment-proof/events/${EVENT}/receipt.jpg`,
      budgetPaymentProofPolicy(EVENT),
    ),
    null,
  );
  assert.equal(
    parseClientRef(`r2://${CONTRACTS}/payment-proof/events/${EVENT}/receipt.jpg`, budgetPaymentProofPolicy(EVENT)),
    null,
  );
});

/* ── SEC-1 lane #1 · private-bucket root binding ────────────────────────────── */

import { privateBucketRootIsAllowed } from './r2-client-ref';

/**
 * EVERY REAL PRIVATE-BUCKET CALL SITE MUST STILL WORK. This half of the test is
 * the more important one: a fail-closed allowlist that refuses a legitimate
 * upload is a worse outcome than the pollution it prevents. Each pair below was
 * read off an actual call site (grepped for `bucket="…"` / `bucket: '…'`), so
 * this fails loudly if a prefix ever moves.
 *
 * ⚠ THIS DOCBLOCK SAID "grepped exhaustively" AND THE LIST WAS NOT EXHAUSTIVE.
 * It missed `payment-proof/events/<id>` (vendor-itemization-card.tsx), whose
 * root was absent from PRIVATE_BUCKET_ROOTS — so every receipt a couple attached
 * to a vendor payment was refused, and this list's silence read as coverage.
 * Adding a row here is not optional when a new private uploader is written.
 */
const REAL_PRIVATE_CALL_SITES: ReadonlyArray<[string, string, string]> = [
  ['setnayan-thread-files', 'events/EVT/disputes/incoming', 'disputes/page.tsx'],
  ['setnayan-thread-files', 'payments/ORDER', 'orders/[orderId]/page.tsx'],
  ['setnayan-thread-files', 'payments/ORDER', 'vendor booking-fees/[orderId]'],
  ['setnayan-thread-files', 'payment-screenshots/inline-checkout/EVT', 'inline-checkout-drawer'],
  ['setnayan-thread-files', 'payment-proof/events/EVT', 'vendor-itemization-card.tsx'],
  ['setnayan-vendor-contracts', 'paperwork/EVT/psa_birth', 'paperwork/page.tsx'],
  ['setnayan-vendor-verification', 'vendors/VP/verification/dti', 'verify + docs-body'],
  ['setnayan-samples', 'refinements/LEAF', 'taxonomy-studio'],
  ['setnayan-samples', 'taxonomy/TILE', 'taxonomy-studio'],
];

for (const [bucket, prefix, where] of REAL_PRIVATE_CALL_SITES) {
  test(`lane #1: the real call site still works — ${where} (${bucket})`, () => {
    assert.equal(
      privateBucketRootIsAllowed(bucket as never, prefix),
      true,
      `${where} would break: "${prefix}" is a LEGITIMATE upload location for ${bucket}`,
    );
  });
}

test('lane #1: the cross-bucket jump is refused', () => {
  // The actual exposure: arbitrary bytes into a private bucket under a prefix
  // belonging to a different flow. `vendors/…/verification/` is read by an admin
  // to approve a business; `thread-files` holds dispute evidence.
  const refused: ReadonlyArray<[string, string]> = [
    ['setnayan-vendor-verification', 'events/EVT/hero'],
    ['setnayan-vendor-verification', 'paperwork/EVT/psa_birth'],
    ['setnayan-vendor-contracts', 'vendors/VP/verification/dti'],
    ['setnayan-vendor-contracts', 'events/EVT/our-photos'],
    ['setnayan-thread-files', 'vendors/VP/portfolio'],
    ['setnayan-thread-files', 'paperwork/EVT/psa_birth'],
    ['setnayan-samples', 'events/EVT/hero'],
    ['setnayan-samples', 'paperwork/EVT/psa_birth'],
  ];
  for (const [bucket, prefix] of refused) {
    assert.equal(
      privateBucketRootIsAllowed(bucket as never, prefix),
      false,
      `${prefix} must not be writable into ${bucket}`,
    );
  }
});

test('lane #1: public media stays permissive — deliberately', () => {
  // Media is public by design and carries a long tail of prefixes; a fail-closed
  // allowlist there would risk breaking a real upload for no confidentiality
  // gain. Pollution there is a cost/abuse concern, tracked separately.
  for (const prefix of [
    'events/EVT/hero',
    'hero-frames/SESSION',
    'living-heroes',
    'editorial-vendor',
    'locked-qr-proof',
    'papic/seat-3',
    'anything-new-we-add-tomorrow',
  ]) {
    assert.equal(privateBucketRootIsAllowed('setnayan-media' as never, prefix), true);
  }
});

test('lane #1: it is CONTAINMENT, not tenancy — and says so', () => {
  // Documented limitation, asserted so nobody mistakes this for an ownership
  // check: another event's paperwork prefix still satisfies the bucket binding.
  // Per-flow tenancy binding is the remaining half of lane #1.
  assert.equal(
    privateBucketRootIsAllowed('setnayan-vendor-contracts' as never, 'paperwork/SOMEONE-ELSE/psa'),
    true,
  );
});

test('lane #1: the ROUTE actually calls the binding — the wiring, not just the rule', () => {
  // Everything above tests the pure predicate. Without this, deleting the call in
  // /api/upload would leave all of it green while the hole reopened — the gap my
  // own mutation probe exposed. Guard the consumer, not just the rule.
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'api', 'upload', 'route.ts'),
    'utf8',
  );
  assert.match(
    src,
    /if \(!privateBucketRootIsAllowed\(bucketName, pathPrefix\)\) \{/,
    'the generic branch must refuse a private bucket whose root segment does not '
      + 'belong to it — and it must be the LIVE guard, not a disabled one',
  );
  // …and it must run on the RESOLVED bucket name, after the shared refusals, so a
  // reordering that checked the raw alias instead cannot slip through.
  assert.ok(
    src.indexOf('const bucketName = R2_BUCKETS[bucketKey];') <
      src.indexOf('privateBucketRootIsAllowed(bucketName, pathPrefix)'),
    'the check must run on the resolved bucketName',
  );
});
