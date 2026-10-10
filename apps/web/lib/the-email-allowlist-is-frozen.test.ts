/**
 * the-email-allowlist-is-frozen.test.ts — NO NEW EMAILS.
 *
 * Owner, 2026-10-11, verbatim: "i thought we can manage without emails?" The
 * record agrees — DECISION_LOG 2026-09-29 "NO EMAIL TO GUESTS — THE QR AND THE
 * LINK DO EVERYTHING" (owner: "But we have expenses for these emails"),
 * 2026-10-02 ("yes stop emails"). Emails cost money and the direction is fewer.
 *
 * 🔴 WHY A TEST. On 2026-10-10 a session put eight more notification types on
 * the email allowlist without the owner's word, then four more, then a reminder
 * sweep. Each step was reviewed, guarded and green. Nothing said "stop", because
 * nothing held the LIST ITSELF: every existing guard checks that a type which is
 * meant to email does. This one checks the other thing — that nobody widens it.
 *
 * 🔒 THE THREE LISTS BELOW ARE WHAT `main` SENT ON 2026-10-10 (a316051dd), TYPE
 * FOR TYPE. The test fails if `notification-emit.ts` holds one more or one
 * fewer. Adding an email is an OWNER decision: change the frozen list here in
 * the same commit, and say whose word it was in the commit message.
 *
 * Losing one is guarded too: a type that silently drops off is a person who
 * stops being told (that is how `booking_cancelled` lost its email in June).
 *
 * SABOTAGE (each seen red, restored): add 'payment_logged' to the email list ·
 * add 'quote_accepted' · remove 'payment_confirmed' · add 'lock_request_received'
 * to the push list · move 'chat_message' into the marketing-gated set.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { NOTIFICATION_TYPE_LABEL, NOTIFICATION_TYPE_TONE } from './notifications';

const EMIT = stripComments(readFileSync(join(process.cwd(), 'lib', 'notification-emit.ts'), 'utf8'));

/** The members of one Set literal in notification-emit.ts, in file order. */
function members(name: string): string[] {
  const start = EMIT.indexOf(`const ${name}`);
  assert.ok(start > -1, `${name} moved — this guard is blind`);
  const open = EMIT.indexOf('new Set([', start);
  const close = EMIT.indexOf(']);', open);
  assert.ok(open > start && close > open, `could not bound ${name}`);
  return [...EMIT.slice(open, close).matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1]!);
}

/** Every type that emailed on main, 2026-10-10. 52 of them. */
const EMAILED_ON_MAIN: readonly string[] = [
  'ai_payment_due', 'appointment_reminder', 'booking_confirmed',
  'booking_fee_waived', 'chat_message', 'colour_changed_in_lane',
  'completion_accepted', 'date_change_answered', 'date_change_closed',
  'date_change_requested', 'date_moved', 'deletion_request_agreed',
  'deletion_request_declined', 'deletion_request_nudge', 'deletion_request_received',
  'dispute_filed', 'dispute_resolved', 'event_deletion_answered',
  'guest_takedown_honored', 'inquiry_accepted', 'lock_request_agreed',
  'lock_request_declined', 'lock_request_expired', 'lock_request_nudge',
  'lock_request_received', 'lock_request_withdrawn', 'new_chapter_from_followed',
  'order_awaiting_reconciliation', 'order_cancelled', 'order_paid', 'order_quoted',
  'papic_pool_spent', 'part_finalization_agreed', 'part_finalization_declined',
  'part_finalization_requested', 'part_reopen_answered', 'part_reopen_requested',
  'payment_cleared', 'payment_confirmed', 'payment_info_sent', 'payment_matched',
  'payment_refunded', 'payment_rejected', 'payment_resubmit_requested',
  'review_received', 'rsvp_received', 'schedule_change_requested', 'security_alert',
  'vendor_credit_expiring', 'vendor_feature_suggested', 'vendor_status_change',
  'waitlist_picked',
];
/** Every type that pushed on main, 2026-10-10. */
const PUSHED_ON_MAIN: readonly string[] = ['chat_message', 'inquiry_accepted', 'security_alert', 'vendor_inquiry_received'];
/** The engagement types whose email also needs marketing consent, on main. */
const MARKETING_GATED_ON_MAIN: readonly string[] = ['new_chapter_from_followed'];

function compare(name: string, frozen: readonly string[], what: string): void {
  const now = members(name);
  assert.equal(new Set(now).size, now.length, `${name} lists a type twice`);
  const gained = now.filter((t) => !frozen.includes(t)).sort();
  const lost = frozen.filter((t) => !now.includes(t)).sort();
  console.log(`# ${name}: ${now.length} now · ${frozen.length} on main · gained ${gained.length} · lost ${lost.length}`);
  assert.deepEqual(
    gained,
    [],
    `${what} was ADDED for: ${gained.join(', ')}. Owner 2026-10-11: "we manage without emails" — a new one needs his word. ` +
      'If you have it, add the type to the frozen list in this file in the same commit.',
  );
  assert.deepEqual(lost, [], `${what} was REMOVED for: ${lost.join(', ')} — somebody stops being told.`);
}

test('anchor — the three lists were really read', () => {
  assert.equal(EMAILED_ON_MAIN.length, 52);
  assert.equal(new Set(EMAILED_ON_MAIN).size, EMAILED_ON_MAIN.length, 'the frozen list repeats a type');
  assert.ok(members('EMAIL_ENABLED_TYPES').length >= 40, 'the email allowlist parsed as nearly empty');
  assert.ok(members('PUSH_ENABLED_TYPES').length >= 3, 'the push list parsed as nearly empty');
});

test('🔒 the email allowlist is exactly what main sent — none gained, none lost', () => {
  compare('EMAIL_ENABLED_TYPES', EMAILED_ON_MAIN, 'An EMAIL');
});

test('🔒 the push list is exactly what main sent', () => {
  compare('PUSH_ENABLED_TYPES', PUSHED_ON_MAIN, 'A PUSH');
});

test('🔒 the marketing-gated set is exactly what main had', () => {
  compare('MARKETING_GATED_EMAIL_TYPES', MARKETING_GATED_ON_MAIN, 'A marketing gate');
});

test('the four notices added on 2026-10-10 are told IN THE APP — labelled, toned, on no list', () => {
  const email = members('EMAIL_ENABLED_TYPES');
  const push = members('PUSH_ENABLED_TYPES');
  for (const t of ['quote_accepted', 'quote_declined', 'change_order_proposed', 'change_order_answered'] as const) {
    assert.ok(NOTIFICATION_TYPE_LABEL[t], `${t} has no label — the tray row would be blank`);
    assert.ok(NOTIFICATION_TYPE_TONE[t], `${t} has no tone`);
    assert.ok(!email.includes(t), `${t} is emailed`);
    assert.ok(!push.includes(t), `${t} is pushed`);
  }
});
