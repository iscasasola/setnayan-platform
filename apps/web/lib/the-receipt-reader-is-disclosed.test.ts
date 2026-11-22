/**
 * Guard: the public notice says what we ACTUALLY do with a payment receipt.
 *
 * Until 2026-11-17 the buyer's screenshot was shown to Anthropic to be
 * transcribed, and this file held the notice to saying so (RA 10173: what
 * matters is not only WHO receives data but WHAT they receive). The owner then
 * ruled: *"can we create our own in app reader so we do not need ai to run?"* →
 * *"Yes, swap it in"*. The receipt is now read on the payer's own phone
 * (lib/on-phone-reader.ts), so the notice must stop claiming the opposite —
 * and must not drift back into claiming it while the code says otherwise.
 *
 * 🔑 KEYED ON THE CODE, IN BOTH DIRECTIONS. If a receipt path ever calls a
 * model again, the first test fails and points at the notice that must change
 * with it. ⚠ The notice is a statement by the registered DPO (the owner): its
 * wording changed in the SAME commit as the code, flagged for owner sign-off.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB = dirname(fileURLToPath(import.meta.url));
const WEB = join(LIB, '..');
const PRIVACY = join(WEB, 'app/(shell)/privacy/page.tsx');
const RECORD = join(LIB, 'subprocessors.ts');
const RECEIPT_CODE = [
  'lib/payment-receipt-read.server.ts',
  'lib/payment-receipt-read.ts',
  'app/pay/[reference]/actions.ts',
  'app/dashboard/[eventId]/checkout/actions.ts',
];

test('no receipt path sends a picture to a model — the premise of the notice below', () => {
  for (const f of RECEIPT_CODE) {
    const src = readFileSync(join(WEB, f), 'utf8');
    assert.doesNotMatch(
      src,
      /new Anthropic\(|@anthropic-ai\/sdk/,
      `${f} sends receipts to a model again — the privacy notice must say so before this ships`,
    );
  }
});

test('the public notice says the receipt is read on the payer’s phone, not by an AI company', () => {
  const src = readFileSync(PRIVACY, 'utf8');
  const start = src.indexOf('Reading your payment receipt');
  assert.notEqual(start, -1, 'the receipt section is gone from the public notice');
  const section = src.slice(start, src.indexOf('</Section>', start));
  assert.match(section, /your own phone reads it/);
  assert.match(section, /not sent to any AI/);
  assert.doesNotMatch(section, /Anthropic/, 'the notice still says receipts go to Anthropic');
  assert.match(section, /bank document/);
  assert.match(section, /Lawful basis/);
});

test('neither the public list nor the record gives Anthropic a receipt role', () => {
  const src = readFileSync(PRIVACY, 'utf8');
  const at = src.indexOf('Anthropic (AI features');
  assert.notEqual(at, -1, 'the Anthropic subprocessor entry moved — re-point this guard');
  const entry = src.slice(at, src.indexOf('</li>', at));
  assert.doesNotMatch(entry, /so we can check the\s+reference/, 'the public list still describes reading receipts');
  const line = readFileSync(RECORD, 'utf8').split('\n').find((l) => l.includes("name: 'Anthropic'"));
  assert.ok(line, 'Anthropic is not in the compliance record at all');
  assert.match(line, /receipts are NOT sent/);
});

test('the transcript claim is true — the insert stores no transcript', () => {
  const server = readFileSync(join(LIB, 'payment-receipt-read.server.ts'), 'utf8');
  const at = server.indexOf(".from('payment_receipt_reads').insert(");
  assert.notEqual(at, -1, 'the receipt-read insert moved — re-point this guard');
  const payload = server.slice(at, server.indexOf('});', at));
  assert.doesNotMatch(payload, /transcript|receipt_text|\.text\b/i, 'the read text is being stored — the notice says it is not kept');
  for (const col of ['seen_references', 'seen_amounts', 'seen_paid_on', 'seen_paid_time', 'summary']) {
    assert.match(payload, new RegExp(col), `the notice describes storing ${col} and the insert does not`);
  }
});
