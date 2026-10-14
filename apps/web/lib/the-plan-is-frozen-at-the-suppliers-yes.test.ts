/**
 * the-plan-is-frozen-at-the-suppliers-yes.test.ts — THE WIRING half.
 *
 * `tests/db/the-plan-is-frozen-at-the-suppliers-yes.db.test.ts` EXECUTES the
 * shared function against the replayed schema. What it cannot run is the two
 * server actions that call it (cookies, redirect). This file pins those two
 * calls, so the executed proof stays attached to the product:
 *
 *   · `vendorAgreeToLock` freezes the plan exactly when `vendor_agree_to_lock`
 *     answered `ok` — the condition the db test's `pressYes` restates — with the
 *     REAL emitter (no override), in its own try so neither notice can undo the
 *     other;
 *   · `finalizeVendor` still freezes it on the direct path, below the ask's
 *     return, telling the acting host;
 *   · there is ONE implementation: nothing else writes the snapshot.
 *
 * SABOTAGE (each seen red, restored): freeze on `already` too · drop the yes
 * call · drop the direct call · hand the yes path a fake emitter · add a second
 * upsert of the plan in the actions file.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
function body(rel: string, fn: string): string {
  const src = code(rel);
  const at = src.indexOf(`export async function ${fn}(`);
  assert.ok(at > -1, `${fn} is gone from ${rel} — was it renamed?`);
  const next = src.indexOf('\nexport ', at + 1);
  return src.slice(at, next === -1 ? undefined : next);
}

const SUPPLIER = 'app/vendor-dashboard/clients/[eventId]/actions.ts';
const COUPLE = 'app/dashboard/[eventId]/vendors/actions.ts';
const PLAN = 'lib/booking-payment-plan.server.ts';

test('the yes freezes the plan — on `ok`, and on nothing else', () => {
  const fn = body(SUPPLIER, 'vendorAgreeToLock');
  const when = [...fn.matchAll(/if \(([^)]*)\) \{\s*try \{\s*await freezePaymentPlanAfterSupplierAgreed\(/g)].map((m) => m[1]!);
  console.log(`# vendorAgreeToLock freezes the plan when → ${JSON.stringify(when)}`);
  assert.deepEqual(when, ["!error && env.status === 'ok' && eventId"], 'the plan must be frozen exactly when the function answered ok');
  // The real emitter — EXCEPT while the fee the yes just made is billed and
  // unpaid (owner 2026-10-07 "no handshake, no confirmation … no booking fee
  // paid to us"; 2026-10-12 #1): then "your booking is confirmed" waits for the
  // fee to settle and `tellCoupleTheBookingIsConfirmed` sends the confirmation.
  // ONLY that one condition may silence it; `undefined` is the real emitter.
  assert.match(
    fn,
    /await freezePaymentPlanAfterSupplierAgreed\(\s*createAdminClient\(\),\s*\{ eventId, eventVendorId \},\s*feeBilledUnpaid \? \{ emit: async \(\) => \{\} \} : undefined,\s*\);/,
    'the yes path overrides the emitter (or changed its arguments) — the notice may never be sent',
  );
  // After the function ran, never before.
  assert.ok(
    fn.indexOf('await freezePaymentPlanAfterSupplierAgreed(') > fn.indexOf("supabase.rpc('vendor_agree_to_lock'"),
    'the plan is frozen before the supplier agreed',
  );
  // The decline door books nothing and must freeze nothing.
  assert.ok(!body(SUPPLIER, 'vendorDeclineLock').includes('freezePaymentPlan'), 'a decline freezes a payment plan');
});

test('the direct lock still freezes the plan — below the ask, telling the host who pressed', () => {
  const fn = body(COUPLE, 'finalizeVendor');
  const calls = fn.split('await freezePaymentPlanAtBooking(').length - 1;
  assert.equal(calls, 1, `finalizeVendor must freeze the plan exactly once, found ${calls}`);
  const call = fn.indexOf('await freezePaymentPlanAtBooking(');
  assert.ok(call > fn.indexOf("status: 'lock_requested',"), 'the plan is frozen before the ask returns');
  const args = fn.slice(call, call + 600);
  assert.match(args, /tellUserId: user\.id,/, 'the direct path no longer tells the person who pressed');
  assert.doesNotMatch(args, /\},\s*\{\s*emit/, 'the direct path overrides the emitter');
});

test('the yes path reads who asked off the row — and tells nobody when nobody is recorded', () => {
  const src = code(PLAN);
  const fn = src.slice(src.indexOf('export async function freezePaymentPlanAfterSupplierAgreed('));
  assert.match(fn, /tellUserId: row\.lock_requested_by_user_id,/, 'the yes path no longer tells the recorded asker');
  assert.match(fn, /if \(row\.event_vendor_package_id\) return \{ status: 'skipped', reason: 'package_booking' \};/, 'a package row is no longer left alone');
  // The default emitter is the real one.
  assert.equal(src.split('deps: { emit: Emit } = { emit: emitNotification }').length - 1, 2, 'a caller with no override would not send the real notice');
});

test('ONE implementation: nothing outside the shared function writes the snapshot', () => {
  const walk = (dir: string, out: string[] = []): string[] => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next') continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p, out);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
    }
    return out;
  };
  const writers: string[] = [];
  const tellers: string[] = [];
  for (const abs of [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))]) {
    const src = stripComments(readFileSync(abs, 'utf8'));
    const rel = relative(WEB, abs).split(sep).join('/');
    if (/from\('event_vendor_payment_plan'\)\s*\.upsert\(/.test(src)) writers.push(rel);
    if (/type: 'payment_info_sent'/.test(src)) tellers.push(rel);
  }
  console.log(`# plan upserts: ${writers.join(', ')} · payment_info_sent: ${tellers.join(', ')}`);
  // The couple's own plan for a supplier they added is the one other writer,
  // and it is a different act (they typed it) — it sends no "ready" notice.
  assert.deepEqual(
    writers.sort(),
    ['app/dashboard/[eventId]/vendors/[vendorId]/workspace/payment-plan-actions.ts', PLAN].sort(),
    'a second place freezes a payment plan — the two doors would drift apart again',
  );
  assert.deepEqual(tellers, [PLAN], 'a second place announces the payment plan');
});
