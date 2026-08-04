#!/usr/bin/env node
/**
 * lint-booking-fee-single-trigger.mjs
 *
 * THE BOOKING FEE MUST FIRE FROM EXACTLY ONE PLACE.
 *
 * Owner ruling 2026-07-27 (DECISION_LOG "lock handshake" row; spec
 * Explore_Replan_BUILD_SPEC_2026-07-27 §7 PR-I): the vendor is billed when they
 * ACCEPT THE CUSTOMER'S PAYMENT, not when the couple locks.
 *
 * WHY A GUARD AND NOT A COMMENT: before 2026-08-03 the fee fired from THREE
 * lock sites (finalizeVendor, lockPackage, the chat lock). Moving it meant
 * removing three and adding one — and leaving any single one behind
 * double-charges the vendor the day NEXT_PUBLIC_BOOKING_FEE_ENABLED flips.
 * Nothing would have caught that: the flag is off, so every path is a silent
 * no-op in CI and in prod. The bug would first appear as a real duplicate bill.
 *
 * This has now been ruled on FIVE times (the spec counts the lineage). Each
 * ruling was recorded properly and the code still drifted, because a decision
 * and a call site are not connected by anything. This is that connection.
 *
 * The check: exactly one non-test file may call `collectBookingFeeAtLock`, and
 * it must be the vendor's payment-acknowledge action. Its own module and the
 * dormant send-gate library are excluded — defining it is not calling it.
 *
 * Usage:
 *   pnpm --filter @setnayan/web lint:fee-trigger
 *   node apps/web/scripts/lint-booking-fee-single-trigger.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SYMBOL = 'collectBookingFeeAtLock';

/** The one permitted caller — the moment the owner ruled the fee belongs to. */
const CANONICAL_CALLER = 'app/vendor-dashboard/clients/[eventId]/actions.ts';

/**
 * Files that may NAME the symbol without being a trigger:
 *   - its own module (the definition)
 *   - booking-fee-charge.ts, which composes it for the DORMANT PayMongo
 *     send-gate (`bookingFeeSendGate`) — retired 2026-07-24, unremoved
 *   - this guard
 */
const DEFINITION_SITES = new Set([
  'lib/booking-fee-lock.server.ts',
  'lib/booking-fee-charge.ts',
  'scripts/lint-booking-fee-single-trigger.mjs',
]);

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '.turbo']);

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(full);
  }
  return out;
}

const callers = [];
for (const root of ['app', 'lib', 'scripts']) {
  const abs = join(WEB_ROOT, root);
  let files = [];
  try {
    files = walk(abs);
  } catch {
    continue;
  }
  for (const file of files) {
    const rel = relative(WEB_ROOT, file);
    if (DEFINITION_SITES.has(rel)) continue;
    if (/\.test\.[tm]?[jt]sx?$/.test(rel)) continue;

    const src = readFileSync(file, 'utf8');
    // A CALL, not a mention: the symbol followed by an opening paren. Comments
    // naming it (the three "no longer fires here" notes) must not trip this.
    const withoutComments = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    if (new RegExp(`\\b${SYMBOL}\\s*\\(`).test(withoutComments)) callers.push(rel);
  }
}

const errors = [];

if (callers.length === 0) {
  errors.push(
    `NOTHING calls ${SYMBOL}. The booking fee can never be charged.\n` +
      `    → if the fee was retired, delete this guard in the same commit; a guard ` +
      `that cannot fail is worse than none.`,
  );
} else if (callers.length > 1) {
  errors.push(
    `${SYMBOL} is called from ${callers.length} places:\n` +
      callers.map((c) => `        - ${c}`).join('\n') +
      `\n    → the fee must fire ONCE. Two live call sites means the vendor is billed ` +
      `TWICE the day NEXT_PUBLIC_BOOKING_FEE_ENABLED flips, and the flag being off ` +
      `today is exactly why no test would catch it.`,
  );
} else if (callers[0] !== CANONICAL_CALLER) {
  errors.push(
    `${SYMBOL} is called from ${callers[0]}, not ${CANONICAL_CALLER}.\n` +
      `    → owner ruling 2026-07-27: the vendor is billed when they ACCEPT THE ` +
      `PAYMENT, not at the couple's lock. If the moment moved again, update ` +
      `CANONICAL_CALLER here and say so in the DECISION_LOG — that would be the ` +
      `SIXTH ruling in this lineage.`,
  );
}

if (errors.length > 0) {
  console.error('\n❌ Booking-fee single-trigger guard failed:\n');
  for (const e of errors) console.error('  • ' + e + '\n');
  process.exit(1);
}

console.log(`✅ Booking-fee single-trigger guard passed (${CANONICAL_CALLER}).`);
