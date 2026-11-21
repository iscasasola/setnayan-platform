/**
 * 🎟 EVERY PAYMENT WALL TAKES A CODE (owner 2026-11-22, DECISION_LOG 00bfe8db: *"so check all payment walls and add the
 * enter code"*). The shared pay page `/pay/[reference]` step 1 carries the drawer's collapsed "Have a code?", which
 * re-prices the UNPAID order through the ONE voucher engine — and never a checkout Maya already holds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PAY_CODE_COVERS_ALL, PAY_CODE_UNCHECKED, payCodeBoxShown, payCodeOpenFor } from './pay-code';
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

test('MAYA IN TWO TAPS: with Maya open the first render is the v3 pay page — no step 1, no Continue, no stepper', () => {
  const MAYA_STAGE = read('app/pay/[reference]/_components/maya-pay-stage.tsx');
  const mayaBlock = PAGE.slice(PAGE.indexOf('{!waiting && !overCeiling && mayaOpen && ('), PAGE.indexOf('{!waiting && !overCeiling && !mayaOpen && ('));
  assert.ok(mayaBlock.length > 100, 'the Maya route no longer renders its own page');
  assert.match(mayaBlock, /<MayaPayStage/);
  assert.match(mayaBlock, /code=\{codeBlock\}/, 'the code box is not on the Maya page');
  // Nothing of step 1 on that route: no PayPanel (it owns the stepper and the Continue), no summary, no StageLink.
  assert.doesNotMatch(mayaBlock, /<PayPanel|summaryFor|StageLink|Continue|StageRail/);
  assert.doesNotMatch(MAYA_STAGE, /Continue|StageRail|StageLink/);
  // The BDO route keeps its stages, and is the only one that does.
  assert.match(PAGE, /\{!waiting && !overCeiling && !mayaOpen && \(\s*<PayPanel/);
  assert.doesNotMatch(PAGE, /maya=\{\s*mayaOpen/, 'the Maya page must not be stage 2 behind a Continue any more');
  // v3 order, top to bottom: the amount → Order summary → Have a code? → Pay with → the pinned Pay ₱X.
  const at = (needle: string) => MAYA_STAGE.indexOf(needle);
  assert.ok(at('>Pay this exact amount<') < at('>Order summary<'));
  assert.ok(at('>Order summary<') < at('data-pay-maya-code'));
  assert.ok(at('data-pay-maya-code') < at('>Pay with<'));
  assert.ok(at('>Pay with<') < at('intent" value="maya_checkout"'));
});

test('reads are honest: a failed check says “We couldn’t check that code”, never “invalid”', () => {
  assert.match(PAY_CODE_UNCHECKED, /^We couldn’t check that code/);
  for (const src of [APPLY, BOX, read('lib/pay-code.ts')]) assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, ''), /invalid/i);
  assert.match(APPLY, /if \(orderRead\.error \|\| !orderRead\.data \|\| paymentsRead\.error \|\| maya === 'unread'\) unchecked\(\);/);
});
