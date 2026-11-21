/**
 * 🔒 A RECEIPT IS READ ONLY FROM THE PAYMENT'S OWN PROOF FOLDER (N5, 2026-09-11).
 *
 * The old server reader fetched whatever bucket/key `payments.screenshot_url`
 * named, with admin R2 credentials, and showed it to a model — so N5 made it
 * refuse anything outside the payment's own folder. Since 17 Nov 2026 (owner:
 * "Yes, swap it in") the SERVER FETCHES NO PICTURE AT ALL to read it: the buyer's
 * phone reads the file they picked, and the admin's phone reads the image their
 * own screen already shows — signed under `paymentProofPolicy`, built from the
 * ORDER row. So the line N5 drew now sits in two places, both pinned here.
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

test('the server fetches no picture to read a receipt', () => {
  for (const f of ['lib/payment-receipt-read.server.ts', 'app/admin/payments/actions.ts']) {
    const s = src(f);
    const body = f.endsWith('actions.ts') ? s.slice(s.indexOf('export async function rereadPaymentReceipt'), s.indexOf('\nexport ', s.indexOf('export async function rereadPaymentReceipt') + 1)) : s;
    assert.doesNotMatch(body, /r2GetBytes\(|parseStoredAsset\(/, `${f} fetches the picture on the server again`);
  }
});

test('the admin re-read reads only the image the admin screen signed under the payment’s own policy', () => {
  const page = src('app/admin/payments/page.tsx');
  assert.match(page, /paymentProofPolicy\(\{ orderId: p\.order_id, eventId: p\.order\?\.event_id \?\? null, userId: p\.user_id \}\)/);
  const desk = src('app/admin/payments/_components/desk.tsx');
  assert.match(desk, /imageUrl=\{screenshotUrlMap\[p\.payment_id\] \?\? null\}/, 'the re-read reads something other than the signed proof');
});

test('the pay action admits a ref only under the order’s own folder', () => {
  const pay = src('app/pay/[reference]/actions.ts');
  assert.match(pay, /parseClientRef\(refRaw\.trim\(\), orderPaymentProofPolicy\(payable\.orderId\)\)/);
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
  assert.ok(parseClientRef(admitted[0], orderPaymentProofPolicy(order)));
  assert.equal(parseClientRef(admitted[1], orderPaymentProofPolicy(order)), null);
});
