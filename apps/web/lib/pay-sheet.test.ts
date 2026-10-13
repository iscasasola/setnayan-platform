/**
 * pay-sheet.test.ts — THE PAY SHEET LOADS AND PLACES; IT NEVER PAYS (owner
 * 2026-10-07; Suppliers PR4 "Pay sheet").
 *
 * The words are executed (`planNote`). The rest are the halves an executed test
 * cannot see — that the sheet mounts the ONE shipped payment card instead of a
 * second form, that its one request only reads, and that Pay on a row opens the
 * sheet rather than leaving the page.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { planNote, type PaySheetData } from './pay-sheet';

const VENDORS = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'vendors');
const code = (...p: string[]) => stripComments(readFileSync(join(VENDORS, ...p), 'utf8'));
const ACTION = code('_actions', 'pay-sheet.ts');
const SHEET = code('_components', 'pay-sheet.tsx');
const ROW = code('_components', 'booked-row.tsx');

const plan = (isDefaultSeeded: boolean): PaySheetData['plan'] => ({ steps: [], clearedAt: null, isDefaultSeeded });

test('the line under "Payment plan" says whose plan it is — and a refused read is never "No plan yet"', () => {
  assert.equal(planNote({ own: true, plan: plan(false), scheduleSource: 'plan' }, 'Seda'), 'Your record of what you agreed.');
  assert.equal(
    planNote({ own: false, plan: plan(false), scheduleSource: 'plan' }, 'Bituin'),
    'Bituin set up this plan; they confirm each payment as received.',
  );
  // The pencilled-in 50/50 is called an estimate, in both cases.
  assert.match(planNote({ own: true, plan: plan(true), scheduleSource: 'plan' }, 'Seda'), /pencils in a 50\/50 split/);
  assert.match(planNote({ own: false, plan: plan(true), scheduleSource: 'plan' }, 'Bituin'), /typical 50\/50 estimate\. Confirm the amounts and dates with Bituin/);
  assert.match(planNote({ own: false, plan: plan(true), scheduleSource: 'quote' }, 'Bituin'), /^From the quote you accepted\./);
  assert.equal(planNote({ own: false, plan: plan(false), scheduleSource: 'none' }, 'Bituin'), 'No plan yet.');
  assert.equal(
    planNote({ own: false, plan: 'unreadable', scheduleSource: 'none' }, 'Bituin'),
    'We couldn’t load the payment plan.',
    'a refused plan read was drawn as "No plan yet"',
  );
  // …but a quote still speaks when only the plan read failed.
  assert.match(planNote({ own: false, plan: 'unreadable', scheduleSource: 'quote' }, 'Bituin'), /^From the quote you accepted\./);
});

test('the one request READS: one export, the three shipped readers, and not one write', () => {
  assert.equal((ACTION.match(/^export async function /gm) ?? []).length, 1, 'the Pay sheet grew a second server action');
  assert.equal((ACTION.match(/^export /gm) ?? []).length, 1, 'a "use server" file may export only its action');
  for (const reader of ['readBookedMoney(', 'readPublishedMethodsForCouple(', 'fetchPlanProgressForCouple(']) {
    assert.ok(ACTION.includes(reader), `the sheet no longer reads through ${reader}`);
  }
  assert.doesNotMatch(ACTION, /\.insert\(|\.update\(|\.upsert\(|\.delete\(|\.rpc\(|revalidatePath|recordDeposit|logPayment/, 'the read writes');
  // The couple's own session decides whether the booking is theirs — before any admin read.
  assert.ok(ACTION.indexOf("if (!user) return { status: 'not_signed_in' }") > -1);
  assert.ok(
    ACTION.indexOf(".from('event_vendors')") < ACTION.indexOf('createAdminClient()'),
    'an admin client is reached before the couple’s own read of the booking',
  );
  // ONE schedule per booking, by the workspace's own rule.
  assert.match(ACTION, /paymentScheduleSource\(\{/);
  // A refused plan read is 'unreadable', never an empty plan.
  assert.match(ACTION, /fetchPlanProgressForCouple\(\{[^}]*\}\)\.catch\(\s*\(\) => 'unreadable' as const,?\s*\)/);
});

test('the sheet mounts the ONE shipped payment card and plan ladder — no second form, no second writer', () => {
  assert.equal((SHEET.match(/<DepositReservation\b/g) ?? []).length, 1);
  // The plan ladder is kind 26 (`PriceSummary`) since 2026-10-13 — ONE drawing,
  // the same fold the supplier's customer card reads (lib/price-summary.test.ts).
  assert.equal((SHEET.match(/<PriceSummary\b/g) ?? []).length, 1);
  assert.match(SHEET, /import \{ DepositReservation \} from '\.\.\/\[vendorId\]\/workspace\/_components\/deposit-reservation'/);
  assert.doesNotMatch(SHEET, /<form\b|<input\b|recordDeposit|logScheduledPayment|logPayment|FileUpload/, 'the sheet re-implements paying');
  // Every figure it prints itself goes through the app's money text.
  assert.match(SHEET, /pesoFromCentavos\(row\.amountCentavos\)/);
  assert.doesNotMatch(SHEET, /toLocaleString|toFixed\(/);
  // Loading, a failure and "not booked yet" are three different sentences — none of them an empty plan.
  for (const state of ['data-pay-loading', 'data-pay-failed', 'data-pay-not-booked']) {
    assert.ok(SHEET.includes(state), `the sheet lost its ${state} state`);
  }
  const failed = SHEET.slice(SHEET.indexOf("state.kind === 'failed'"), SHEET.indexOf("state.kind === 'not_booked'"));
  assert.match(failed, /We couldn’t load their payments/);
  assert.match(failed, /label="Try again"/);
  assert.doesNotMatch(failed, /No plan yet|DepositReservation/);
});

test('Pay and Payments on a row open the sheet in place — never a link to the workspace', () => {
  const pay = ROW.slice(ROW.indexOf("case 'payments':"), ROW.indexOf("case 'set_price':"));
  assert.ok(pay.length > 0, 'the pay verbs moved — re-anchor');
  assert.match(pay, /onClick=\{\(\) => setPaying\(true\)\}/);
  assert.doesNotMatch(pay, /href=/, 'Pay leaves the page again');
  assert.doesNotMatch(ROW, /depositStepHref|tab=payments/, 'a second payment door is back on the row');
  // Loaded on the first press, never with the page.
  assert.match(ROW, /const PaySheet = dynamic\(\(\) => import\('\.\/pay-sheet'\)/);
  assert.doesNotMatch(ROW, /from '\.\/pay-sheet'/, 'the Pay sheet is in the first load');
});
