/**
 * The ONE payment page keeps its three promises.
 *
 * Each assertion below was mutation-checked by OCCURRENCE COUNT (printed
 * before → after) — an unmeasured sabotage that reports green proves nothing,
 * which this repo has now been bitten by more than once.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HERE = join(process.cwd(), 'app', 'pay');
const read = (...p: string[]) => readFileSync(join(HERE, ...p), 'utf8');

/** Strip comments: every file here EXPLAINS the defect it closed, naming the
 *  very strings a raw-source grep would then count as the defect. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

const page = stripComments(read('[reference]', 'page.tsx'));
const panel = stripComments(read('[reference]', '_components', 'pay-panel.tsx'));
const actions = stripComments(read('[reference]', 'actions.ts'));

test('the QR is in the same single column as the summary — never a second column', () => {
  // The owner's report: "it just went to the you're paying for… never showed
  // the pay this exact amount and no way to get there." That was a
  // side-by-side grid, which on a phone is a screen nothing points at.
  const twoCol = (page + panel).match(/(sm|md|lg):grid-cols-2|grid-cols-\[1fr_1fr\]/g) ?? [];
  assert.equal(twoCol.length, 0, 'a multi-column grid is back on the payment page');
  // And the panel must actually be rendered by the page, not merely imported.
  assert.match(page, /<PayPanel\b/);
});

test('every step is reachable — the bar names the next one', () => {
  assert.match(panel, /Show me the QR code/);
  assert.match(panel, /send my proof/);
  assert.match(panel, /id="payCard"/);
  assert.match(panel, /id="proofCard"/);
});

test('the screenshot preview stays on screen, above the reference field', () => {
  const previewAt = panel.indexOf('Read the reference number off it');
  const fieldAt = panel.indexOf('reference_last6');
  assert.ok(previewAt > 0, 'the preview caption is gone');
  assert.ok(fieldAt > 0, 'the last-6 field is gone');
  assert.ok(previewAt < fieldAt, 'the preview must render BEFORE the field they type into');
  assert.match(panel, /onFilePicked/, 'nothing captures the picked file to preview it');
});

test('proofs go to the PRIVATE bucket — a bank screenshot is never public', () => {
  assert.match(panel, /bucket="thread-files"/);
  assert.equal((panel.match(/bucket="media"/g) ?? []).length, 0);
});

test('the amount logged is the ORDER’s, never the form’s', () => {
  assert.match(actions, /amount_php: payable\.amountPhp/);
  // A posted amount must not be able to reach the insert.
  assert.equal((actions.match(/Number\(formData\.get\('amount_php'\)\)/g) ?? []).length, 0);
});

test('the rail is written in the spelling the headroom meter can read', () => {
  // /admin/settings/payment-methods matches channel === 'gcash' / 'bdo' EXACTLY
  // to measure how much room the receiving account has left this month.
  // 'GCash'/'BDO' scored every payment as ₱0 against the cap: the meter read
  // clear while the account filled up.
  assert.match(actions, /channelRaw === 'bdo' \? 'bdo'/);
  assert.match(actions, /channelRaw === 'gcash' \? 'gcash'/);
  assert.equal((actions.match(/'GCash'|'BDO'/g) ?? []).length, 0);
});

test('a booking fee must carry a bank reference — the owner ruled it', () => {
  // Owner 2026-08-06: on that lane a reference is REQUIRED, because an admin
  // reconciles it against a bank message rather than guessing at money.
  assert.match(actions, /payable\.requiresReference && !bankReference/);
  assert.match(panel, /required=\{requiresReference\}/);
});

test('a pasted full reference is KEPT, not trimmed to six', () => {
  // Six is a minimum a person can read off a receipt, not a maximum we store.
  assert.match(actions, /cleaned\.slice\(0, 64\)/);
  assert.doesNotMatch(actions, /cleaned\.slice\(-6\)/);
});

test('a claim with neither a picture nor a number is refused, not stored', () => {
  // Both fields are optional and the submit button sits below them: one stray
  // tap wrote an unreconcilable row AND hid the form that could have fixed it.
  assert.match(actions, /if \(!screenshotUrl && !bankReference\)/);
});

test('the form comes back when we ask for a better picture', () => {
  // requestPaymentResubmit sets payments.status='resubmit_requested' and
  // deliberately leaves the ORDER alone. Hiding the form on ANY payment row
  // meant the shop got an email asking for a clearer shot and arrived at a page
  // with no way to send one.
  assert.match(page, /resubmit_requested/);
  assert.match(page, /needsBetterProof/);
  assert.match(panel, /resubmitNotice/);
});

test('a coordinator without payment permission is refused here too', () => {
  // orders_owner_read admits ANY event member, so this page must carry the same
  // lock the couple's own order page does — a second door onto one act.
  assert.match(actions, /coordinatorMoneyScopeAllowed\(/);
  assert.match(actions, /payable\.eventId/);
});

test('a placeholder payment row is not a claim', () => {
  // Eight buy paths INSERT an empty payments row at checkout. Asking "does a
  // payment row exist?" thanked the buyer for money they had not sent and took
  // away the form they were about to use.
  assert.match(page, /screenshot_url,reference_number/);
  assert.match(page, /const carriesProof = Boolean\(/);
  assert.match(page, /proofSent = carriesProof/);
});

test('the coordinator gate does not fire on a person paying their own order', () => {
  // A shop paying Setnayan on a couple-scoped order owns it outright; asking
  // the couple's permission refuses a supplier in the couple's words.
  assert.match(actions, /payable\.eventId && payable\.ownerUserId !== user\.id/);
});

test('an anonymous draft session is never taken to a payment page', () => {
  assert.match(page, /user\.is_anonymous/);
});

test('the page is not a dead end', () => {
  assert.match(page, /payable\.back/);
});

test('the amount comes from the product’s one authority, not a copy', () => {
  // A local copy subtracted the voucher a second time on any QUOTED order, so
  // the QR asked for less than the shortfall guard demanded and the purchase
  // could never switch on. See lib/the-qr-asks-for-what-is-owed.test.ts.
  const resolver = stripComments(read('..', '..', 'lib', 'payable-by-reference.ts'));
  assert.match(resolver, /orderGrossOwed\(/);
});

test('the payable is resolved on the SESSION client, so RLS scopes it', () => {
  assert.match(actions, /fetchPayableByReference\(supabase, reference\)/);
  assert.equal(
    (actions.match(/createMoneyWriterClient\(\)[\s\S]{0,80}\.from\('orders'\)/g) ?? []).length,
    0,
    'the ownership read must never run on the service-role client',
  );
});
