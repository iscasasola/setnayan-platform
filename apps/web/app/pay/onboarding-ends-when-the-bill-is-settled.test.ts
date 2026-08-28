/**
 * onboarding-ends-when-the-bill-is-settled.test.ts
 *
 * ⚖ OWNER, 2026-08-28: *"i will go here? it should be settled first. After I
 * paid, it should say we are currently verifying your purchase. kindly wait
 * within 24 hours. […] Then the onboarding end. No option to pay later. then
 * need to go back to uncheck their papic and setnayan AI purchase."*
 *
 * 🔑 THE LAST STEP IS THE PAYMENT PAGE, NOT A DASHBOARD BILL. The order page is
 * where a bill LIVES; `/pay/[reference]` is where one is SETTLED — the QR with
 * the amount already in it, the account number, the proof form. Landing somebody
 * on a ledger entry for a thing they are ready to pay for right now is the same
 * defect as the Papic-studio banner this redirect already replaced once
 * (2026-08-20), one step further along.
 *
 * ⚖ AND "GO BACK AND UNCHECK" IS A CANCEL, NOT A REWIND. The event exists before
 * the bill is minted — that is where the reference comes from — so walking them
 * back into the wizard would re-run a commit that has already happened, and the
 * likeliest outcome of that is a SECOND celebration.
 *
 * ⚖ REMOVING THE EXTRAS NEVER REMOVES THE CELEBRATION. A payment screen must not
 * be the thing that decides whether somebody's birthday exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const web = process.cwd();
const read = (rel: string) => readFileSync(join(web, rel), 'utf8');
const strip = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const MINT = strip(read('lib/onboarding-services-orders.ts'));
const PAGE = strip(read('app/pay/[reference]/page.tsx'));
const ACTIONS = strip(read('app/pay/[reference]/actions.ts'));

test('🔴 finishing the wizard lands on the page that can TAKE the money', () => {
  assert.match(
    MINT,
    /paymentPath: `\/pay\/\$\{encodeURIComponent\(referenceCode\)\}\?setup=1`/,
    'the bill must open where it can be settled, flagged as the last set-up step',
  );
  // The two destinations it has already been wrong about, both named so a
  // future edit cannot quietly go back to either.
  assert.doesNotMatch(MINT, /paymentPath: `\/dashboard\/\$\{eventId\}\/studio\/papic/,
    'the photo studio was the 2026-08-20 defect');
  assert.doesNotMatch(MINT, /paymentPath: `\/dashboard\/\$\{eventId\}\/orders/,
    'the ledger entry is where a bill lives, not where it is settled');
});

test('🔴 in set-up there is no door that reads as "pay later"', () => {
  // The back link points at the dashboard. On a bill somebody came back to that
  // is correct; as the last step of setting up it is "skip this".
  assert.match(PAGE, /const setup = search\.setup === '1';/, 'the page must know which it is');
  assert.match(
    PAGE,
    /\{setup \? \([\s\S]{0,400}?Last step\./,
    'set-up mode must say so instead of offering the way out',
  );
  assert.match(PAGE, /payable\.back && \(/, 'and the ordinary bill must KEEP its way out');
});

test('the other door removes the extras — and says what that costs', () => {
  assert.match(PAGE, /action=\{removeSetupExtras\}/, 'the second door must be a real control');
  assert.match(PAGE, /I don&rsquo;t want these after all — remove them/, 'named plainly');
  assert.match(
    PAGE,
    /at the normal price, without the set-up discount/,
    'and the cost of leaving must be stated — hiding it makes the discount a trap',
  );
  assert.match(PAGE, /free shots stay live/, 'and the celebration must be said to survive');
});

test('after the proof is in, the last step is FINISHED, not repeated', () => {
  assert.match(PAGE, /\{setup && waiting && payable\.eventId && \(/, 'a finish door appears');
  assert.match(PAGE, /Finish setting up/, 'named as the end of set-up');
  // And the removal door is gone by then — you cannot un-buy something you have
  // just told us you paid for.
  assert.match(PAGE, /\{setup && !waiting && \(/, 'removal is offered only before payment');
});

test('🔒 removing is scoped, status-gated, and read back', () => {
  assert.match(ACTIONS, /export async function removeSetupExtras/, 'the action exists');
  assert.match(ACTIONS, /\.eq\('user_id', user\.id\)/, 'only your own bill');
  assert.match(
    ACTIONS,
    /\.in\('status', CANCELLABLE_ORDER_STATUSES\)/,
    'a settled bill is a refund request, not a cancellation — and the list is '
      + 'shared with the dashboard cancel, never re-typed',
  );
  assert.match(
    ACTIONS,
    /if \(!cancelled \|\| cancelled\.length === 0\)/,
    'Supabase does not throw: without a read-back a refused cancel reports success',
  );
});

test('🪤 removing never sends them back into the wizard', () => {
  // The commit has already happened. Re-entering it risks a second event.
  assert.match(
    ACTIONS,
    /redirect\(typeof eventId === 'string' && eventId \? `\/dashboard\/\$\{eventId\}` : '\/dashboard'\)/,
    'it must land in the celebration that exists',
  );
  assert.doesNotMatch(ACTIONS, /\/onboarding\//, 'and never in the flow that made it');
});

test('🚨 the original payment action survived being edited beside', () => {
  // This file was overwritten wholesale during the build and recovered from git.
  // The proof form is the entire point of the page; losing it would have been
  // silent until somebody tried to pay.
  // 🪤 ANCHORED. `submitPaymentProofX` still CONTAINS `submitPaymentProof`, so a
  // rename-shaped sabotage of an unanchored match reports a clean pass — the
  // prefix trap this repo has already paid for once.
  assert.match(
    ACTIONS,
    /export async function submitPaymentProof\(formData: FormData\): Promise<void>/,
    'the proof path must still exist — this file was overwritten once and recovered',
  );
});
