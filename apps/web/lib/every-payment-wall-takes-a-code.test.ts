/**
 * 🎟 EVERY PAYMENT WALL TAKES A CODE (owner 2026-11-22, DECISION_LOG 00bfe8db: *"so check all payment walls and add the
 * enter code"*). The shared pay page `/pay/[reference]` step 1 carries the drawer's collapsed "Have a code?", which
 * re-prices the UNPAID order through the ONE voucher engine — and never a checkout Maya already holds.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PAY_CODE_ERRORS,
  PAY_CODE_UNCHECKED,
  PAY_FREE_BUTTON,
  PAY_FREE_CHANNEL,
  PAY_FREE_HEAD,
  payCodeBoxShown,
  payCodeErrorFor,
  payCodeErrorKeyOfReason,
  payCodeOpenFor,
  payFreeReference,
  payFreeRoute,
} from './pay-code';
import { paymentWasLogged } from './payment-logged';
import { orderGrossOwed } from './orders';
import { stripComments } from './strip-comments';

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
  // 🔁 UPDATED ON PURPOSE 2026-11-22 (review of #8130, low 1) — NOT WEAKENED: the re-price is ONE database statement
  // that also re-checks "no open Maya checkout" inside itself (`pay_reprice_order_with_code`). Its conditions are
  // proven by behaviour in tests/db/a-zero-peso-code-is-a-voucher-payment.db.test.ts; here, that the app uses it and
  // no longer updates the order's price columns by hand.
  assert.match(
    APPLY,
    /money\.rpc\('pay_reprice_order_with_code', \{\s*p_order_id: payable\.orderId,\s*p_code: result\.code_normalized,\s*p_discount_centavos: Number\(result\.discount_centavos\),\s*\}\)/,
  );
  assert.match(APPLY, /if \(repriceErr \|\| repriced !== true\) \{/, 'anything but a confirmed re-price must take the redemption back');
  assert.doesNotMatch(APPLY, /\.update\(\{ voucher_code_applied/, 'the order is re-priced outside the guarded statement');
  const SQL = readFileSync(join(WEB, '../../supabase/migrations/20271357859993_pay_zero_code_confirm.sql'), 'utf8');
  assert.match(SQL, /o\.status::text IN \('draft', 'awaiting_payment'\)\s*AND o\.voucher_code_applied IS NULL\s*AND o\.confirmed_total_php IS NULL/);
  assert.match(SQL, /AND NOT EXISTS \(\s*SELECT 1\s*FROM public\.maya_checkouts m\s*WHERE m\.order_id = o\.order_id\s*AND m\.status = 'created'\s*\)/);
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
  // 🧾 A bill's own empty placeholder row is NOT a payment (eight buy paths write one at checkout) — it must not close
  // the box; only something somebody SENT does. Both the page and the server ask `paymentWasLogged`.
  assert.equal(paymentWasLogged({ status: 'pending', reference_number: null, screenshot_url: null }), false);
  assert.match(APPLY, /hasPayment: \(\(paymentsRead\.data \?\? \[\]\) as Array<[^>]+>\)\.some\(paymentWasLogged\),/);
  assert.match(PAGE, /sentOrWaiting: waiting \|\| \(latestRow \? paymentWasLogged\(latestRow\) : false\) \|\| Boolean\(paymentsError\),/);
  assert.equal(payCodeOpenFor({ ...UNPAID, orderStatus: 'submitted' }).ok, false);
  assert.equal(payCodeOpenFor({ ...UNPAID, orderStatus: 'paid' }).ok, false);
  assert.equal(payCodeOpenFor({ ...UNPAID, quoted: true }).ok, false);
  assert.match(APPLY, /maya === 'unread'\) unchecked\(\)/, 'a refused Maya read must refuse the code');
  assert.match(APPLY, /mayaCheckoutOpen: maya === 'open'/);
  assert.match(PAGE, /mayaCheckout: waiting \? 'none' : await readOpenMayaCheckout\(payable\.orderId\)/);
});

test('₱0 — a code that covers the whole price: "nothing to pay" + ONE button, into the admin queue once, never Maya', () => {
  // 🔁 UPDATED ON PURPOSE 2026-11-22 (controller, the follow-up to #8130): the refusal ("please message us") is replaced
  // by the confirmation route, now that a ₱0 payment row can exist (migration 20271357859993).
  assert.equal(PAY_FREE_HEAD, 'Your code covers this — nothing to pay');
  assert.equal(PAY_FREE_BUTTON, 'Send for confirmation');
  assert.equal(PAY_FREE_CHANNEL, 'voucher');
  // The route: awaiting payment, a code on it, nothing left to pay.
  const free = { awaitingPayment: true, amountPhp: 0, codeApplied: true };
  assert.equal(payFreeRoute(free), true);
  assert.equal(payFreeRoute({ ...free, amountPhp: 1 }), false, 'a bill with money left took the free route');
  assert.equal(payFreeRoute({ ...free, codeApplied: false }), false, 'a ₱0 bill with no code took the free route');
  assert.equal(payFreeRoute({ ...free, awaitingPayment: false }), false);
  assert.equal(payFreeRoute({ ...free, amountPhp: Number.NaN }), false);
  // The code is applied like any other — no refusal before the write any more.
  assert.doesNotMatch(APPLY, /final_centavos <= 0n\) (to|refuse)\(/);

  // NEVER MAYA: the page keeps Maya and the BDO panel off that route, and the Maya start refuses a ₱0 bill itself.
  // The page returns the ₱0 stage ALONE, before Maya is even asked and before the shipped render (QR, form, Maya).
  const early = PAGE.indexOf('if (freeRoute && payable.code) {');
  assert.ok(early > 0, 'the ₱0 stage is no longer its own early return');
  assert.ok(early < PAGE.indexOf('const mayaOpen = '), 'Maya is asked before the ₱0 stage returns');
  const freeBlock = PAGE.slice(early, PAGE.indexOf('const mayaOpen = '));
  assert.match(freeBlock, /return \(\s*<main [^>]*data-pay-free-page="">\s*<PayFreeConfirm [^>]*\/>\s*<\/main>\s*\);/);
  assert.doesNotMatch(freeBlock, /MayaPayStage|PayPanel|summaryFor|PayCodeBox/);
  assert.match(read('app/pay/[reference]/maya-return.ts'), /if \(phase === 'busy'\) return false;[\s\S]{0,200}if \(!\(amountPhp > 0\)\) return false;/, 'the Maya rail reads as open for a ₱0 bill');
  const MAYA_START = read('app/pay/[reference]/maya-start.ts');
  const zeroStop = MAYA_START.indexOf('if (!(payable.amountPhp > 0)) redirect(`/pay/${encodeURIComponent(reference)}`);');
  assert.ok(zeroStop > 0, 'the Maya start no longer refuses a ₱0 bill');
  assert.ok(zeroStop < MAYA_START.indexOf('createMayaCheckout(') || MAYA_START.indexOf('createMayaCheckout(') === -1, 'the ₱0 stop sits after the checkout is created');
  assert.ok(zeroStop < MAYA_START.indexOf('settleMaya({ reference'), 'the ₱0 stop must come before Maya is asked anything');
  // The ₱0 stage draws no Maya, no QR, no upload — one form, one button.
  const FREE = read('app/pay/[reference]/_components/pay-free-confirm.tsx');
  assert.equal((FREE.match(/<form\b/g) ?? []).length, 1);
  assert.match(FREE, /name="intent" value="confirm_free"/);
  assert.equal((FREE.match(/<ActionButton\b/g) ?? []).length, 1, 'the ₱0 stage has more than its one button');
  assert.match(FREE, /<ActionButton type="submit" tone="brand" main /);
  assert.match(FREE, /label=\{PAY_FREE_BUTTON\} \/>/);
  assert.doesNotMatch(stripComments(FREE), /maya|screenshot|upload|qr/i);

  // ONE row, in the existing queue, by the existing action — no new server action.
  assert.match(ACTIONS, /if \(formData\.get\('intent'\) === 'confirm_free'\) return confirmFreeCode\(formData\);/);
  const CONFIRM = APPLY.slice(APPLY.indexOf('export async function confirmFreeCode'));
  assert.ok(CONFIRM.length > 500, 'premise: confirmFreeCode exists');
  // Nothing posted is trusted: ₱0 comes from the order's own figures, and the amount written is the literal 0.
  assert.match(CONFIRM, /if \(!payFreeRoute\(\{ awaitingPayment: true, amountPhp: payable\.amountPhp, codeApplied: Boolean\(payable\.code\) \}\)\) refuse\('not_free'\);/);
  assert.doesNotMatch(CONFIRM, /formData\.get\('(amount|channel|code)/);
  assert.match(CONFIRM, /amount_php: 0,\s*channel: PAY_FREE_CHANNEL,\s*reference_number: payFreeReference\(payable\.code!\.code, payable\.reference\),/);
  // Never beside Maya, and fail closed on an unread answer.
  assert.match(CONFIRM, /if \(paymentsRead\.error \|\| maya === 'unread'\) refuse\('unchecked'\);\s*if \(maya === 'open'\) refuse\('maya_open'\);/);
  // ONCE: an already-sent bill writes nothing more; the row carries one fixed key per order; a duplicate press is not
  // an error and does not alert the admins a second time.
  const insertAt = CONFIRM.indexOf(".from('payments')\n    .insert(");
  assert.ok(insertAt > 0, 'premise: the ₱0 row is inserted');
  assert.ok(CONFIRM.indexOf('if (rows.some(paymentWasLogged)) redirect(`${here}?sent=1`);') < insertAt, 'a second press can write a second row');
  assert.match(CONFIRM, /client_idempotency_key: `voucher-zero-\$\{payable\.orderId\}`,/);
  assert.match(CONFIRM, /const duplicate = \(error as \{ code\?: string \} \| null\)\?\.code === '23505';\s*if \(error && !duplicate\) \{/);
  assert.match(CONFIRM, /if \(!error\) \{[\s\S]*?await notifyAdminsPaymentProofSubmitted\(\{ orderId: payable\.orderId, eventId: payable\.eventId \?\? '', amountPhp: 0, channel: PAY_FREE_CHANNEL \}\);\s*\}/);
  // Nothing activates here — the admin's approval is the only thing that marks it paid.
  assert.doesNotMatch(CONFIRM, /status: '(paid|matched)'|approvePaymentCore|activate/i);
  // The row reads as LOGGED (so it shows as a payment to review, not a bill's empty placeholder), and two orders on
  // the same code never share a reference.
  const ref = payFreeReference('FREE-100', 'SN-AB12');
  assert.equal(ref, 'FREE100SNAB12');
  assert.equal(paymentWasLogged({ status: 'pending', reference_number: ref, screenshot_url: null }), true);
  assert.notEqual(payFreeReference('FREE100', 'SNAAAA01'), payFreeReference('FREE100', 'SNAAAA02'));
});

test('?code_error= is a KEY from a fixed list — never words from the URL', () => {
  // Known keys → their message; anything else → nothing drawn.
  assert.equal(payCodeErrorFor('unchecked'), PAY_CODE_UNCHECKED);
  assert.equal(payCodeErrorFor('maya_open'), PAY_CODE_ERRORS.maya_open);
  for (const forged of ['Your account is locked — call 0917…', '<b>pay here</b>', 'constructor', '__proto__', 'toString', '', undefined, null, 7, ['unchecked']]) {
    assert.equal(payCodeErrorFor(forged), null, `a hand-made ?code_error=${String(forged)} was drawn`);
  }
  // The page draws ONLY through that lookup — the raw parameter never reaches the markup.
  assert.equal((PAGE.match(/search\.code_error/g) ?? []).length, (PAGE.match(/payCodeErrorFor\(search\.code_error\)/g) ?? []).length);
  assert.ok((PAGE.match(/payCodeErrorFor\(search\.code_error\)/g) ?? []).length >= 1);
  // The server sends keys only: no redirect builds ?code_error= from free text.
  assert.doesNotMatch(APPLY, /code_error=\$\{encodeURIComponent/);
  assert.match(APPLY, /redirect\(`\/pay\/\$\{encodeURIComponent\(reference\)\}\?code_error=\$\{key\}`\)/);
  // The voucher engine's own words map onto the list — its real sentences, and an unknown one.
  const VALIDATE = read('lib/vouchers/validate.ts');
  const reasons = [...VALIDATE.matchAll(/reason:\s*(['"`])((?:(?!\1).)+)\1/g)].map((m) => m[2]!);
  assert.ok(reasons.length >= 9, `only ${reasons.length} engine reasons found — the scan is broken`);
  for (const r of reasons) {
    const key = payCodeErrorKeyOfReason(r);
    assert.notEqual(key, 'not_usable', `the engine's "${r}" has no message of its own`);
    assert.ok(PAY_CODE_ERRORS[key]);
  }
  assert.equal(payCodeErrorKeyOfReason("We couldn't check that code right now. Please try again."), 'unchecked');
  assert.equal(payCodeErrorKeyOfReason('Some new sentence nobody mapped.'), 'not_usable');
  assert.equal(payCodeErrorKeyOfReason(null), 'unchecked');
  // Honest reads still hold across the whole list.
  for (const msg of Object.values(PAY_CODE_ERRORS)) assert.doesNotMatch(msg, /invalid/i);
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
  for (const src of [APPLY, BOX, read('lib/pay-code.ts')]) assert.doesNotMatch(stripComments(src), /invalid/i);
  assert.match(APPLY, /if \(orderRead\.error \|\| !orderRead\.data \|\| paymentsRead\.error \|\| maya === 'unread'\) unchecked\(\);/);
});
