import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openShopErrorField, refusalStep } from '@/lib/open-shop-error-field';
import { OPEN_SHOP_ACCOUNT_ERRORS } from '@/lib/open-shop-account';
import { OPEN_SHOP_ERRORS } from '@/lib/open-shop-validation';
import { stripComments } from '@/lib/strip-comments';

/**
 * THE 16 NOV 2026 SUPPLIER WALK (W1) — the open-shop door's faults.
 *
 * W1-B3 (sign-up blocker): a password the server refused as breached redirected to `/open-shop?step=5&error=…`, and
 * the page drew ANOTHER step with no sentence anywhere. The redirect of a server action is a soft navigation onto the
 * same page, so the wizard was not remounted and its `useState` seeds (`step`, the refusal) never ran again.
 * Sabotage: drop the `refusalStamp` effect, or let `refusalStep` return the server's step for a boxed field → red.
 *
 * W1-B4: the "check your inbox" screen put the email address in the URL (`?check_inbox=you@…`).
 */
const WEB = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
const WIZARD = stripComments(read('app/open-shop/_components/open-shop-wizard.tsx'));
const PAGE = stripComments(read('app/open-shop/page.tsx'));
const PW = read('app/_components/password-field.tsx');

test('W1-B3 · a breached-password refusal is drawn on the account step, whatever step the URL names', () => {
  const field = openShopErrorField(OPEN_SHOP_ACCOUNT_ERRORS.passwordLeaked);
  assert.equal(field, 'password');
  for (const fromServer of [1, 2, 3, 4, 5, undefined]) assert.equal(refusalStep(field, fromServer), 5);
  // Every boxed refusal is drawn on its box's step; a sentence no box owns keeps the server's step.
  assert.equal(refusalStep(openShopErrorField(OPEN_SHOP_ERRORS.contactName), 5), 4);
  assert.equal(refusalStep(openShopErrorField(OPEN_SHOP_ACCOUNT_ERRORS.accountFailed), 5), 5);
  assert.equal(refusalStep(null, undefined), 1);
});

test('W1-B3 · a refusal that arrives WITHOUT a remount is still shown — the page stamps it, the wizard applies it', () => {
  assert.match(PAGE, /refusalStamp=\{error \? Date\.now\(\) : 0\}/, 'the page no longer stamps each refused render');
  assert.match(WIZARD, /useState<Step>\(refusalStep\(openShopErrorField\(error\), initialStep\)\)/);
  const effect = WIZARD.slice(WIZARD.indexOf('const seenRefusal = useRef(refusalStamp)'));
  assert.ok(effect.length > 0 && WIZARD.includes('const seenRefusal = useRef(refusalStamp)'), 'the refusal effect is gone');
  const body = effect.slice(0, effect.indexOf('}, [error, refusalStamp]);'));
  assert.ok(body.length > 0, 'the effect no longer re-runs on a new refusal');
  assert.match(body, /setBanner\(error\)/, 'the sentence is not put back under its box');
  assert.match(body, /setStep\(refusalStep\(field, initialStep\)\)/, 'the step that owns the box is not shown');
  assert.match(body, /setAcctEmail\(true\)/, 'the email + password boxes stay folded away');
});

test('W1-B3 · the account step says the leak rule in /reset-password\'s words, red when the server refused it', () => {
  const quiet = PW.slice(PW.indexOf('function QuietRule'));
  assert.match(quiet, /<LeakRuleWords failed=\{leaked\} \/>/);
  const words = PW.slice(PW.indexOf('function LeakRuleWords'), PW.indexOf('function Rule('));
  assert.match(words, /Not a known leaked password <span className="opacity-70">· checked when you continue<\/span>/);
  // The meter (/reset-password) and the quiet rule (open-shop) share the ONE sentence.
  assert.equal((PW.match(/Not a known leaked password/g) ?? []).length, 1, 'the leak sentence is typed twice');
  assert.match(WIZARD, /leaked=\{banner === OPEN_SHOP_ACCOUNT_ERRORS\.passwordLeaked\}/);
});

test('W1-B4 · the check-your-email screen never puts the address in the URL — a cookie carries it', async () => {
  const { CHECK_INBOX_FLAG, sentToFromCookie } = await import('@/lib/open-shop-sent-to');
  assert.equal(CHECK_INBOX_FLAG, '1');
  assert.equal(sentToFromCookie(' you@shop.ph '), 'you@shop.ph');
  assert.equal(sentToFromCookie(''), null);
  assert.equal(sentToFromCookie(undefined), null);
  const actions = stripComments(read('app/open-shop/actions.ts'));
  const claim = stripComments(read('app/open-shop/claim-actions.ts'));
  for (const [name, src] of [['actions.ts', actions], ['claim-actions.ts', claim]] as const) {
    assert.doesNotMatch(src, /check_inbox=\$\{encodeURIComponent\(/, `${name} puts the email back in the URL`);
    assert.match(src, /await parkSentTo\([^)]+\);\s*redirect\([^)]*check_inbox=\$\{CHECK_INBOX_FLAG\}/, `${name} does not park the address first`);
  }
  assert.match(PAGE, /const sentTo = checkInbox \? \(\(await readSentTo\(\)\) \?\? 'your email'\) : null;/);
  assert.doesNotMatch(PAGE, /checkInbox\.(trim|slice)\(/, 'the page draws the address from the URL again');
});

test('W1-B2 · every service button under an opened category carries its own accessible name', () => {
  const picker = read('app/_components/service-picker.tsx');
  const fn = picker.slice(picker.indexOf('export function serviceRowName'), picker.indexOf('export function serviceRowName') + 400);
  assert.match(fn, /leaf\.label\.trim\(\) \|\| leaf\.canonicalService/, 'a row with no label has no name');
  // The one row builder (`row(leaf, path)`) is the only <button> that picks a service — and it names itself.
  const rowButton = picker.slice(picker.indexOf('onClick={() => onPick(leaf)}') - 120, picker.indexOf('onClick={() => onPick(leaf)}') + 400);
  assert.match(rowButton, /aria-label=\{serviceRowName\(leaf, path\)\}/, 'the service row lost its name');
  assert.equal((picker.match(/onClick=\{\(\) => onPick\(leaf\)\}/g) ?? []).length, 1, 'a second, unnamed pick button appeared');
});

test('W1-B1 · the account step\'s "Have an account? Sign in" names /login once, with ONE query', () => {
  assert.match(WIZARD, /signInHref = '\/login\?next=%2Fopen-shop&as=vendor'/);
  const link = read('app/_components/auth/sign-in-here-link.tsx');
  assert.match(link, /signInFallbackHref\(href, here\)/);
});

test('W1-B23 · after "Open my shop — free" the sent screen arrives by a fresh load, never swapped in place', () => {
  // The submit marks the page…
  const gate = WIZARD.slice(WIZARD.indexOf('const submitGate = '), WIZARD.indexOf('const saveDraft = '));
  assert.match(gate, /submittedHere\.current = true;/, 'the submit no longer marks that the sent screen must load fresh');
  // …and with that mark the form stays drawn while the page reloads onto the sent screen.
  assert.match(WIZARD, /const hardLoading = Boolean\(sentTo\) && submittedHere\.current;/);
  assert.match(WIZARD, /if \(hardLoading\) window\.location\.replace\(window\.location\.href\);/);
  assert.match(WIZARD, /if \(sentTo && !hardLoading\) \{/, 'the sent screen is swapped in place over a settling submit again');
});

test('W1-B21 · the plan picked on /for-suppliers rides through the door and is offered once the shop opens', async () => {
  const { planOfferPath, parseSupplierPlan } = await import('@/lib/supplier-plan-offer');
  assert.equal(parseSupplierPlan('pro'), 'pro');
  assert.equal(parseSupplierPlan('gold'), null);
  assert.match(planOfferPath('pro') ?? '', /^\/vendor-dashboard\/subscription\?plan=pro#plan-sheet-/);
  assert.match(PAGE, /plan=\{parseSupplierPlan\(plan\)\}/, 'the page drops ?plan=');
  assert.match(PAGE, /redirect\(planOfferPath\(plan\) \?\? landing\)/);
  assert.match(WIZARD, /\{plan \? <input type="hidden" name="plan" value=\{plan\} \/> : null\}/, 'the form no longer posts the plan');
  const actions = stripComments(read('app/open-shop/actions.ts'));
  assert.match(actions, /const plan = parseSupplierPlan\(formData\.get\('plan'\)\);/);
  assert.match(actions, /redirect\(plan \? `\$\{OPEN_SHOP_LOGO_PATH\}\?plan=\$\{plan\}` : OPEN_SHOP_LOGO_PATH\);\s*redirect\(planOfferPath\(plan\) \?\? '\/vendor-dashboard'\);/);
  const logo = read('app/open-shop/logo/page.tsx');
  assert.match(logo, /doneHref=\{offer \?\? '\/vendor-dashboard'\}/);
  const card = read('app/open-shop/logo/_components/add-your-logo.tsx');
  assert.equal((card.match(/href=\{doneHref\}/g) ?? []).length, 2, 'Continue and Skip both go to the offer');
});
