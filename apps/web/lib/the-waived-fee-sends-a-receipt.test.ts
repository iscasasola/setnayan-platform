/**
 * the-waived-fee-sends-a-receipt.test.ts — A FEE NOBODY WAS CHARGED STILL HAS
 * TO BE TOLD TO SOMEBODY.
 *
 * Owner, 2026-09-20: *"yes, add the email receipt for waived bookings."*
 *
 * 🔴 WHAT WAS BROKEN. A booking inside a shop's free 5 opens a
 * `booking_fee_charges` row with `status = 'waived_free5'` and then
 * `collectBookingFeeAtLock` returns `'free'` — BEFORE the `orders` insert. So
 * the waived path minted no order, no payment row, no admin queue entry, no
 * notification and no email. PR #5737 gave it three in-app surfaces; every one
 * of them reaches only a shop already at a console.
 *
 * 🔑 AND THE OBVIOUS SHORTCUT WAS THE TRAP. `order_quoted` is already wired and
 * already on the email allowlist — and it means "YOU HAVE AN ORDER TO PAY".
 * Aiming it at a waived charge would have emailed a supplier a fee they do not
 * owe. A wrong sentence delivered reliably is worse than the silence it
 * replaces, which is exactly why #5737 shipped the surfaces and stopped.
 *
 * 🔑 THE NOTIFICATION AND THE ALLOWLIST ARE TWO HALVES OF ONE MECHANISM; HAVING
 * ONE IS INDISTINGUISHABLE FROM HAVING NEITHER. And there is a THIRD half here
 * that the lock_request_* disaster did not have: a Postgres ENUM. A TS-only
 * union member typechecks, the INSERT is then refused, `emitNotification`
 * console.errors it by design so the lock still completes, and the only symptom
 * is a supplier who is never told. So this file checks all of it: the enum, the
 * union, the tray copy, the email allowlist, NON-membership of the suppression
 * set, the emit site, the idempotency key, and the words themselves.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  NOTIFICATION_TYPE_LABEL,
  NOTIFICATION_TYPE_TONE,
  type NotificationType,
} from './notifications';
import {
  waivedFeeCopy,
  waivedFeeReceiptCopy,
  freeBookingsLeftClause,
  type WaivedFeeCharge,
} from './booking-fee-disclosure';
import { vendorWaivedFeePath, VENDOR_BOOKING_FEES_PATH } from './vendor-booking-fees';
// 🔑 THE ONE STRIPPER. A hand-rolled two-replace regex opens a comment on any
// `/*` inside a string and blanks real code to the next close, so the set it
// parses can be missing members nobody can see. See lib/strip-comments.ts.
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const REPO = join(WEB, '..', '..');
const EMIT_SRC = readFileSync(join(HERE, 'notification-emit.ts'), 'utf8');
const LOCK_PATH = join(HERE, 'booking-fee-lock.server.ts');
const LOCK = readFileSync(LOCK_PATH, 'utf8');

const TYPE = 'booking_fee_waived';

/** The charge the owner actually drove: prod carries computed_fee_centavos 50850. */
const CHARGE: WaivedFeeCharge = {
  chargeId: '44f2b06b-f583-4a23-a81f-b21310e3c843',
  eventId: '2d4f1144-7816-4367-9c99-6ff0f9a6de10',
  coupleName: 'Rosa & Ben',
  computedPhp: 508.5,
  ordinal: 1,
  waivedOn: '2026-09-19',
};

/** Members of one Set literal in notification-emit.ts, comments stripped —
 *  a comment that DISCUSSES a type does not enable it. */
function setMembers(name: string): string[] {
  const at = EMIT_SRC.indexOf(`const ${name}`);
  assert.ok(at >= 0, `${name} not found — did the set move or get renamed?`);
  const body = stripComments(EMIT_SRC.slice(at, EMIT_SRC.indexOf(']);', at)));
  const members = [...body.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!).filter(Boolean);
  // Floor: an empty parse reports a perfectly clean sweep.
  assert.ok(members.length >= 3, `${name} parse floor: found ${members.length}`);
  return members;
}

/* ═══════════════════════════════════════════════════════════════════════════
   1 · THE CHANNEL — all three halves, or it reaches nobody
   ═══════════════════════════════════════════════════════════════════════════ */

test('the type is ENABLED IN THE DATABASE — the enum and the union are two halves', () => {
  // SABOTAGE: delete the ADD VALUE line → RED. A TS-only member typechecks and
  // then the INSERT is refused in silence.
  const files = readdirSync(join(REPO, 'supabase', 'migrations')).filter((f) =>
    f.endsWith(`notification_type_${TYPE}.sql`),
  );
  assert.equal(files.length, 1, `expected exactly one enum migration for ${TYPE}, found ${files.length}`);
  const migration = readFileSync(join(REPO, 'supabase', 'migrations', files[0]!), 'utf8');
  assert.ok(
    migration.includes(`ADD VALUE IF NOT EXISTS '${TYPE}'`),
    'the enum value migration does not add this label',
  );
  // Its own file, no transaction — Postgres forbids USING a new enum value in
  // the transaction that adds it.
  assert.ok(!/^\s*BEGIN;/m.test(migration), 'the enum migration is wrapped in a transaction');
});

test('it is on the EMAIL allowlist — an in-app badge reaches only a shop already looking', () => {
  // SABOTAGE: remove 'booking_fee_waived' from EMAIL_ENABLED_TYPES → RED.
  assert.ok(
    setMembers('EMAIL_ENABLED_TYPES').includes(TYPE),
    `${TYPE} is emitted but not email-enabled. A waived charge mints no order and no bill, ` +
      'so this notice plus the fee hub are the ENTIRE trace a shop has — and the hub half ' +
      'reaches precisely the suppliers who did not need telling.',
  );
});

test('and it is NOT in the set that would silently suppress it for every user', () => {
  const at = EMIT_SRC.indexOf('const MARKETING_GATED_EMAIL_TYPES');
  const gated = stripComments(EMIT_SRC.slice(at, EMIT_SRC.indexOf(']);', at)));
  const members = [...gated.matchAll(/'([a-z0-9_]+)'/g)].map((m) => m[1]!);
  assert.ok(
    !members.includes(TYPE),
    `${TYPE} is marketing-gated. marketing_opt_in is NOT NULL DEFAULT FALSE, so that ` +
      'suppresses the email for every user — the exact mistake that silenced all six ' +
      'lock_request_* types.',
  );
  // Vacuity: the slice really is the gated set, which really does hold the one
  // genuinely engagement-shaped type.
  assert.ok(members.includes('new_chapter_from_followed'), 'the sliced set is not the gated one');
});

test('it does not buzz a phone — good news about money nobody is asking for is not a 2am push', () => {
  assert.ok(!setMembers('PUSH_ENABLED_TYPES').includes(TYPE));
});

test('it has tray copy and a badge — a type with no label renders as its raw key', () => {
  const label = NOTIFICATION_TYPE_LABEL[TYPE as NotificationType];
  assert.ok(label && label.trim().length > 0, 'no label');
  assert.ok(!label.includes('_'), 'the label is the raw key');
  assert.ok(NOTIFICATION_TYPE_TONE[TYPE as NotificationType], 'no badge colour');
});

/* ═══════════════════════════════════════════════════════════════════════════
   2 · THE EMIT — exactly once, on the waived arm, never on the billable one
   ═══════════════════════════════════════════════════════════════════════════ */

test('it is actually EMITTED — a configured type nobody sends reaches nobody', () => {
  // 🔑 THE HALF THE ALLOWLIST TESTS CANNOT SEE. Membership proves the channel is
  // open; only the call site proves anything travels down it.
  const src = stripComments(LOCK);
  const hits = [...src.matchAll(new RegExp(`'${TYPE}'`, 'g'))].length;
  assert.equal(
    hits,
    1,
    `${TYPE} is passed as a type ${hits} times in booking-fee-lock.server.ts — expected exactly 1`,
  );
  assert.ok(src.includes('emitNotification'), 'the charge path emits nothing at all');
});

test('the receipt fires on the WAIVED arm, and the waived arm alone', () => {
  // SABOTAGE: move the sendWaivedFeeReceipt call below the `waived_free5`
  // return, or into the billable branch → RED.
  const src = stripComments(LOCK);
  const waivedArm = src.indexOf("res.status === 'waived_free5'");
  assert.ok(waivedArm > 0, 'the waived arm is gone — did the RPC status change?');
  const armEnd = src.indexOf("status: 'free'", waivedArm);
  assert.ok(armEnd > waivedArm, 'the waived arm no longer returns free');
  const arm = src.slice(waivedArm, armEnd);
  assert.ok(
    arm.includes('sendWaivedFeeReceipt'),
    'the waived arm returns without sending the receipt — the charge is opened, waived, and ' +
      'nobody is told, which is the whole defect this file exists to hold shut',
  );

  // And the BILLABLE path must never send it: that supplier owes real money and
  // gets `order_quoted` + a bill. A receipt saying "nothing is owed" landing on
  // a ₱837.50 charge is the failure in the other direction.
  //
  // ⚠ ANCHORED ON `armEnd`, NOT ON THE FIRST `status: 'free'` IN THE FILE. The
  // first one is the member of the `CollectBookingFeeResult` union near the top,
  // so slicing from it swallowed the waived arm itself and this assertion
  // convicted a correct tree. A guard anchored on the first match faces the
  // wrong cell.
  const billable = src.slice(armEnd);
  assert.ok(billable.length > 1000, `billable slice floor: ${billable.length} chars`);
  assert.ok(
    !billable.includes('sendWaivedFeeReceipt'),
    'the billable path sends the waived receipt — a supplier who owes ₱837.50 would be told ' +
      'nothing is owed',
  );
  assert.ok(billable.includes("'order_quoted'"), 'the billable path no longer bills at all');
});

test('ONE receipt per charge — the emitter keys on related_url and a refused read sends nothing', () => {
  const src = stripComments(LOCK);
  const fn = src.slice(
    src.indexOf('async function sendWaivedFeeReceipt'),
    src.indexOf('export async function collectBookingFeeAtLock'),
  );
  assert.ok(fn.length > 500, `receipt-function slice floor: ${fn.length} chars`);
  // The house idempotency pattern: look for an existing notification at this
  // exact related_url before emitting.
  assert.ok(fn.includes("from('notifications')"), 'no existence check — a re-lock re-sends');
  assert.ok(fn.includes('related_url'), 'the existence check does not key on related_url');
  assert.ok(fn.includes('vendorWaivedFeePath'), 'the key is not the per-charge path');
  // 🔑 A REFUSED EXISTENCE CHECK IS NOT "NONE YET". Read as absence it mails a
  // second receipt every time the read fails.
  //
  // ⚠ THIS ASSERTION WAS FIRST WRITTEN AS `/alreadyError[\s\S]{0,300}return;/`
  // AND IT PASSED THE SABOTAGE. Deleting the `return` left the NEXT statement's
  // `if (already) return;` inside the 300-character window, so the regex still
  // matched and the guard reported a tree that would double-send as clean. The
  // window has to end at the block's own brace, not at some later `return`.
  const errAt = fn.indexOf('if (alreadyError)');
  assert.ok(errAt > 0, 'the existence check does not handle a failed read at all');
  const closeAt = fn.indexOf('\n    }', errAt);
  assert.ok(closeAt > errAt, 'the alreadyError block does not close where expected');
  const block = fn.slice(errAt, closeAt);
  assert.ok(block.length > 20 && block.length < 400, `alreadyError block slice: ${block.length}`);
  assert.ok(
    block.includes('return;'),
    'a failed existence check does not return — an unanswered question would send a second receipt',
  );
});

test('an unreadable charge sends NOTHING — never a receipt built from a failed read', () => {
  const src = stripComments(LOCK);
  const fn = src.slice(
    src.indexOf('async function sendWaivedFeeReceipt'),
    src.indexOf('export async function collectBookingFeeAtLock'),
  );
  assert.ok(
    fn.includes('FEE_BILLS_UNREADABLE'),
    'the receipt does not distinguish "unreadable" from "not a waived charge" — one of those ' +
      'would print an amount nobody measured',
  );
  assert.ok(
    fn.indexOf('FEE_BILLS_UNREADABLE') < fn.indexOf('waivedFeeReceiptCopy'),
    'the copy is composed before the unreadable check',
  );
});

test('a receipt failure never rolls back the waived charge it follows', () => {
  assert.ok(LOCK.includes('sendWaivedFeeReceipt'), 'the function is gone');
  const fn = LOCK.slice(
    LOCK.indexOf('async function sendWaivedFeeReceipt'),
    LOCK.indexOf('export async function collectBookingFeeAtLock'),
  );
  assert.ok(/\btry\b/.test(fn) && /\bcatch\b/.test(fn), 'the emit has no failure handling');
});

/* ═══════════════════════════════════════════════════════════════════════════
   3 · THE WORDS — a receipt, with real numbers, or no numbers at all
   ═══════════════════════════════════════════════════════════════════════════ */

test('the receipt is the SAME resolver as the in-app line — the two cannot drift', () => {
  // SABOTAGE: re-type the headline inside waivedFeeReceiptCopy → RED, because
  // the two would stop being byte-identical.
  const inApp = waivedFeeCopy(CHARGE);
  const receipt = waivedFeeReceiptCopy(CHARGE);
  assert.equal(receipt.title, inApp.headline, 'the email subject is not the in-app headline');
  assert.ok(
    receipt.body.startsWith(inApp.detail),
    'the email body does not open with the in-app detail — it is a second copy of the sentence',
  );
});

test('it names the waived amount, the position, the remaining free bookings and the couple', () => {
  const { title, body } = waivedFeeReceiptCopy(CHARGE);
  assert.match(title, /₱508\.50/, 'the subject does not carry the waived amount to the centavo');
  assert.match(title, /waived/i);
  assert.match(title, /Rosa & Ben/, 'the subject does not say which couple');
  assert.match(body, /booking 1 of your first 5/, 'the body does not carry the ledger position');
  assert.match(body, /4 more free bookings after this one/, 'the body does not say how many are left');
  assert.match(body, /₱508\.50/);
});

test('the remaining-count clause is ONE function, shared with the forecast', () => {
  // SABOTAGE: type the count out again inside waivedFeeCopy → RED here the
  // moment the two phrasings differ.
  assert.equal(freeBookingsLeftClause(1), ' — 4 more free bookings after this one');
  assert.equal(freeBookingsLeftClause(4), ' — 1 more free booking after this one');
  assert.equal(freeBookingsLeftClause(5), ' — and this is the last of them');
  assert.ok(waivedFeeCopy({ ...CHARGE, ordinal: 4 }).detail.includes(freeBookingsLeftClause(4)));
  assert.ok(waivedFeeCopy({ ...CHARGE, ordinal: 5 }).detail.includes(freeBookingsLeftClause(5)));
});

test('a number that could not be read prints NO number — never ₱0', () => {
  // SABOTAGE: make the null-amount branch print feePesos(0) → RED.
  const unread = waivedFeeReceiptCopy({ ...CHARGE, computedPhp: null });
  assert.match(unread.title, /could not read the amount/);
  assert.doesNotMatch(`${unread.title} ${unread.body}`, /₱/, 'a peso figure survived a failed read');
  assert.doesNotMatch(`${unread.title} ${unread.body}`, /\b0\b/, 'a bare zero survived a failed read');

  // The position is only claimed when the ledger gave one — no ordinal means no
  // "booking N of 5" and no remaining count either.
  const noOrdinal = waivedFeeReceiptCopy({ ...CHARGE, ordinal: null });
  assert.doesNotMatch(noOrdinal.body, /booking \d+ of/);
  assert.doesNotMatch(noOrdinal.body, /more free booking/);
  assert.match(noOrdinal.body, /inside your first 5/);
});

test('IT IS A RECEIPT, NOT A BILL — it never asks for money', () => {
  // 🔑 THE REASON A NEW TYPE WAS WORTH A MIGRATION. `order_quoted` was right
  // there, wired and email-enabled, and it says "you have an order to pay".
  // SABOTAGE: paste the bookingFeeNoticeCopy body in here → RED.
  const bodies = [
    waivedFeeReceiptCopy(CHARGE),
    waivedFeeReceiptCopy({ ...CHARGE, computedPhp: null }),
    waivedFeeReceiptCopy({ ...CHARGE, ordinal: null, coupleName: null }),
  ];
  for (const { title, body } of bodies) {
    const text = `${title} ${body}`;
    assert.doesNotMatch(text, /ready to pay|is due|due on|pay it|please pay|amount due/i, text);
    assert.doesNotMatch(text, /GCash|BDO/i, 'a waived receipt names a payment rail');
    // The ONLY permitted mention of owing is the sentence saying nothing is.
    for (const m of text.matchAll(/\bowed?\b/gi)) {
      const around = text.slice(Math.max(0, m.index - 24), m.index + 12);
      assert.match(around, /nothing is/i, `"${around}" reads as a debt`);
    }
  }
});

test('the receipt points at a page that exists, and not at a pay page it has no order for', () => {
  const url = vendorWaivedFeePath(CHARGE.chargeId);
  assert.ok(url.startsWith(`${VENDOR_BOOKING_FEES_PATH}?`), 'the receipt leaves the fee hub');
  assert.ok(!url.includes('#'), 'a fragment link to a missing id fails silently');
  assert.notEqual(
    url,
    vendorWaivedFeePath('some-other-charge'),
    'the path is not per-charge, so the idempotency key collapses across charges',
  );
  // Unique per charge is the WHOLE idempotency mechanism — assert it directly.
  assert.ok(url.includes(CHARGE.chargeId));
});

test('the COUPLE is told nothing about the supplier’s fee', () => {
  // Both ends: the fee is between Setnayan and the shop. A couple-facing
  // sibling of this type would price the supplier's relationship in front of
  // the person paying for it.
  const src = stripComments(LOCK);
  assert.ok(!src.includes('booking_fee_waived_couple'), 'a couple-facing sibling appeared');
  const fn = src.slice(
    src.indexOf('async function sendWaivedFeeReceipt'),
    src.indexOf('export async function collectBookingFeeAtLock'),
  );
  assert.ok(
    fn.includes('vendor_profiles'),
    'the recipient is not resolved through the vendor profile',
  );
  assert.ok(
    !/event_members|couple/i.test(fn),
    'the waived receipt reaches for the couple — it is the supplier’s fee, and only theirs',
  );
});
