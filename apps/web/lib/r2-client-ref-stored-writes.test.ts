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

/* ── budget proof · public bucket ───────────────────────────────────────────── */

test('budget proof: this event is accepted, another event is not', () => {
  const policy = budgetPaymentProofPolicy(EVENT);
  assert.ok(parseClientRef(`r2://setnayan-media/budget/${EVENT}/receipt.jpg`, policy));
  assert.equal(parseClientRef(`r2://setnayan-media/budget/${OTHER}/receipt.jpg`, policy), null);
});

test('budget proof: a PRIVATE bucket is unreachable from the public-media policy', () => {
  // The policy omits `bucket`, so it defaults to public media. A private-bucket
  // ref must not satisfy it even under an allowed-looking prefix.
  assert.equal(
    parseClientRef(`r2://${CONTRACTS}/budget/${EVENT}/receipt.jpg`, budgetPaymentProofPolicy(EVENT)),
    null,
  );
});
