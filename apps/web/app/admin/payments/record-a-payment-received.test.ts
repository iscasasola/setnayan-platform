/**
 * record-a-payment-received.test.ts — P5a (a), admin rows 13 · 15 · 16.
 *
 * Owner 2026-10-01: build **Record a payment received** — money that arrived
 * with nobody pressing "I paid" can be entered from the payments desk.
 *
 * What this file holds, each as a property that fails when broken:
 *
 *  1. The recorded row is the CUSTOMER'S row. It goes through the same
 *     identity helpers `logPayment` uses (stamped `pending`, bound to the
 *     order's buyer) and then through `approvePaymentCore` — never a direct
 *     `status: 'matched'` write that would skip the shortfall guard, the
 *     duplicate rule, receipts and payouts.
 *  2. It refuses what the customer's door refuses: a closed order, and an
 *     account that is not one of Setnayan's receiving accounts.
 *  3. It is an INTENT BRANCH on `approvePayment`, not a new exported action
 *     (the server-action budget is at its ceiling).
 *  4. Row 13 — the desk keeps the admin's search through an approve.
 *  5. Row 16 — the Money ledger's side reads keep their errors, so the "ours"
 *     badge and the Received total never silently become a wrong answer.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ACTIONS = read('app/admin/payments/actions.ts');
const PAGE = read('app/admin/payments/page.tsx');
const LEDGER = read('app/admin/money/_components/transactions-ledger.tsx');
// The Reference link moved into its own column file so a test can render it at
// every width (ledger-reference-column.tsx); the ledger mounts it.
const LEDGER_REF = read('app/admin/money/_components/ledger-reference-column.tsx');

function body(src: string, signature: string): string {
  const start = src.indexOf(signature);
  assert.ok(start >= 0, `${signature} moved — re-anchor this guard`);
  const end = src.indexOf('\n}\n', start);
  return src.slice(start, end);
}

const RECORD = body(ACTIONS, 'async function recordPaymentReceived(');

test('recording a payment is an intent on approvePayment, not a new action', () => {
  const approve = body(ACTIONS, 'export async function approvePayment(');
  assert.match(approve, /formData\.get\('intent'\) === 'record'\) return recordPaymentReceived\(/);
  assert.doesNotMatch(
    ACTIONS,
    /export async function recordPaymentReceived/,
    'recordPaymentReceived is exported — that is a new server action, and the budget is at its ceiling',
  );
});

test('the recorded row is written in the customer\'s own shape', () => {
  assert.match(RECORD, /paymentRowFor\(/, 'the account-holder row no longer goes through paymentRowFor');
  assert.match(RECORD, /guestPaymentRowFor\(/, 'a guest order (no account) has no honest row shape');
  assert.match(RECORD, /createMoneyWriterClient\(\)/, 'the insert is not on the money writer');
  assert.doesNotMatch(
    RECORD,
    /status:\s*'matched'/,
    'the record path writes `matched` itself — that skips the shortfall guard, receipts and payouts',
  );
});

test('it is confirmed through the SAME approval core every payment uses', () => {
  assert.match(RECORD, /approvePaymentCore\(\{/, 'recording no longer runs the shared approval');
  assert.match(RECORD, /promoteOrder: true/);
});

test('it refuses a closed order and an account that is not ours', () => {
  assert.match(RECORD, /canLogPaymentAgainstOrder\(order!\.status\)/, 'a closed order can be paid into again');
  assert.match(
    RECORD,
    /receivingAccounts\(settings\)\.some\(\(a\) => a\.id === channel\)/,
    '"Paid into" is no longer checked against Setnayan’s receiving accounts',
  );
  assert.match(RECORD, /readFailed \|\| accountsReadFailed/, 'an unread account list is treated as a real one');
});

test('the form is offered only for exactly ONE order and posts the record intent', () => {
  assert.match(PAGE, /if \(rows\.length !== 1\) return null;/, 'the form can appear for an ambiguous search');
  assert.match(PAGE, /name="intent" value="record"/);
  assert.match(PAGE, /name="client_idempotency_key" value=\{randomUUID\(\)\}/, 'a double tap records twice');
});

test('row 13 — an approve from a search lands back on that search', () => {
  const carried = PAGE.match(/<input type="hidden" name="q" value=\{query\} \/>/g) ?? [];
  console.log(`# desk forms carrying the search: ${carried.length}`);
  assert.ok(carried.length >= 3, `only ${carried.length} desk forms carry q — an approve drops the search`);
  const approve = body(ACTIONS, 'export async function approvePayment(');
  assert.match(approve, /redirect\(deskUrl\(q, outcome\.message, true\)\)/);
});

test('row 16 — the ledger says when a side read failed, in the column it feeds', () => {
  for (const e of ['buyersError', 'paidError', 'receiptsError']) {
    assert.match(LEDGER, new RegExp(`error: ${e}`), `${e} is dropped again — a refusal reads as empty`);
  }
  assert.match(LEDGER, /buyersFailed \?/, 'an unread buyer silently loses the "ours" badge');
  assert.match(LEDGER, /rows && !paidFailed/, 'Received falls back to the charged amount when payments were not read');
  assert.match(LEDGER, /receiptsFailed \?/, 'an unread receipt reads as "no receipt"');
  assert.match(LEDGER, /LEDGER_REFERENCE_COLUMN,/, 'the ledger no longer mounts the Reference column');
  assert.match(
    LEDGER_REF,
    /href=\{`\/admin\/payments\?filter=all&q=\$\{encodeURIComponent\(r\.public_id\)\}`\}/,
    'a ledger row no longer opens the payments desk on that order',
  );
});
