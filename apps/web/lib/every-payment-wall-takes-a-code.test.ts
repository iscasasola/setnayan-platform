/**
 * 🎟 EVERY PAYMENT WALL TAKES A CODE (owner 2026-11-22, DECISION_LOG 00bfe8db: *"so check all payment walls and add the
 * enter code"*). The shared pay page `/pay/[reference]` step 1 carries the drawer's collapsed "Have a code?", which
 * re-prices the UNPAID order through the ONE voucher engine — and never a checkout Maya already holds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAY_CODE_COVERS_ALL, PAY_CODE_UNCHECKED, payCodeBoxShown, payCodeOpenFor, payNextSteps } from './pay-code';
import { orderGrossOwed } from './orders';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const APPLY = read('app/pay/[reference]/pay-code.ts');
const ACTIONS = read('app/pay/[reference]/actions.ts');
const PAGE = read('app/pay/[reference]/page.tsx');
const BOX = read('app/pay/[reference]/_components/pay-code-box.tsx');

const UNPAID = { orderStatus: 'awaiting_payment', hasPayment: false, mayaCheckoutOpen: false, codeApplied: false, quoted: false };

test('a code on an UNPAID order re-prices it — through the one voucher engine, on the order’s own columns', () => {
  assert.deepEqual(payCodeOpenFor(UNPAID), { ok: true });
  assert.deepEqual(payCodeOpenFor({ ...UNPAID, orderStatus: 'draft' }), { ok: true });
  // The same engine, redemption row and order columns the inline-checkout drawer uses — no second engine.
  assert.match(APPLY, /await validateAndCalculateVoucher\(\{/);
  assert.match(APPLY, /from\('discount_code_redemptions'\)\.insert\(/);
  assert.match(APPLY, /\.update\(\{ voucher_code_applied: result\.code_normalized, voucher_discount_centavos: Number\(result\.discount_centavos\) \}\)/);
  assert.match(APPLY, /\.in\('status', \['draft', 'awaiting_payment'\]\)\s*\.is\('voucher_code_applied', null\)\s*\.is\('confirmed_total_php', null\)/, 'the re-price must only land on an order still exactly as checked');
  assert.match(APPLY, /event_type: 'voucher_applied'/);
  // The price is the order's own pre-voucher base, never a posted figure.
  assert.match(APPLY, /const basePhp = Number\(order\.requested_total_php \?\? 0\)/);
  assert.doesNotMatch(APPLY, /formData\.get\('(amount|original_centavos|price)/);
  // …and what the page then asks for is that base less the code (orderGrossOwed already nets it).
  assert.equal(orderGrossOwed({ requestedTotalPhp: 2500, confirmedTotalPhp: null, voucherDiscountPhp: 500 }), 2000);
});

test('it adds NO server action — it rides the page’s existing form action', () => {
  assert.doesNotMatch(APPLY, /^\s*['"]use server['"]/m);
  assert.match(APPLY, /^import 'server-only';/m);
  assert.match(ACTIONS, /if \(formData\.get\('intent'\) === 'apply_code'\) return applyPayCode\(formData\);/);
  assert.match(BOX, /<form action=\{submitPaymentProof\}/);
  assert.match(BOX, /name="intent" value="apply_code"/);
});

test('never beside an open Maya checkout, a sent payment or a paid order — and an unread Maya answer hides it', () => {
  const shown = { awaitingPayment: true, sentOrWaiting: false, mayaCheckout: 'none' as const, codeApplied: false, quoted: false };
  assert.equal(payCodeBoxShown(shown), true);
  assert.equal(payCodeBoxShown({ ...shown, mayaCheckout: 'open' }), false, 'shown beside an open Maya checkout');
  assert.equal(payCodeBoxShown({ ...shown, mayaCheckout: 'unread' }), false, 'shown when the Maya read failed');
  assert.equal(payCodeBoxShown({ ...shown, sentOrWaiting: true }), false, 'shown after a payment was sent');
  assert.equal(payCodeBoxShown({ ...shown, awaitingPayment: false }), false, 'shown on a paid or closed order');
  assert.equal(payCodeBoxShown({ ...shown, codeApplied: true }), false, 'a second code box on the same order');
  // The server refuses the same — an open checkout is never re-priced, and its read fails closed.
  assert.equal(payCodeOpenFor({ ...UNPAID, mayaCheckoutOpen: true }).ok, false);
  assert.equal(payCodeOpenFor({ ...UNPAID, hasPayment: true }).ok, false);
  assert.equal(payCodeOpenFor({ ...UNPAID, orderStatus: 'submitted' }).ok, false);
  assert.equal(payCodeOpenFor({ ...UNPAID, orderStatus: 'paid' }).ok, false);
  assert.equal(payCodeOpenFor({ ...UNPAID, quoted: true }).ok, false);
  assert.match(APPLY, /maya === 'unread'\) unchecked\(\)/, 'a refused Maya read must refuse the code');
  assert.match(APPLY, /mayaCheckoutOpen: maya === 'open'/);
  assert.match(PAGE, /mayaCheckout: waiting \? 'none' : await readOpenMayaCheckout\(payable\.orderId\)/);
});

test('₱0 — a code that covers the whole price is refused before anything is written (no free route on /pay yet)', () => {
  const zero = APPLY.indexOf('if (result.final_centavos <= 0n) to(\'code_error\', PAY_CODE_COVERS_ALL);');
  assert.ok(zero > 0, 'a ₱0 code must not be applied into a bill nothing would confirm');
  assert.ok(zero < APPLY.indexOf("from('discount_code_redemptions').insert("), 'the ₱0 refusal must come before any write');
  assert.match(PAY_CODE_COVERS_ALL, /message us/);
});

test('step 1 follows the route: Maya open → Maya’s words; Maya closed or fallen back → the BDO words', () => {
  const maya = payNextSteps({ mayaOpen: true, scanStep: 'Scan the code', activates: 'It switches on when confirmed.' });
  assert.deepEqual(maya.steps, ['Pay on Maya’s secure page', 'Come straight back for your receipt — nothing to upload', 'It switches on the moment it’s paid']);
  assert.equal(maya.showTransferNote, false, 'the “Put SN… in the transfer note” line under a Maya payment');
  const bdo = payNextSteps({ mayaOpen: false, scanStep: 'Scan the code', activates: 'It switches on when confirmed.' });
  assert.deepEqual(bdo.steps, ['Scan the code', 'Upload the screenshot of your payment receipt — nothing to type.', 'It switches on when confirmed.']);
  assert.equal(bdo.showTransferNote, true);
  assert.match(PAGE, /const next = payNextSteps\(\{ mayaOpen, scanStep: words\.scanStep, activates \}\);/);
  assert.match(PAGE, /\{next\.showTransferNote \? <p className="mt-2 text-xs text-ink\/70">\{words\.note\}<\/p> : null\}/);
  // mayaOpen is decided BEFORE step 1 is built, and only once.
  assert.ok(PAGE.indexOf('const mayaOpen =') < PAGE.indexOf('const summary = ('));
  assert.equal(PAGE.match(/const mayaOpen =/g)?.length, 1);
});

test('reads are honest: a failed check says “We couldn’t check that code”, never “invalid”', () => {
  assert.match(PAY_CODE_UNCHECKED, /^We couldn’t check that code/);
  for (const src of [APPLY, BOX, read('lib/pay-code.ts')]) assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), /invalid/i);
  assert.match(APPLY, /if \(orderRead\.error \|\| !orderRead\.data \|\| paymentsRead\.error \|\| maya === 'unread'\) unchecked\(\);/);
});
