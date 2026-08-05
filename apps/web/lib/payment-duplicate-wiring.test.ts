import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The duplicate rule must be REACHED, not merely written.
 *
 * 🪤 A CORRECT RULE NOBODY CALLS IS NO RULE — and it is the most convincing
 * kind of dead code, because its own unit tests are green. `payment-reference-
 * match.test.ts` proves the comparison is right; this proves the money path
 * actually consults it, at the only moment where consulting it helps.
 */

const ACTIONS = readFileSync(join(process.cwd(), 'app/admin/payments/actions.ts'), 'utf8');
const PAGE = readFileSync(join(process.cwd(), 'app/admin/payments/page.tsx'), 'utf8');

test('the approval path consults the rule', () => {
  assert.match(ACTIONS, /classifyDuplicate\(/, 'approvePaymentCore must call classifyDuplicate');
});

test('the check runs BEFORE the row is marked matched', () => {
  // 🔑 ORDER IS THE WHOLE THING. After the flip this row is itself "money
  // already counted", so it becomes its own duplicate — and refusing a payment
  // we have already counted is not a refusal, it is a confusing error after
  // the fact.
  const check = ACTIONS.indexOf('classifyDuplicate(');
  const flip = ACTIONS.indexOf("status: 'matched'");
  assert.ok(check > 0 && flip > 0, 'could not locate both the check and the flip');
  assert.ok(
    check < flip,
    'the duplicate check runs AFTER the payment is marked matched — by then it is too late',
  );
});

test('a same-order duplicate is refused with no way to override it', () => {
  // The blocking verdict must not read the acknowledgement flag at all. If it
  // ever does, one ticked box lets a single transfer be counted twice against
  // one bill and the shortfall guard adds it up into a false "fully paid".
  // Only the refuse BRANCH BODY, up to its closing brace — a fixed-width
  // window overshoots into the warn branch below and reads its
  // `acknowledgeDuplicate` as this branch's, which is a false alarm in the
  // guard rather than in the code.
  const blocking = ACTIONS.match(/verdict\.kind === 'refuse'\) \{[\s\S]*?\n      \}/);
  assert.ok(blocking, "the 'refuse' branch could not be found");
  assert.doesNotMatch(
    blocking[0],
    /acknowledgeDuplicate/,
    'the same-order refusal must not be unlockable by the acknowledgement box',
  );
});

test('a cross-order duplicate needs an explicit acknowledgement', () => {
  assert.match(
    ACTIONS,
    /verdict\.kind === 'warn' && !args\.acknowledgeDuplicate/,
    'a cross-order match must stop unless the admin explicitly acknowledged it',
  );
});

test('the acknowledgement has a surface the admin can actually reach', () => {
  // 🛡 A SIGN-OFF NEEDS A SURFACE. A flag only settable by editing a request
  // is a flag nobody can use, so the warning would become a dead end rather
  // than a decision.
  assert.match(
    PAGE,
    /name="acknowledge_duplicate"/,
    'the payments page must render the acknowledgement control',
  );
  assert.match(
    ACTIONS,
    /formData\.get\('acknowledge_duplicate'\)/,
    'the action must read the control the page renders',
  );
});

test('the acknowledgement is OFF by default', () => {
  const box = PAGE.match(/name="acknowledge_duplicate"[\s\S]{0,160}/);
  assert.ok(box, 'the acknowledgement control could not be found');
  assert.doesNotMatch(
    box[0],
    /defaultChecked/,
    'a pre-ticked acknowledgement is not an acknowledgement — it is a default',
  );
});

test('batch approval never acknowledges a duplicate', () => {
  // Batch is the one place nobody is reading. The cross-order case exists
  // precisely because a human must look at the bank app.
  const batch = ACTIONS.slice(ACTIONS.indexOf('batchApprovePayments'));
  const call = batch.match(/approvePaymentCore\(\{[\s\S]{0,300}?\}\)/);
  assert.ok(call, 'the batch call to approvePaymentCore could not be found');
  assert.doesNotMatch(
    call[0],
    /acknowledgeDuplicate/,
    'the batch path must not pass an acknowledgement — nobody is looking',
  );
});
