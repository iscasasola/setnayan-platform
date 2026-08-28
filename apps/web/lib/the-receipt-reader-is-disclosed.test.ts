/**
 * Guard: we cannot show a bank receipt to a model without saying so in public.
 *
 * WHY THIS EXISTS, AND WHY THE EXISTING GUARD COULD NOT DO IT.
 * `subprocessor-drift.test.ts` cross-checks the public `/privacy` list against
 * the internal compliance record **by NAME**, and that was the right fix for
 * what had actually drifted — three companies on one list and not the other.
 * But Anthropic was ALREADY on both lists, declared as *"AI features, including
 * vendor Deep Search"*. So a change that begins sending a NEW CATEGORY of
 * personal data — the account name and partial account number printed on
 * somebody's bank screenshot — to a company already named passes that guard
 * without a single word being written.
 *
 * 🔑 A NAME-LEVEL CHECK CANNOT SEE A ROLE CHANGE. What RA 10173 turns on is not
 * only WHO we send data to, it is WHAT we send them. This file checks the second
 * one for this feature, and only for as long as the feature exists: every
 * assertion is keyed on the seam that does the sending, so deleting the reader
 * deletes the obligation and nothing here has to be remembered.
 *
 * ⚠ The disclosure is a statement about what we do with people's bank data and
 * the owner is the registered DPO. Ruled 2026-08-28; widened in the SAME commit
 * as the feature, deliberately, so the two can never land apart.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const LIB = dirname(fileURLToPath(import.meta.url));
const READER = join(LIB, 'payment-receipt-read.server.ts');
const PRIVACY = join(LIB, '..', 'app/(shell)/privacy/page.tsx');
const RECORD = join(LIB, 'subprocessors.ts');

/** Does the app still show a payment screenshot to a model at all? */
function readerSendsAnImage(): boolean {
  if (!existsSync(READER)) return false;
  const src = readFileSync(READER, 'utf8');
  return /new Anthropic\(/.test(src) && /base64|image/i.test(src);
}

test('the guard is not vacuous — the sending seam is still here', () => {
  assert.ok(
    readerSendsAnImage(),
    'no receipt-to-model seam found; if the feature was removed, remove this guard too rather than letting every test below pass on nothing',
  );
});

test('the public notice tells people their receipt is read, and by whom', () => {
  if (!readerSendsAnImage()) return;
  const src = readFileSync(PRIVACY, 'utf8');
  const start = src.indexOf('Reading your payment receipt');
  assert.notEqual(start, -1, 'the receipt reader ships with no section in the public privacy notice');
  const section = src.slice(start, src.indexOf('</Section>', start));
  assert.match(section, /Anthropic/, 'the receipt section does not name who we send it to');
  assert.match(section, /bank document/, 'the receipt section does not say a receipt is bank data');
  assert.match(section, /Lawful basis/, 'the receipt section states no lawful basis (RA 10173)');
});

test('the public subprocessor entry says receipts, not just "AI features"', () => {
  if (!readerSendsAnImage()) return;
  const src = readFileSync(PRIVACY, 'utf8');
  const at = src.indexOf('Anthropic (AI features');
  assert.notEqual(at, -1, 'the Anthropic subprocessor entry moved — re-point this guard');
  const entry = src.slice(at, src.indexOf('</li>', at));
  assert.match(
    entry,
    /receipt/i,
    'the Anthropic subprocessor line still describes only AI features and Deep Search',
  );
});

test('the internal compliance record says receipts too', () => {
  if (!readerSendsAnImage()) return;
  const line = readFileSync(RECORD, 'utf8')
    .split('\n')
    .find((l) => l.includes("name: 'Anthropic'"));
  assert.ok(line, 'Anthropic is not in the compliance record at all');
  assert.match(
    line,
    /receipt/i,
    'the compliance record describes Anthropic without the receipt role — the public page and the record would disagree about WHAT we send',
  );
});

test('the transcript claim in the notice is true — nothing stores it', () => {
  if (!readerSendsAnImage()) return;
  // The notice promises "Not the transcript." That is a claim about code, so it
  // is checked against code — but against the INSERT PAYLOAD, not the file.
  //
  // 🪤 The first cut of this searched the whole module for `transcript` and went
  // red on a line that is fine: the transcribed text is handed to the pure
  // parser as an in-memory argument, which is exactly how it reaches the
  // comparison without ever being written down. A guard that cries wolf teaches
  // you to skim past the one time it is right — so it reads what we persist.
  const server = readFileSync(READER, 'utf8');
  const at = server.indexOf(".from('payment_receipt_reads').insert(");
  assert.notEqual(at, -1, 'the receipt-read insert moved — re-point this guard');
  const payload = server.slice(at, server.indexOf('});', at));
  assert.doesNotMatch(
    payload,
    /transcript/i,
    'the transcribed receipt text is being written to the database — the public notice says it is not kept',
  );
  for (const col of ['seen_references', 'seen_amounts', 'summary']) {
    assert.match(
      payload,
      new RegExp(col),
      `the notice describes storing ${col} and the insert does not`,
    );
  }
});
