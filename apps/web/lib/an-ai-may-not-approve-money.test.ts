import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The receipt reader may PREPARE. It may never APPROVE.
 *
 * The one-person admin plan (2026-07-11) is the rule: the machine may prepare
 * and may hold back, it may never be the thing that lets money, a price, an
 * approval or a publish through. That rule lives in prose in four docblocks, and
 * prose does not fail a build — so it is measured here.
 *
 * 🔑 EACH ASSERTION IS ONE WAY THE RULE COULD BE BROKEN BY SOMEBODY WHO MEANT
 * WELL: wiring the advisory verdict into the fast-approve predicate to save the
 * admin a click, or asking the model for a yes/no because the transcription step
 * feels like an extra hop. Both are small edits and neither would fail any other
 * test in this repo.
 */

const WEB = join(process.cwd(), process.cwd().endsWith('apps/web') ? '' : 'apps/web');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

/**
 * Comments are stripped before matching. Every file below carries a docblock
 * that NAMES the thing it must not do ("does not import this module and must
 * not start"), so a raw-source scan reports the defect it is describing — the
 * same trap `doors-are-designed.test.ts` records paying for.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const MONEY_GATES = [
  'lib/orders.ts', // isDecisivePaymentMatch + orderReconciledToPaid live here
  'app/admin/payments/actions.ts', // approvePayment, batchApprovePayments
] as const;

test('no money gate imports the receipt reader', () => {
  for (const f of MONEY_GATES) {
    const src = stripComments(read(f));
    assert.equal(
      /payment-receipt-read(?!\.server)/.test(src),
      false,
      `${f} reaches the advisory reader — an approval must not depend on a model.`,
    );
  }
});

test('no money gate reads the advisory table', () => {
  // The server seam imports itself dynamically inside `after()` in
  // admin/payments/actions.ts, which is fine — that WRITES a read, after the
  // response. What must never appear is a SELECT of the verdict feeding a
  // decision.
  for (const f of MONEY_GATES) {
    const src = stripComments(read(f));
    assert.equal(
      /from\(\s*['"]payment_receipt_reads['"]\s*\)/.test(src),
      false,
      `${f} queries payment_receipt_reads — nothing may approve on what a model saw.`,
    );
  }
});

test('the approval predicate is computed without the verdict', () => {
  const page = stripComments(read('app/admin/payments/page.tsx'));
  // The page DOES read the table (to render the card) and DOES compute
  // `decisive`. Pin that the two never meet: the decisive expression must not
  // mention the reads map.
  const decisive = page.slice(page.indexOf('decisive:'), page.indexOf('decisive:') + 600);
  assert.ok(decisive.length > 100, 'could not find the decisive expression to check');
  assert.equal(
    /receiptReads|reference_matches|amount_matches/.test(decisive),
    false,
    'the one-click-approval predicate now depends on what a model saw.',
  );
});

test('the prompt asks the model to transcribe, never to judge', () => {
  const src = read('lib/payment-receipt-read.ts');
  assert.match(src, /Do not say whether anything matches/i);
  // The banned shape: asking the model for the answer instead of the text.
  const prompt = src.slice(
    src.indexOf('RECEIPT_TRANSCRIBE_PROMPT'),
    src.indexOf('export const NOT_A_RECEIPT'),
  );
  assert.equal(
    /\b(does .* (appear|match)|is this (correct|right|valid)|verify|confirm whether)\b/i.test(prompt),
    false,
    'the prompt asks the model for a verdict — the decision has moved back into the model.',
  );
});

test('a mismatch is never the default — every verdict field can be null', () => {
  /*
    🪤 REV 1 OF THIS TEST WAS DECORATION AND THE MUTATION RUN CAUGHT IT.
    It asserted that `referenceMatches: boolean | null` APPEARS in the file.
    The phrase appears three times — the public type, the internal verdict
    helper, and the summary's arguments — so making the PUBLIC one non-nullable
    (the whole regression) still left two matches and the test stayed GREEN
    at 3 → 2.

    The rule is a direction, not a sighting, so it is asserted as one: there
    must be ZERO non-nullable declarations, and the nullable ones are FLOORED
    so deleting them all cannot pass either.
  */
  const src = stripComments(read('lib/payment-receipt-read.ts'));
  const nonNullable = src.match(/\b(referenceMatches|amountMatches)(\?)?: boolean\s*[;,)]/g) ?? [];
  assert.deepEqual(
    nonNullable,
    [],
    `a verdict field can no longer be null: ${nonNullable.join(', ')} — ` +
      'NULL means "we could not answer" and FALSE reads on screen as an accusation.',
  );
  const nullable = src.match(/\b(referenceMatches|amountMatches): boolean \| null/g) ?? [];
  assert.ok(
    nullable.length >= 3,
    `expected at least 3 nullable verdict declarations, found ${nullable.length}`,
  );
});

test('the pay form does not silently truncate a pasted reference', () => {
  // The field invites "paste the whole thing" and the server keeps 64
  // characters. A small maxLength here throws the rest away with no error —
  // it shipped that way once.
  const src = read('app/pay/[reference]/_components/pay-panel.tsx');
  const field = src.slice(src.indexOf("name=\"reference_last6\""));
  const maxLength = /maxLength=\{(\d+)\}/.exec(field.slice(0, 400));
  assert.ok(maxLength, 'the reference field lost its maxLength entirely');
  assert.ok(
    Number(maxLength[1]) >= 32,
    `the reference field truncates at ${maxLength[1]} while the copy invites a full paste`,
  );
});

test('the buyer is asked at most once, and a "not sure" never asks', () => {
  /*
    The two halves of the owner's 2026-08-28 instruction, pinned together
    because loosening either one traps somebody who has already paid:

      1. the pay action must honour a `rechecked` submission unconditionally, and
      2. the rule itself must fire only on a definite FALSE.

    A `!== true` here — the tempting simplification — would send a payer back
    every time our own reader had a bad minute.
  */
  const action = stripComments(read('app/pay/[reference]/actions.ts'));
  assert.match(
    action,
    /const askedAlready = formData\.get\('rechecked'\) === '1';/,
    'the pay action stopped honouring a second attempt',
  );
  assert.match(
    action,
    /if \(!askedAlready\) \{/,
    'the ask is no longer skipped on the second attempt — a payer could be looped',
  );

  const rule = stripComments(read('lib/payment-receipt-read.ts'));
  const body = rule.slice(rule.indexOf('export function shouldAskBuyerToFix'));
  assert.match(
    body,
    /referenceMatches === false/,
    'the ask rule no longer requires a definite mismatch',
  );
  assert.equal(
    /referenceMatches !== true/.test(body),
    false,
    'the ask rule now fires on "we do not know" — that traps people who really paid',
  );
});

test('the message tells them to attach the picture again', () => {
  // The redirect re-renders an empty form; the file input does not survive it.
  // A message that only said "check the digits" would trade their proof for a
  // typo fix.
  const action = read('app/pay/[reference]/actions.ts');
  // Anchored on the CONSTANT, not on a nearby literal: rev 1 searched forward
  // from the string 'recheck', and a refactor that moved the message into a
  // variable broke the guard rather than the behaviour.
  const msg = /const askMsg =\s*'([^']*)'/.exec(action)?.[1];
  assert.ok(msg, 'the recheck message went missing');
  assert.match(msg, /attach your screenshot again/i);
  assert.match(msg, /just send it again/i);
  // And the set-up flow has to survive the round trip — dropping it silently
  // takes away a door the buyer had a moment ago.
  assert.match(
    action,
    /formData\.get\('setup'\) === '1' \? '&setup=1'/,
    'a recheck now drops the buyer out of the set-up flow',
  );
});
