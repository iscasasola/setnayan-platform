/**
 * you-are-told-when-you-are-paid.test.ts
 *
 * ── What was missing ───────────────────────────────────────────────────────
 * Two moments matter in apply-then-pay, and only the first told anyone:
 *
 *   order SUBMITTED  → admins got an in-app notification (before money exists)
 *   payment LOGGED   → nobody was told at all
 *
 * The second is the one where real pesos have left a real bank account and a
 * customer is waiting for their purchase to switch on. `logPayment` wrote the
 * row, revalidated and redirected — the only trace was a queue somebody had to
 * already be looking at.
 *
 * 🔑 THE DAILY OPS DIGEST IS NOT THIS. It is a next-morning summary, it only
 * sends when a queue is non-empty, and it fires around 08:00 Manila. For "your
 * customer has paid", tomorrow is the wrong answer. The digest is the safety
 * net UNDER this alert, not a substitute — and it was the only thing standing
 * in for it.
 *
 * ⚠ AND AN IN-APP NOTIFICATION IS NOT AN ALERT EITHER. `emitNotification` only
 * emails types on an explicit allowlist; `order_awaiting_reconciliation` was
 * not on it, so even the notification that DID exist reached nobody who was not
 * already looking at the console. Adding the type is what makes it leave the
 * app — the notification and the allowlist are two halves of one mechanism, and
 * having only one of them is indistinguishable from having neither.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('logging a payment tells the people who can confirm it', () => {
  const src = read('app/dashboard/[eventId]/orders/actions.ts');
  const fn = src.slice(src.indexOf('export async function logPayment'));
  const body = fn.slice(0, fn.indexOf('\n}') + 2);
  assert.match(
    body,
    /await notifyAdminsPaymentProofSubmitted\(/,
    'the moment money moves must notify somebody',
  );
  // It must precede the SUCCESS redirect, or it never runs — `redirect()` throws
  // to unwind the request, so anything after it is dead code.
  //
  // ⚠ NOT `indexOf('redirect(')`: my first cut used that and failed, because it
  // found the `if (!user) redirect('/login')` guard at the top. There are THREE
  // redirects here — the auth guard, the idempotent-retry exit, and the real
  // success. Compare against the LAST one.
  const notifyAt = body.indexOf('notifyAdminsPaymentProofSubmitted');
  const finalRedirect = body.lastIndexOf('redirect(');
  assert.ok(notifyAt > -1 && notifyAt < finalRedirect, 'notify must precede the success redirect');
});

test('the duplicate-submit retry deliberately does NOT re-alert', () => {
  // 23505 + an idempotency key means the customer pressed submit twice and the
  // FIRST one already notified. Alerting again would train the reader to ignore
  // the alert, which is worse than not sending it.
  const src = read('app/dashboard/[eventId]/orders/actions.ts');
  const fn = src.slice(src.indexOf('export async function logPayment'));
  const body = fn.slice(0, fn.indexOf('\n}') + 2);
  const retryAt = body.indexOf("code === '23505'");
  const notifyAt = body.indexOf('notifyAdminsPaymentProofSubmitted');
  assert.ok(retryAt > -1, 'the idempotent-retry branch must still exist');
  assert.ok(notifyAt > retryAt, 'the retry exits before the notify — one payment, one alert');
});

test('the notifier reaches every admin, and cannot roll back the payment', () => {
  const src = read('lib/order-admin-notify.ts');
  const fn = src.slice(src.indexOf('export async function notifyAdminsPaymentProofSubmitted'));
  assert.match(
    fn,
    /is_internal\.eq\.true,is_team_member\.eq\.true,account_type\.eq\.admin/,
    'same admin set as its sibling — not a narrower copy',
  );
  // NOT just "a catch exists" — my first cut asserted that, and replacing the
  // handler body with `throw e` left the catch in place and the test green.
  // What matters is that the catch SWALLOWS.
  const handler = fn.slice(fn.indexOf('catch (e)'), fn.indexOf('catch (e)') + 260);
  assert.match(handler, /console\.error\(/, 'the failure must be logged');
  assert.doesNotMatch(
    handler,
    /throw\b/,
    'must fail soft: rethrowing would let a failed ALERT undo a recorded PAYMENT',
  );
});

test('the alert can actually LEAVE the app', () => {
  const src = read('lib/notification-emit.ts');
  const list = src.slice(src.indexOf('EMAIL_ENABLED_TYPES'), src.indexOf('EMAIL_ENABLED_TYPES') + 1400);
  assert.match(
    list,
    /'order_awaiting_reconciliation'/,
    'without the allowlist entry this is a tray badge only — nobody away from the console is told',
  );
});

test('the digest is still there as the net beneath it, not the alert itself', () => {
  // If someone later deletes the digest thinking this replaced it, the
  // "nobody was looking for three days" case comes back.
  const digest = read('lib/admin/digest-flush.ts');
  assert.match(digest, /admin_digest_enabled/, 'the daily net must survive');
});
