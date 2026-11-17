/**
 * 🔒 THE BUYER'S RECEIPT IS READ ON THEIR PHONE — no outside AI (owner 17 Nov
 * 2026: *"can we create our own in app reader so we do not need ai to run?"* →
 * *"Yes, swap it in"*).
 *
 * The fixtures below are the REAL OUTPUT of the pinned on-phone reader
 * (tesseract.js 7.0.0, eng 4.0.0_best_int — lib/on-phone-reader.ts) on six
 * DRAWN receipt screens: two BDO app, two InstaPay into BDO, two QR Ph — each
 * as a full-size phone screenshot (390 pt @3x, PNG) and as a small compressed
 * copy (390 pt @1x, JPEG q55). Every name and number on them is invented; no
 * customer's data is here. The OCR mistakes are kept verbatim ("_gill",
 * "Fick kkik", "BD0…") because they are the point.
 *
 * Measured 2026-11-17 in Chromium, CPU throttled 4× (Lighthouse mid-tier
 * mobile): 46 of 48 fields right. The two misses are ONE reference that
 * Tesseract itself reads wrong (the letter O beside zeros) — the buyer sees the
 * field and can fix it, and the admin's card says they did.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  RECEIPT_FIELDS,
  confirmedFromForm,
  loggedFromPhone,
  phoneReceiptRead,
  prefillFromReceipt,
  shouldAskBuyerToFix,
} from './payment-receipt-read';
import { extractReceiptPaidAt } from './payment-proof-scan';
import { stripComments } from './strip-comments';

const WEB = join(process.cwd(), process.cwd().endsWith('apps/web') ? '' : 'apps/web');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const code = (rel: string) => stripComments(read(rel));

type Fixture = {
  file: string;
  shape: 'BDO' | 'InstaPay' | 'QR Ph';
  owed: number;
  want: { amountPhp: number; paidOn: string; paidTime: string; reference: string };
  text: string;
};

const SAMPLES: Fixture[] = [
  {
    "file": "bdo-app-1.png",
    "shape": "BDO",
    "owed": 2499,
    "want": {
      "amountPhp": 2499,
      "paidOn": "2026-11-17",
      "paidTime": "15:04",
      "reference": "612345678901"
    },
    "text": "9:41 _gill 82%\n\nv Transaction Successful\nSend Money\nAmount PHP 2,499.00\nTransfer to SETNAYAN TEST ACCT\nAccount No. Fick kkik 4821\nReference Number 6123 4567 8901\nDate 17 Nov 2026 15:04:22\n\nScreenshot for your records\n"
  },
  {
    "file": "bdo-app-1.small.jpg",
    "shape": "BDO",
    "owed": 2499,
    "want": {
      "amountPhp": 2499,
      "paidOn": "2026-11-17",
      "paidTime": "15:04",
      "reference": "612345678901"
    },
    "text": "941 amen\n\nv Transaction Successful\nSend Money\n‘Amount PHP 2,499.00\nTransfer to SETNAYAN TEST ACCT\nAccount No. en 4821\nReference Number 6123 4567 8901\nDate 17 Nov 2026 15:04:22\n\nSeeenshot for your records\n"
  },
  {
    "file": "bdo-app-2.png",
    "shape": "BDO",
    "owed": 147,
    "want": {
      "amountPhp": 147,
      "paidOn": "2026-11-18",
      "paidTime": "09:47",
      "reference": "BDO0098812345"
    },
    "text": "9:41 _gill 82%\n\nv Fund Transfer\nStatus Successful\nTransfer Amount PHP 147.00\nService Fee PHP 0.00\nRef. No. BD00098812345\nTransaction Date 11/18/2026 09:47 AM\n\nScreenshot for your records\n"
  },
  {
    "file": "bdo-app-2.small.jpg",
    "shape": "BDO",
    "owed": 147,
    "want": {
      "amountPhp": 147,
      "paidOn": "2026-11-18",
      "paidTime": "09:47",
      "reference": "BDO0098812345"
    },
    "text": "941 a8\n\nv Fund Transfer\nStatus Successful\nTransfer Amount PHP 147.00\nService Fee PHP 0.00\nRef. No. BDO00098812345\nTransaction Date 11/18/2026 09:47 AM\n\nScreenshot for your records\n"
  },
  {
    "file": "instapay-bank.png",
    "shape": "InstaPay",
    "owed": 5000,
    "want": {
      "amountPhp": 5000,
      "paidOn": "2026-11-17",
      "paidTime": "21:15",
      "reference": "8812004"
    },
    "text": "9:41 _gill 82%\n\nv Transfer Complete\nTo BDO Unibank - ****4821\nAmount PHP 5,000.00\nFee PHP 15.00\nInstaPay Invoice No. 8812004\nReference No. UB2026111700774\nDate & Time 2026-11-17 21:15\n\nScreenshot for your records\n"
  },
  {
    "file": "instapay-bank.small.jpg",
    "shape": "InstaPay",
    "owed": 5000,
    "want": {
      "amountPhp": 5000,
      "paidOn": "2026-11-17",
      "paidTime": "21:15",
      "reference": "8812004"
    },
    "text": "941 _gmen\n\n+ Transfer Complete\nTo BDO Unibank - **4821\n‘Amount PHP 5,000.00\nFee PHP 15.00\nInstaPay Invoice No. 8812004\nReference No. UB2026111700774\nDate & Time 2026-11-17 21:15\n\nScreenshot for your records.\n"
  },
  {
    "file": "instapay-gcash.png",
    "shape": "InstaPay",
    "owed": 1499,
    "want": {
      "amountPhp": 1499,
      "paidOn": "2026-11-17",
      "paidTime": "15:04",
      "reference": "6991560"
    },
    "text": "9:41 _gill 82%\nv Sent via InstaPay\nAmount 1,499.00\nBank BDO Unibank, Inc.\nAccount Name Skike Pickickk\nInstaPay Invoice No. 6991560\nRef No. 0043 457 367694\nNov 17, 2026 3:04 PM\nScreenshot for your records\n"
  },
  {
    "file": "instapay-gcash.small.jpg",
    "shape": "InstaPay",
    "owed": 1499,
    "want": {
      "amountPhp": 1499,
      "paidOn": "2026-11-17",
      "paidTime": "15:04",
      "reference": "6991560"
    },
    "text": "941 _gmen\nv Sent via InstaPay\nAmount 1,499.00\nBank BDO Unibank, Inc.\nAccount Name PA pa\nInstaPay Invoice No. 6991560\nRef No. 0043 457 367694\nNov 17, 2026 3:04 PM\nScreenshot for your records.\n"
  },
  {
    "file": "qrph-bank.png",
    "shape": "QR Ph",
    "owed": 12000,
    "want": {
      "amountPhp": 12000,
      "paidOn": "2026-11-18",
      "paidTime": "07:02",
      "reference": "QRPH261117120045"
    },
    "text": "9:41 gill 82%\n\nv QR Ph Payment\nPay to SETNAYAN\nTotal PHP 12,000.00\nTrace No. 004512\nReference No. QRPH 2611 1712 0045\nPaid on 18 Nov 2026 07:02\n\nScreenshot for your records\n"
  },
  {
    "file": "qrph-bank.small.jpg",
    "shape": "QR Ph",
    "owed": 12000,
    "want": {
      "amountPhp": 12000,
      "paidOn": "2026-11-18",
      "paidTime": "07:02",
      "reference": "QRPH261117120045"
    },
    "text": "941 pmo\n\n+ QR Ph Payment\nPay to SETNAYAN\nTotal PHP 12,000.00\nTrace No. 004512\nReference No. QRPH 2611 1712 0045\nPaid on 18 Nov 2026 07:02\n\nScreenshot for your records\n"
  },
  {
    "file": "qrph-wallet.png",
    "shape": "QR Ph",
    "owed": 899,
    "want": {
      "amountPhp": 899,
      "paidOn": "2026-11-17",
      "paidTime": "20:15",
      "reference": "7712093"
    },
    "text": "9:41 lll 82%\nv Payment Successful\nPaid via QR Ph\nMerchant SETNAYAN\nAmount PHP 899.00\nInstaPay Invoice No. 7712093\nReference ID 2026111700001234567\nNov 17, 2026, 08:15 PM\nScreenshot for your records\n"
  },
  {
    "file": "qrph-wallet.small.jpg",
    "shape": "QR Ph",
    "owed": 899,
    "want": {
      "amountPhp": 899,
      "paidOn": "2026-11-17",
      "paidTime": "20:15",
      "reference": "7712093"
    },
    "text": "941 pmo\nv Payment Successful\nPaid via QR Ph\nMerchant SETNAYAN\n‘Amount PHP 899.00\nInstaPay Invoice No. 7712093\nReference ID 2026111700001234567\nNov 17, 2026, 08:15 PM\nSeeenshot for your records\n"
  }
];

/** Known misses, by file and field — Tesseract reads "BDO00…" as "BD000…". */
const KNOWN_MISSES = new Set(['bdo-app-2.png reference', 'bdo-app-2.small.jpg reference']);

test('the on-phone read fills amount, date, time and reference on BDO, InstaPay and QR Ph receipts', () => {
  let right = 0;
  let total = 0;
  const misses: string[] = [];
  for (const s of SAMPLES) {
    const got = prefillFromReceipt({ transcript: s.text, expectedPhp: s.owed, channel: 'bdo' });
    for (const k of ['amountPhp', 'paidOn', 'paidTime', 'reference'] as const) {
      total++;
      if (got[k] === s.want[k]) right++;
      else misses.push(`${s.file} ${k === 'amountPhp' ? 'amount' : k}`);
    }
  }
  console.log(`# on-phone receipt read: ${right}/${total} fields right on ${SAMPLES.length} drawn screenshots`);
  assert.deepEqual(misses.sort(), [...KNOWN_MISSES].sort(), 'the reader now gets a different set of fields wrong');
  for (const shape of ['BDO', 'InstaPay', 'QR Ph']) {
    assert.ok(SAMPLES.filter((s) => s.shape === shape).length >= 2, `fewer than two ${shape} samples`);
  }
});

test('the phone’s status-bar clock is not the time of the payment', () => {
  // Every full-size screenshot starts with "9:41" — the clock in the status bar.
  assert.deepEqual(extractReceiptPaidAt('9:41 _gill 82%\nNov 17, 2026, 08:15 PM'), { date: '2026-11-17', time: '20:15' });
  assert.deepEqual(extractReceiptPaidAt('9:41\nDate 17 Nov 2026\nTime 15:04'), { date: '2026-11-17', time: '15:04' });
  // No date read: the first time is all we have, as before.
  assert.deepEqual(extractReceiptPaidAt('Paid 15:04'), { date: null, time: '15:04' });
});

test('the amount is never a guess: the owed figure when it is there, else the only one, else nothing', () => {
  const two = 'Amount PHP 1,000.00\nFee PHP 15.00\nNov 17, 2026 3:04 PM';
  assert.equal(prefillFromReceipt({ transcript: two, expectedPhp: 1000 }).amountPhp, 1000);
  assert.equal(prefillFromReceipt({ transcript: two, expectedPhp: 999 }).amountPhp, null, 'picked one of two figures');
  assert.equal(prefillFromReceipt({ transcript: 'Amount PHP 750.00', expectedPhp: 999 }).amountPhp, 750);
  assert.deepEqual(prefillFromReceipt({ transcript: '', expectedPhp: 1 }), { amountPhp: null, paidOn: null, paidTime: null, reference: null });
});

function form(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const GCASH = SAMPLES.find((s) => s.file === 'instapay-gcash.png')!;

test('a reader that never ran is NOTHING; one that failed is drawn as a failure', () => {
  assert.equal(phoneReceiptRead({ form: form({}), typed: null, expectedPhp: 1499 }), null);
  const failed = phoneReceiptRead({ form: form({ [RECEIPT_FIELDS.status]: 'failed' }), typed: null, expectedPhp: 1499 });
  assert.equal(failed?.status, 'failed');
  assert.match(failed!.summary, /could not run/);
  // …and neither ever sends a payer back.
  assert.equal(shouldAskBuyerToFix(failed), false);
});

test('the server parses the posted text itself, and says what the payer corrected', () => {
  const untouched = phoneReceiptRead({
    form: form({ [RECEIPT_FIELDS.status]: 'ok', [RECEIPT_FIELDS.text]: GCASH.text, [RECEIPT_FIELDS.reference]: '6991560' }),
    typed: null,
    expectedPhp: 1499,
  })!;
  assert.equal(untouched.readReference, '6991560');
  assert.equal(untouched.amountMatches, true);
  assert.doesNotMatch(untouched.summary, /corrected/);

  const fixed = phoneReceiptRead({
    form: form({
      [RECEIPT_FIELDS.status]: 'ok',
      [RECEIPT_FIELDS.text]: GCASH.text,
      [RECEIPT_FIELDS.reference]: '6991561',
      [RECEIPT_FIELDS.amount]: '1500',
      [RECEIPT_FIELDS.touched]: 'reference,amount',
    }),
    typed: null,
    expectedPhp: 1499,
  })!;
  assert.match(fixed.summary, /They corrected the reference to 6991561, the amount to ₱1,500\.00\./);
  // The closing warning stays last.
  assert.match(fixed.summary, /Still check your bank app — a screenshot is not proof the money arrived\.$/);
  // What the reader SAW is unchanged — a correction never rewrites the read.
  assert.deepEqual(fixed.seenAmounts, untouched.seenAmounts);
});

test('an untouched pre-filled field is not a correction (whole-peso amount box)', () => {
  const r = phoneReceiptRead({
    form: form({ [RECEIPT_FIELDS.status]: 'ok', [RECEIPT_FIELDS.text]: 'Amount PHP 2,499.50\nRef No. 0043457367694', [RECEIPT_FIELDS.amount]: '2499' }),
    typed: null,
    expectedPhp: 2499.5,
  })!;
  assert.doesNotMatch(r.summary, /corrected/);
});

test('what is LOGGED: a corrected field wins, else what was read', () => {
  const posted = { [RECEIPT_FIELDS.status]: 'ok', [RECEIPT_FIELDS.text]: GCASH.text };
  const r1 = phoneReceiptRead({ form: form(posted), typed: null, expectedPhp: 1499 });
  assert.deepEqual(loggedFromPhone(form(posted), r1), { reference: '6991560', paidOn: '2026-11-17' });
  const corrected = { ...posted, [RECEIPT_FIELDS.reference]: 'abc-123 456', [RECEIPT_FIELDS.paidOn]: '2026-11-16', [RECEIPT_FIELDS.touched]: 'reference,paidOn' };
  assert.deepEqual(loggedFromPhone(form(corrected), r1), { reference: 'ABC123456', paidOn: '2026-11-16' });
  // A failed read leaves only what the payer typed.
  const typedOnly = { [RECEIPT_FIELDS.status]: 'failed', [RECEIPT_FIELDS.reference]: '7712093', [RECEIPT_FIELDS.touched]: 'reference' };
  assert.deepEqual(loggedFromPhone(form(typedOnly), null), { reference: '7712093', paidOn: null });
});

test('malformed fields are dropped, never coerced', () => {
  const c = confirmedFromForm(
    form({
      [RECEIPT_FIELDS.amount]: '12abc',
      [RECEIPT_FIELDS.paidOn]: '2026-02-31',
      [RECEIPT_FIELDS.paidTime]: '25:00',
      [RECEIPT_FIELDS.reference]: '  ',
    }),
  );
  assert.deepEqual(c, { amountPhp: null, paidOn: null, paidTime: null, reference: null });
  assert.deepEqual(
    confirmedFromForm(form({ [RECEIPT_FIELDS.amount]: '₱1,499.00', [RECEIPT_FIELDS.paidOn]: '2026-11-17', [RECEIPT_FIELDS.paidTime]: '15:04' })),
    { amountPhp: 1499, paidOn: '2026-11-17', paidTime: '15:04', reference: null },
  );
});

/* ── The outside AI call is GONE, and stays gone ───────────────────────────── */

const RECEIPT_SEAM = [
  'lib/payment-receipt-read.ts',
  'lib/payment-receipt-read.server.ts',
  'lib/receipt-read-on-phone.ts',
  'lib/on-phone-reader.ts',
  'app/pay/[reference]/actions.ts',
  'app/dashboard/[eventId]/checkout/actions.ts',
  'app/admin/payments/actions.ts',
  'app/_components/payment/receipt-read-fields.tsx',
  'app/admin/payments/_components/reread-on-this-phone.tsx',
] as const;

test('no receipt path talks to an outside model', () => {
  for (const f of RECEIPT_SEAM) {
    const src = code(f);
    assert.doesNotMatch(src, /@anthropic-ai\/sdk|new Anthropic\(|messages\.create\(/, `${f} calls an outside model again`);
    assert.doesNotMatch(src, /readPaymentReceiptFromR2|runPaymentReceiptRead/, `${f} brought back the model seam`);
  }
  // The server no longer fetches the picture to read it.
  assert.doesNotMatch(code('lib/payment-receipt-read.server.ts'), /r2GetBytes|sharp/);
});

test('the reader is the shared one, and it is lazy everywhere', () => {
  // ONE place names the engine and its pinned versions.
  const reader = read('lib/on-phone-reader.ts');
  assert.match(reader, /tesseract\.js@7\.0\.0\/dist\/worker\.min\.js/);
  assert.match(reader, /tesseract\.js-core@7\.0\.0/);
  assert.match(reader, /@tesseract\.js-data\/eng@1\.0\.0\/4\.0\.0_best_int/);
  for (const f of ['app/admin/payments/_components/received-drop-tile.tsx', 'app/_components/payment/receipt-read-fields.tsx', 'app/admin/payments/_components/reread-on-this-phone.tsx']) {
    assert.doesNotMatch(code(f), /cdn\.jsdelivr\.net|createWorker\(/, `${f} forked the reader`);
  }
  // No STATIC import of the engine, or of the modules that load it, from a page.
  for (const f of ['app/_components/payment/receipt-read-fields.tsx', 'app/pay/[reference]/_components/pay-panel.tsx', 'app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx', 'app/admin/payments/_components/reread-on-this-phone.tsx', 'app/admin/payments/_components/received-drop-tile.tsx', 'lib/on-phone-reader.ts', 'lib/receipt-read-on-phone.ts']) {
    assert.doesNotMatch(code(f), /^import[^;]*from ['"]tesseract\.js['"]/m, `${f} imports tesseract.js statically`);
    assert.doesNotMatch(code(f), /^import[^;]*from ['"]@\/lib\/receipt-read-on-phone['"]/m, `${f} pulls the reader into its bundle`);
  }
  assert.doesNotMatch(code('app/_components/payment/receipt-read-fields.tsx'), /^import[^;]*from ['"]@\/lib\/on-phone-reader['"]/m);
});

test('both buyer forms mount the read-and-correct fields', () => {
  assert.match(code('app/pay/[reference]/_components/pay-panel.tsx'), /<ReceiptReadFields file=\{picked\} expectedPhp=\{amountPhp\} channel=\{channel\} \/>/);
  assert.match(code('app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx'), /<ReceiptReadFields file=\{receiptFile\} expectedPhp=\{finalGrossPhp\} channel=\{channel\} \/>/);
});
