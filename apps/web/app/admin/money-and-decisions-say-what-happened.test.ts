/**
 * money-and-decisions-say-what-happened.test.ts — final check area 8, batch 8
 * (checker 8-1). Money desks, disputes and deletions: a refusal is said on the
 * page (never the crash page, whose message a production build hides), a
 * failed read is said (never 0 or "nobody has"), and the words are true.
 *
 * Paired unit tests: lib/receipt-months.test.ts (A-7, A-22),
 * lib/read-every-page.test.ts (D-11), lib/admin/verify-back.test.ts (E-9).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { disputesOutcomeLine } from './disputes/_components/outcome-line';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function body(src: string, name: string): string {
  const at = src.search(new RegExp(`(?:^|\\n)(?:export )?(?:async )?function ${name}\\(`));
  assert.ok(at >= 0, `${name} not found`);
  const rest = src.slice(at + 1);
  const next = rest.search(/\n(?:export )?(?:async )?function /);
  return next < 0 ? src.slice(at) : src.slice(at, at + 1 + next);
}

test('A8·A-2 · refund, reject, ask-again and confirm-total refusals land on the desk as a notice', () => {
  const s = read('app/admin/payments/actions.ts');
  for (const fn of ['refundOrder', 'rejectPayment', 'requestPaymentResubmit', 'confirmOrderTotal']) {
    assert.match(
      body(s, fn),
      new RegExp(`return sayRefusalOnTheDesk\\(formData, \\(\\) => ${fn}Core\\(formData\\)\\)`),
      `${fn} must say its refusal on the desk`,
    );
  }
  const say = body(s, 'sayRefusalOnTheDesk');
  assert.match(say, /if \(isRedirectError\(err\) \|\| !\(err instanceof Error\)\) throw err;/, 'redirects pass straight through');
  assert.match(say, /notice=\$\{encodeURIComponent\(err\.message\)\}&noticeType=warn/, 'the sentence reaches the opened payment');
  assert.match(say, /deskUrl\(deskQuery\(formData\.get\('q'\)\), err\.message, true\)/);
  // The desk's own "Not received" calls the cores, so its throw still reaches its own handler.
  assert.match(s, /await requestPaymentResubmitCore\(fd\);[\s\S]*?await rejectPaymentCore\(fd\);/);
  // Work shows the refusal in its own place, so it asks for the throw.
  assert.match(read('app/admin/work/actions.ts'), /fd\.set\('refusal', 'throw'\);\s*try \{\s*await requestPaymentResubmit\(fd\);/);
});

test('A8·A-18 · "Read it" returns to the same opened payment, and a refused read is said', () => {
  const b = body(read('app/admin/payments/actions.ts'), 'rereadPaymentReceipt');
  assert.match(b, /const back = `\/admin\/payments\?open=\$\{encodeURIComponent\(paymentId\)\}`;/);
  assert.match(b, /if \(readError\) \{[\s\S]*?redirect\(`\$\{back\}&notice=/);
  assert.doesNotMatch(b, /redirect\('\/admin\/payments'\)/, 'never the bare list');
  assert.match(b, /redirect\(back\);\s*\}?\s*$/);
});

test('A8·A-20 · a failed same-day or reader read is "couldn’t read", never 0 or "Nobody has read"', () => {
  const page = read('app/admin/payments/page.tsx');
  assert.match(page, /readFailed \|\| sameDayRead === null\s*\?\s*null/, 'Event today shows — on a failed read');
  const same = body(page, 'fetchSameDayOrderIds');
  assert.match(same, /Promise<Set<string> \| null>/);
  assert.match(same, /if \(error \|\| !Array\.isArray\(data\)\) return null;/);
  assert.match(page, /if \(readsErr\) \{[\s\S]*?receiptReads = null;/);
  const desk = read('app/admin/payments/_components/desk.tsx');
  assert.match(desk, /read=\{receiptReads \? receiptReads\[p\.payment_id\] : 'unread'\}/);
  assert.match(desk, /unread\s*\?\s*'Couldn’t read what the reader saw\. Refresh to try again\.'/);
});

test('A8·A-5 · no peso figure is typed into the receiving-accounts page', () => {
  const s = read('app/admin/settings/payment-methods/page.tsx');
  assert.doesNotMatch(s, /&#8369;\s*\d|₱\s*\d/, 'a typed peso amount');
  assert.doesNotMatch(s, /placeholder=(?:"|\{[^}]*')\d{3,}["']/, 'a peso placeholder (digits only)');
});

test('A8·A-8 · Money and Receipts say when their totals cover the newest rows only', () => {
  const ledger = read('app/admin/money/_components/transactions-ledger.tsx');
  assert.match(ledger, /const capped = rows !== null && rows\.length >= ROW_LIMIT;/);
  for (const label of ['Received', 'Waiting', 'Purchases']) {
    assert.match(ledger, new RegExp(`label: \`${label}\\$\\{capScope\\}\``), `${label} names the cap`);
  }
  assert.match(ledger, /data-ledger-capped=""/, 'the phone list says it too');
  const receipts = read('app/admin/receipts/page.tsx');
  for (const label of ['Receipts', 'Pre-VAT sales', 'VAT collected', 'Gross']) {
    assert.match(receipts, new RegExp(`label: \`${label}\\$\\{scope\\}\``), `${label} names the cap`);
  }
});

test('A8·D-12 · the user Delete and Blacklist confirms describe the erasure that runs', () => {
  for (const f of ['app/admin/accounts/_surfaces/users-surface.tsx', 'app/admin/users/[userId]/page.tsx']) {
    const s = read(f);
    assert.doesNotMatch(s, /cascade-deletes|hard-deleted|Hard-delete/, `${f} promises a hard delete`);
    assert.match(s, /\$\{ERASURE_WORDS\}/, `${f} reads the one erasure sentence`);
  }
  assert.match(read('app/admin/account-deletions/page.tsx'), /from '@\/lib\/erasure\/erasure-words'/);
});

test('A8·D-13 · the Demo tab makes one true statement and names where its links go', () => {
  const s = read('app/admin/accounts/_surfaces/demo-vendors-surface.tsx');
  assert.doesNotMatch(s, /hidden from the public marketplace|hidden from real visitors/);
  assert.doesNotMatch(s, /to any \/vendors URL|\/explore\?demo=1|PR 1/);
  assert.match(s, /Marketplace on Discover/);
});

test('A8·D-14 · Team presses say what happened and never open a second request', () => {
  const s = read('app/admin/team/team-ops.server.ts');
  for (const fn of ['addAdminOp', 'saveAdminAreasOp', 'takeAllAreasAwayOp']) {
    assert.match(body(s, fn), /backToTeam\(/, `${fn} gives no sign`);
  }
  assert.match(body(s, 'backToTeam'), /\/admin\/team\?saved=1&msg=/);
  const add = body(s, 'addAdminOp');
  const pending = add.indexOf("pendingRequestFor(admin, 'grant_team_member'");
  assert.ok(pending > 0 && pending < add.indexOf(".from('admin_approval_requests')"), 'the pending check comes before the insert');
  const esc = body(s, 'raiseEscalatedRequest');
  assert.ok(esc.indexOf("pendingRequestFor(admin, 'grant_admin_escalated'") < esc.indexOf('.insert('));
});

test('A8·E-1 · every settle and decide flag the actions send is said on Disputes', () => {
  for (const flag of ['ok', 'resolved', 'already', 'no_dispute', 'not_found', 'needs_notes', 'invalid']) {
    assert.ok(disputesOutcomeLine(flag, undefined), `settled=${flag} says nothing`);
  }
  for (const flag of ['accepted', 'rejected', 'already', 'no_dispute', 'not_admin']) {
    assert.ok(disputesOutcomeLine(undefined, flag), `fee_dispute=${flag} says nothing`);
  }
  assert.equal(disputesOutcomeLine(undefined, 'error'), null, 'the fee section already says error in place');
  assert.equal(disputesOutcomeLine('anything-else', undefined), null);
  assert.equal(disputesOutcomeLine('already')?.tone, 'warn');
  // Every flag an action really sends is one the line knows.
  const actions = read('app/admin/disputes/actions.ts');
  for (const m of actions.matchAll(/settled=([a-z_]+)/g)) {
    assert.ok(disputesOutcomeLine(m[1]), `settled=${m[1]} is sent but never said`);
  }
  const page = read('app/admin/disputes/page.tsx');
  assert.match(page, /disputesOutcomeLine\(search\.settled, search\.fee_dispute\)/);
  assert.match(page, /settled\?: string;/);
});

test('A8·E-13 · Disputes, Completions and Fraud refusals are said on the page, not thrown', () => {
  const d = body(read('app/admin/disputes/actions.ts'), 'resolveDispute');
  assert.doesNotMatch(d, /throw new Error\('(Invalid input|Pick a resolution|Dispute not found)'|Dispute already resolved/);
  assert.match(d, /settled=\$\{existing \? 'already' : 'not_found'\}/);
  const c = read('app/admin/completions/actions.ts');
  for (const fn of ['forceCompleteVendor', 'upholdNonDelivery']) {
    assert.doesNotMatch(body(c, fn), /throw new Error/, `${fn} still throws`);
  }
  assert.match(body(c, 'refuse'), /\/admin\/completions\?error=1&msg=/);
  const f = body(read('app/admin/fraud/actions.ts'), 'unsuspendVendor');
  assert.doesNotMatch(f, /throw new Error\('Supplier is not currently auto-suspended/);
  assert.match(f, /\/admin\/fraud\?error=1&msg=/);
});

test('A8·E-5 · a flag whose booking, couple or handler could not be read says so', () => {
  const s = read('app/admin/force-majeure/[flagId]/page.tsx');
  assert.match(s, /vendorUnread \? \(\s*<span className="text-ink\/55">Couldn&rsquo;t read the booking<\/span>\s*\) : \(\s*<span className="text-ink\/65">Whole event<\/span>/);
  assert.match(s, /handlerUnread \? \([\s\S]{0,80}Couldn&rsquo;t read[\s\S]{0,120}Unassigned/);
  assert.match(s, /vendorUnread \? \(\s*<Field label="Deposit"/);
  assert.doesNotMatch(s, /depositProofDisplayUrl\([^)]*\)\.catch\(\(\) => null\)/, 'the receipt is not hidden silently');
});

test('A8·E-8 · verification-doc presses use the shared admin gate and say a refusal on the page', () => {
  const s = read('app/admin/verification-docs/actions.ts');
  assert.doesNotMatch(s, /redirect\('\/'\)/, 'never the public home page');
  assert.doesNotMatch(s, /\.select\('is_internal'\)/, 'no narrower hand-rolled admin check');
  const gate = body(s, 'requireAdmin');
  assert.match(gate, /await requireAdminAction\(\);/);
  assert.match(gate, /adminCanRefusal\('verification', level\)/);
  assert.match(gate, /\/admin\/verification-docs\?error=1&msg=/);
});
