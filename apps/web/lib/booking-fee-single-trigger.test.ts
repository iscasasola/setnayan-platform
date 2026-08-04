/**
 * booking-fee-single-trigger.test.ts — the fee has ONE trigger, and this proves it.
 *
 * ─── Why a repo scan, and not a comment ──────────────────────────────────
 * The owner has ruled on WHEN the syncing fee fires **five times**. Each ruling
 * was recorded properly in `DECISION_LOG.md`, and the code still drifted —
 * because a decision and a call site are not connected by anything. Ruling 4
 * (2026-07-24, "bill at the lock") stayed in the code for nine days after
 * ruling 5 (2026-07-27, "billed alongside accepting") superseded it.
 *
 * ─── The failure this catches ────────────────────────────────────────────
 * Moving the trigger meant THREE removals and ONE addition, on money, while
 * `NEXT_PUBLIC_BOOKING_FEE_ENABLED` is armed in prod. Leave one lock site
 * behind and the vendor is billed TWICE for the same booking — once at the
 * lock, once at acknowledge — and **nothing else would notice**, because with
 * no marketplace-linked bookings yet every path is a silent no-op in CI and in
 * prod alike. The first sighting of the bug would be a real duplicate invoice
 * sent to a real vendor.
 *
 * The three sites were not equally visible, either. `lib/chat-lock-booking.server.ts`
 * bills from a CHAT message rather than a lock screen, so a sweep of the
 * vendors surface walks straight past it.
 *
 * ─── It fails in BOTH directions, on purpose ─────────────────────────────
 * Too many callers → double billing. Zero callers → a fee that can never be
 * charged, which is just as wrong and considerably quieter. A guard that only
 * catches one direction would have passed on an empty file.
 *
 * (The scanning approach is the one the parallel session proposed on PR #4082;
 * adopted here because it is a better mechanism for this specific risk than a
 * feature-flag registry entry.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

/** The collector itself — declares the function, does not call it. */
const DEFINITION = 'lib/booking-fee-lock.server.ts';

/**
 * THE canonical caller. Owner ruling 2026-07-27, reaffirmed 2026-08-03:
 * *"vendor will confirm the payment. confirming it will lead them to the
 * booking fee."*
 *
 * A SIXTH ruling has to change this line and say why — which is the entire
 * point of writing it down here rather than in prose.
 */
const CANONICAL_CALLER = 'app/vendor-dashboard/clients/[eventId]/actions.ts';

/** Strip comments — the three "no fee here any more" notes must not read as calls. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const ALL = ['app', 'lib'].flatMap((r) => walk(resolve(WEB, r)));

/** Files that actually INVOKE the collector — `collectBookingFeeAtLock(`. */
function callers(): string[] {
  return ALL.map((f) => relative(WEB, f))
    .filter((rel) => !/\.test\.tsx?$/.test(rel))
    .filter((rel) => rel !== DEFINITION)
    .filter((rel) => /collectBookingFeeAtLock\s*\(/.test(code(readFileSync(resolve(WEB, rel), 'utf8'))));
}

test('the booking fee has EXACTLY ONE non-test call site', () => {
  const found = callers();
  assert.deepEqual(
    found,
    [CANONICAL_CALLER],
    `The syncing fee must be collected in exactly one place — ${CANONICAL_CALLER} ` +
      `(the vendor accepting the payment; owner 2026-07-27, ruling 5 of 5).\n` +
      `Found: ${found.join(', ') || 'NOTHING'}.\n\n` +
      `• MORE than one → the same booking bills twice, and which routes bill ` +
      `depends only on how the couple got there. The three sites that used to ` +
      `bill were finalizeVendor, lockPackage, and the CHAT lock.\n` +
      `• NONE → the fee can never be charged at all.\n\n` +
      `If a SIXTH ruling moved the trigger, change CANONICAL_CALLER in this file ` +
      `and log the decision — do not delete the assertion.`,
  );
});

test('the canonical caller is the ACKNOWLEDGE action, not some other export in that file', () => {
  const src = code(readFileSync(resolve(WEB, CANONICAL_CALLER), 'utf8'));
  const idx = src.indexOf('collectBookingFeeAtLock(');
  assert.ok(idx > 0, 'no call found in the canonical caller');

  // The call must sit inside vendorAcknowledgeDeposit — the file also exports
  // vendorRejectDeposit and several unrelated vendor actions, and billing from
  // any of those would satisfy a naive file-level check while being wrong.
  const before = src.slice(0, idx);
  const fnIdx = before.lastIndexOf('export async function ');
  const fnName = before.slice(fnIdx).match(/export async function (\w+)/)?.[1];
  assert.equal(
    fnName,
    'vendorAcknowledgeDeposit',
    `the fee must be collected in vendorAcknowledgeDeposit, not ${fnName} — ` +
      `the ruling is "billed alongside ACCEPTING the payment", and reject/other ` +
      `actions in this file must never charge.`,
  );
});

test('the fee resolves the ANCHOR row before charging', () => {
  // A package is N rows and only the anchor carries money. Billing a covered
  // cascade row freezes a ledger ordinal and burns a free booking permanently.
  const src = code(readFileSync(resolve(WEB, CANONICAL_CALLER), 'utf8'));
  const anchorIdx = src.indexOf('resolveFeeAnchorRowId(');
  const feeIdx = src.indexOf('collectBookingFeeAtLock(');
  assert.ok(anchorIdx > 0, 'the anchor must be resolved before the fee is collected');
  assert.ok(
    anchorIdx < feeIdx,
    'resolveFeeAnchorRowId must run BEFORE collectBookingFeeAtLock — resolving ' +
      'afterwards bills first and asks questions later.',
  );
});

test('the scan actually scanned something', () => {
  // A roots change that silently emptied ALL would make every assertion above
  // pass vacuously — including the "exactly one" one, which would then be
  // asserting over an empty list and failing for the wrong reason.
  assert.ok(ALL.length > 500, `only ${ALL.length} files walked — the roots are wrong`);
});
