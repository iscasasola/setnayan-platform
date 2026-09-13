/**
 * 🔒 THE RECEIPT READER OPENS ONLY THE PAYMENT'S OWN PROOF FOLDER (N5, 2026-09-11
 * · found by N4 in #5432).
 *
 * `readPaymentReceiptFromR2` fetched the bytes of whatever bucket and key
 * `payments.screenshot_url` named — with the admin R2 credentials — and showed
 * them to a model whose summary lands on the admin's screen. A ref naming a
 * shop's government ID in `setnayan-vendor-verification` would have been read
 * like any receipt.
 *
 * What N5 measured before changing it: the column's WRITERS all bind the ref to
 * the order's own folder already, and a buyer's session cannot rewrite it (no
 * UPDATE policy on `payments`, INSERT not granted — pinned by
 * tests/db/a-buyer-cannot-repoint-a-payment-screenshot.db.test.ts). So nothing
 * reachable was open; this makes the READER hold the same line itself, so a
 * future writer that forgets its gate cannot turn it into an oracle.
 *
 * Pinned: the reader refuses anything its caller's policy does not admit, BEFORE
 * any bytes are fetched; both callers pass the payment's own policy, built from
 * the ORDER row; and that policy admits every folder production actually holds
 * while refusing a neighbour's.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { parseClientRef, paymentProofPolicy, orderPaymentProofPolicy } from '@/lib/r2-client-ref';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function fnBody(s: string, name: string): string {
  const start = s.search(new RegExp(`export async function ${name}\\(`));
  assert.ok(start >= 0, `${name} is gone`);
  const next = s.slice(start + 1).search(/\nexport /);
  return next < 0 ? s.slice(start) : s.slice(start, start + 1 + next);
}

const READER = 'lib/payment-receipt-read.server.ts';

test('the reader checks the payment’s own policy BEFORE it fetches a single byte', () => {
  const body = fnBody(src(READER), 'readPaymentReceiptFromR2');
  const check = body.indexOf('const asset = parseClientRef(args.screenshotRef, args.proofPolicy);');
  const refuse = body.indexOf('if (!asset) return null;');
  const fetch = body.indexOf('r2GetBytes(');
  assert.ok(check > 0, 'the reader no longer checks the ref against its caller’s policy');
  assert.ok(refuse > check, 'a refused ref is not stopped');
  assert.ok(fetch > refuse, 'the bytes are fetched before (or without) the policy check');
  assert.match(body, /r2GetBytes\(\{ bucket: asset\.bucket, key: asset\.key \}\)/, 'it fetches something other than what the policy approved');
  assert.doesNotMatch(src(READER), /\bparseStoredAsset\(/, 'the forgiving any-bucket parser is back in the reader');
  assert.match(body, /proofPolicy: ClientRefPolicy;/, 'the policy became optional');
});

test('the admin re-read passes its policy through to the reader', () => {
  const run = fnBody(src(READER), 'runPaymentReceiptRead');
  assert.match(run, /proofPolicy: args\.proofPolicy,/);
});

test('both callers name the payment’s OWN folders, from the order — never from the value', () => {
  const pay = src('app/pay/[reference]/actions.ts');
  assert.match(pay, /readPaymentReceiptFromR2\(\{\s*screenshotRef: screenshotUrl,\s*proofPolicy: orderPaymentProofPolicy\(payable\.orderId\),/);
  // …the same policy the ref was admitted under a few lines above.
  assert.match(pay, /parseClientRef\(refRaw\.trim\(\), orderPaymentProofPolicy\(payable\.orderId\)\)/);

  const admin = src('app/admin/payments/actions.ts');
  assert.match(
    admin,
    /const proofPolicy = paymentProofPolicy\(\{ orderId: row\.order_id, eventId: orderEventId, userId: row\.user_id \}\);/,
  );
  assert.match(admin, /runPaymentReceiptRead\(\{\s*admin,\s*paymentId,\s*screenshotRef: row\.screenshot_url,\s*proofPolicy,/);
  assert.match(admin, /\.from\('orders'\)\s*\.select\('event_id'\)\s*\.eq\('order_id', row\.order_id\)/, 'the event id must come from the order row');
});

test('the payment policy admits every folder production holds, and refuses a neighbour’s', () => {
  const order = '5b0f6a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const event = '7c1e2d3f-4a5b-4c6d-9e8f-0a1b2c3d4e5f';
  const user = '2e3f4a5b-6c7d-4e8f-9a0b-1c2d3e4f5a6b';
  const policy = paymentProofPolicy({ orderId: order, eventId: event, userId: user });
  const admitted = [
    `r2://setnayan-thread-files/payments/${order}/0b6c-guest-proof.jpg`,
    `r2://setnayan-thread-files/payment-screenshots/inline-checkout/${event}/0b6c-gcash.png`,
    `r2://setnayan-thread-files/payment-screenshots/inline-checkout/${user}/0b6c-gcash.png`,
  ];
  for (const v of admitted) assert.ok(parseClientRef(v, policy), `refused a real proof folder: ${v}`);
  const refused = [
    `r2://setnayan-vendor-verification/vendors/${order}/verification/id.jpg`,
    `r2://setnayan-thread-files/payments/${event}/0b6c.jpg`,
    `r2://setnayan-thread-files/chat/${order}/${user}/contract.pdf`,
    `r2://setnayan-thread-files/payment-proof/events/${event}/deposit/x.jpg`,
    `r2://setnayan-media/payments/${order}/x.jpg`,
    `https://media.setnayan.com/payments/${order}/x.jpg`,
  ];
  for (const v of refused) assert.equal(parseClientRef(v, policy), null, `admitted ${v}`);
  // The pay action's narrower policy is a subset.
  assert.ok(parseClientRef(admitted[0], orderPaymentProofPolicy(order)));
  assert.equal(parseClientRef(admitted[1], orderPaymentProofPolicy(order)), null);
  console.log(`# payment proof policy: ${admitted.length} admitted, ${refused.length} refused`);
});
