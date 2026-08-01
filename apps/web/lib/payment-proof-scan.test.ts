/**
 * Unit suite for the payment-proof scanner (2026-07-31).
 *
 * The fixtures are transcriptions of REAL receipts captured during the live
 * ₱1.43 and ₱2.17 transfers — GCash Express Send, GCash bank transfer, the
 * GCash recipient view, and the BDO recipient view. If GCash or BDO change a
 * layout, these fail in CI rather than silently pre-filling a couple's
 * checkout with the wrong number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanPaymentProof, preferredReference, referencesAgree } from './payment-proof-scan';

// GCash → GCash, payer's confirmation. Note the GROUPED reference.
const GCASH_EXPRESS_SEND = `
Express Send
IN......O I. C.
+63 9....7163
Sent via GCash
Amount                    1.43
Total Amount Sent      P1.43
Ref No. 0043 457 367694
Jul 31, 2026 12:42 PM
`;

// GCash → GCash, RECIPIENT's transaction details.
const GCASH_RECEIVED = `
Transaction Details
Transfer from 0930175**** to 0917880****
Amount                   +1.43
Date & Time    Jul 31, 2026 12:42PM
Reference Number    0043457367694
`;

// GCash → BDO over InstaPay, payer's confirmation. Carries BOTH an InstaPay
// invoice number AND a GCash "Ref No." that appears nowhere on our side.
const GCASH_BANK_TRANSFER = `
Bank Transfer Confirmation
Sent via GCash
Bank                BDO Unibank, Inc.
Account No.         ........7965
Account Name        BDO
Transfer Method     InstaPay
Receipt sent to     someone@example.com
Transfer Amount     2.17
+Fee                10.00
Total            P 12.17
Date          Jul 31, 2026 03:00 PM
InstaPay Invoice No.    6991560
Ref No.                 4043462102549
`;

// BDO recipient view — its reference EMBEDS the InstaPay invoice number.
const BDO_RECEIVED = `
Received from Other Bank
+ PHP 2.17
Jul 31, 2026
Reference number
GXCHPHM2XXXB000000006991560
`;

test('GCash express send — grouped reference is normalised', () => {
  const s = scanPaymentProof(GCASH_EXPRESS_SEND, 1.43);
  assert.equal(preferredReference(s, 'gcash')?.value, '0043457367694');
  assert.equal(s.matchesExpected, true);
});

test('payer and recipient produce the SAME reference on the GCash rail', () => {
  const payer = preferredReference(scanPaymentProof(GCASH_EXPRESS_SEND), 'gcash');
  const recip = preferredReference(scanPaymentProof(GCASH_RECEIVED), 'gcash');
  assert.equal(payer?.value, recip?.value, 'same-rail references must match');
  assert.equal(payer?.value, '0043457367694');
});

test('BDO rail prefers the InstaPay invoice, NOT the decoy Ref No.', () => {
  const s = scanPaymentProof(GCASH_BANK_TRANSFER, 2.17);
  const picked = preferredReference(s, 'bdo');
  assert.equal(picked?.kind, 'instapay_invoice');
  assert.equal(picked?.value, '6991560', 'the GCash Ref No. is useless to us here');
  // Both are still surfaced — we tag, we do not discard.
  assert.ok(s.references.some((r) => r.value === '4043462102549'));
});

test('the InstaPay invoice is what actually links to our BDO record', () => {
  const payer = preferredReference(scanPaymentProof(GCASH_BANK_TRANSFER), 'bdo');
  const ours = preferredReference(scanPaymentProof(BDO_RECEIVED), 'bdo');
  assert.ok(payer && ours);
  assert.ok(
    ours!.value.endsWith(payer!.value),
    `our BDO ref ${ours!.value} should end with the payer's invoice ${payer!.value}`,
  );
});

test('the fee is NOT mistaken for the payment — 2.17 matches, not 12.17', () => {
  const s = scanPaymentProof(GCASH_BANK_TRANSFER, 2.17);
  assert.equal(s.matchesExpected, true, 'transfer amount is present');
  assert.ok(s.amounts.includes(12.17), 'the total is captured too');
  assert.ok(s.amounts.includes(10), 'and the fee');
});

test('centavos compare exactly — the whole matching key depends on it', () => {
  const s = scanPaymentProof('Total P 2,999.43', 2999.43);
  assert.equal(s.matchesExpected, true);
  assert.equal(scanPaymentProof('Total P 2,999.43', 2999.44).matchesExpected, false);
});

test('an UNREADABLE receipt is null, never false', () => {
  // The distinction is the point: "could not read" must not render as
  // "wrong amount" and frighten a couple who paid correctly.
  const s = scanPaymentProof('..... blurry nonsense .....', 2999);
  assert.equal(s.matchesExpected, null);
  assert.deepEqual(s.amounts, []);
});

test('a genuinely wrong amount IS false', () => {
  const s = scanPaymentProof('Transfer Amount 999.00', 2999);
  assert.equal(s.matchesExpected, false);
});

test('dates and times are not read as money', () => {
  const s = scanPaymentProof('Date Jul 31, 2026 03:00 PM');
  assert.deepEqual(s.amounts, [], 'no decimals-with-two-places in a date/time');
});

test('prose is not mistaken for a reference', () => {
  const s = scanPaymentProof('Sent via GCash\nReference number\nnot available');
  assert.deepEqual(s.references, []);
});

test('scanning empty text is safe', () => {
  const s = scanPaymentProof('', 100);
  assert.deepEqual(s.references, []);
  assert.equal(s.matchesExpected, null);
  assert.equal(preferredReference(s, 'gcash'), null);
});

// ── referencesAgree — the couple's claim vs the admin's bank app ────────────

test('same-rail GCash references agree by equality', () => {
  assert.equal(referencesAgree('0043457367694', '0043457367694'), true);
  assert.equal(referencesAgree('0043 457 367694', '0043457367694'), true, 'grouping ignored');
});

test('cross-rail agrees by TAIL — our BDO ref embeds their InstaPay invoice', () => {
  const theirs = '6991560';
  const ours = 'GXCHPHM2XXXB000000006991560';
  assert.equal(referencesAgree(theirs, ours), true, 'endsWith is the rule that works');
  assert.equal(referencesAgree(ours, theirs), true, 'order must not matter');
});

test('unrelated references do NOT agree', () => {
  assert.equal(referencesAgree('0043457367694', '4043462102549'), false);
  assert.equal(referencesAgree('6991560', 'GXCHPHM2XXXB000000001234567'), false);
});

test('short tokens never agree — too loose to surface as a match', () => {
  assert.equal(referencesAgree('7694', 'GXCHPHM2XXXB000000007694'), false);
  assert.equal(referencesAgree('', 'GXCHPHM2XXXB000000006991560'), false);
});

test('end to end: a couple\'s submitted ref matches the admin\'s pasted BDO alert', () => {
  const submitted = preferredReference(scanPaymentProof(GCASH_BANK_TRANSFER), 'bdo')!.value;
  const pasted = scanPaymentProof(BDO_RECEIVED).references;
  assert.ok(
    pasted.some((r) => referencesAgree(submitted, r.value)),
    'the InstaPay invoice the couple gives us must match our own BDO record',
  );
});

test('end to end: the DECOY GCash Ref No. must NOT match our BDO record', () => {
  // If a couple pastes the wrong number off the same receipt, we must not
  // claim a match — a false green here approves money that never arrived.
  const decoy = '4043462102549';
  const pasted = scanPaymentProof(BDO_RECEIVED).references;
  assert.ok(!pasted.some((r) => referencesAgree(decoy, r.value)));
});
