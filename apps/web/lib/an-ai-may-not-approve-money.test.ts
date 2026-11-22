import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
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
  // "Approve all N green" on Work (admin slice 4, 2026-11-13): the rule, the
  // re-check read, and the action that approves. The receipt read's DISPLAY
  // line lives in lib/admin/payment-verdicts.server.ts, outside every gate.
  'lib/admin/green-payments.ts',
  'lib/admin/green-payments.server.ts',
  'app/admin/work/actions.ts',
  // Received BDO screenshots (2026-11-17): the model transcribes them through
  // the .server seam; a HUMAN press on Match approves via approvePaymentCore.
  'app/admin/payments/received.ts',
  // ⚠ AMENDED DELIBERATELY, CITING THE RULING (owner 2026-11-17, specs
  // DECISION_LOG "Admin payment batch match: limits APPROVED, undo 30 minutes
  // (closes the open conditions on 0f332b2f)": "an-ai-may-not-approve-money.test.ts
  // is amended citing this row, never weakened silently"). The ONE exception to
  // "the reader may prepare, never approve": the owner's OWN received BDO
  // screenshots, matched by plain code (whole reference + exact amount + exactly
  // one unpaid payment), held 30 minutes with Undo, then paid through the same
  // approvePaymentCore. Both files join the gates, so every rule above still
  // holds for them: no receipt reader, no advisory table, no model verdict.
  'app/admin/payments/received-auto.ts',
  'lib/admin/received-auto-match.ts',
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
  const page = stripComments((read('app/admin/payments/page.tsx') + '\n' + read('app/admin/payments/_components/desk.tsx')));
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

test('the pay form asks for no typed reference — so nothing can truncate one', () => {
  // ✏️ 2026-11-17: this guarded a maxLength that silently cut a pasted
  // reference. The field itself is gone (owner: "the don't have to type") — the
  // reference is read off the receipt and stored, advisory, for the admin. If a
  // typed field ever returns, so must the maxLength ≥ 32 rule this held.
  const src = read('app/pay/[reference]/_components/pay-panel.tsx');
  assert.doesNotMatch(src, /name="reference_last6"/, 'a typed reference field is back — restore the maxLength guard with it');
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

/*
 * ── ⚠ AMENDED DELIBERATELY: A GATEWAY MAY APPROVE — AN AI STILL MAY NOT ──────
 * Owner 2026-11-21 (Setnayan-specs DECISION_LOG "MAYA CHECKOUT — BUILD IT",
 * rule 5): a Maya Checkout payment approves itself ONLY when Maya's own API,
 * called server-side with our SECRET key, confirms PAYMENT_SUCCESS for this
 * order's exact reference and amount. That is a payment processor's ledger
 * answering about money it holds — not a model reading a picture. So ONE
 * allow-listed caller may pass `gateway: 'maya'` to `approvePaymentCore`, and
 * every rule above still binds the whole Maya path: no receipt reader, no
 * advisory table. Nothing here relaxes a single line above it.
 */
const GATEWAY_GATES = [
  'lib/maya-checkout.ts', // judgeMayaPayment — the only "paid" verdict
  'lib/maya-settle.ts', // the decision: verify → judge → approve or queue
  'lib/maya-api.ts', // Maya's API, secret key
  'lib/maya-checkout.server.ts', // the real wiring
  'app/admin/payments/maya.ts', // the ONE gateway caller of approvePaymentCore
  'app/api/webhooks/maya/route.ts', // hints only
  'app/pay/[reference]/maya-return.ts', // hints only
  'app/pay/[reference]/maya-start.ts', // re-settles the previous checkout before opening a new one — hints only
] as const;

/** The one file allowed to pass `gateway:` to approvePaymentCore. */
const GATEWAY_CALLER = 'app/admin/payments/maya.ts';

test('the Maya path is a money gate too — no receipt reader, no advisory table', () => {
  for (const f of GATEWAY_GATES) {
    const src = stripComments(read(f));
    assert.equal(/payment-receipt-read/.test(src), false, `${f} reaches the receipt reader — a gateway approval must not depend on a model.`);
    assert.equal(/payment_receipt_reads/.test(src), false, `${f} reads what a model saw.`);
  }
});

test('only the allow-listed gateway caller passes `gateway:` to approvePaymentCore', () => {
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(WEB, dir))) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const rel = `${dir}/${name}`;
      if (statSync(join(WEB, rel)).isDirectory()) walk(rel);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        const src = stripComments(read(rel));
        if (/\bgateway:\s*['"]/.test(src)) hits.push(rel);
      }
    }
  };
  walk('app');
  walk('lib');
  assert.deepEqual(hits, [GATEWAY_CALLER], `gateway approvals now come from ${hits.join(', ')}`);
});

test('the gateway caller approves only through the settle path, which asks Maya first', () => {
  const caller = stripComments(read(GATEWAY_CALLER));
  assert.match(caller, /settleMayaPayment\(/, 'the gateway caller no longer routes through settleMayaPayment');
  const settle = stripComments(read('lib/maya-settle.ts'));
  const verify = settle.indexOf('deps.verifyById(');
  const judge = settle.indexOf('judgeMayaPayment(');
  const approve = settle.indexOf('deps.approve(');
  assert.ok(verify > 0 && judge > 0 && approve > 0, 'verify, judge and approve must all be in the settle path');
  assert.ok(verify < approve && judge < approve, 'settle approves before it has asked Maya and judged the answer');
  // The webhook and the return pass hints, never a verdict, and never reach the core themselves.
  for (const door of ['app/api/webhooks/maya/route.ts', 'app/pay/[reference]/maya-return.ts', 'app/pay/[reference]/maya-start.ts']) {
    const src = stripComments(read(door));
    assert.equal(/approvePaymentCore/.test(src), false, `${door} calls approvePaymentCore directly`);
    assert.match(src, /settleMaya\(/, `${door} no longer goes through settleMaya`);
  }
});
