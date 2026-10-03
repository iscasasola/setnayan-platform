/**
 * EVERY NOTIFICATION EMAIL SAYS ITS OWN REASON — none borrows another's
 * (owner's live test, 2026-10-02: the couple's "<name> RSVP'd: attending" mail
 * ended "You're receiving this because you started a Papic gallery for your
 * event." — the branded template's default, inherited by every type
 * `emitNotification` sends).
 *
 *   1 · every type on the email allowlist (read out of notification-emit.ts,
 *       never a copied list) has a line of its own;
 *   2 · no two types share a line, and none is the Papic gallery's;
 *   3 · the mail is BUILT with it — rendered through the real template, both
 *       halves (HTML footer and the plain-text tail) carry the type's line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { renderBrandedEmail } from './email-template';
import {
  NOTIFICATION_EMAIL_FALLBACK_REASON,
  NOTIFICATION_EMAIL_REASONS,
  notificationEmailReason,
} from './notification-email-reason';
import type { NotificationType } from './notifications';

const EMIT = stripComments(readFileSync(join(__dirname, 'notification-emit.ts'), 'utf8'));
const PAPIC_LINE = "You're receiving this because you started a Papic gallery for your event.";

/** The allowlist exactly as the sender holds it. */
function allowlisted(): NotificationType[] {
  const at = EMIT.indexOf('const EMAIL_ENABLED_TYPES');
  assert.ok(at > -1, 'the email allowlist moved — this guard is blind');
  const body = EMIT.slice(at, EMIT.indexOf(']);', at));
  const types = [...body.matchAll(/'([a-z_0-9]+)'/g)].map((m) => m[1] as NotificationType);
  assert.ok(types.length >= 40, `read only ${types.length} allowlisted types — this guard is blind`);
  return types;
}

test('1 · every type the allowlist emails has a reason line of its own', () => {
  for (const type of allowlisted()) {
    assert.ok(NOTIFICATION_EMAIL_REASONS[type], `${type} is emailed with no reason of its own — it would borrow one`);
    assert.notEqual(notificationEmailReason(type), NOTIFICATION_EMAIL_FALLBACK_REASON, `${type} falls back to the generic line`);
  }
});

test('2 · no type borrows another type\'s footer — and none says "you started a Papic gallery"', () => {
  const seen = new Map<string, string>();
  for (const [type, line] of Object.entries(NOTIFICATION_EMAIL_REASONS)) {
    assert.ok(line && line.startsWith("You're receiving this because "), `${type}: not a reason line`);
    assert.notEqual(line, PAPIC_LINE, `${type} says the Papic gallery's reason`);
    assert.doesNotMatch(line!, /Papic gallery/i, `${type} names a Papic gallery`);
    const other = seen.get(line!);
    assert.equal(other, undefined, `${type} and ${other} share one footer: "${line}"`);
    seen.set(line!, type);
  }
  assert.equal(seen.has(NOTIFICATION_EMAIL_FALLBACK_REASON), false, 'a type uses the generic fallback as its own line');
  // The one the owner saw.
  assert.equal(notificationEmailReason('rsvp_received'), "You're receiving this because a guest replied to your invitation.");
});

test('3 · the mail is built with the type\'s own line — HTML footer and text tail', () => {
  // The sender passes it to the template, and to the plain-text half.
  const fn = EMIT.slice(EMIT.indexOf('export async function emitNotification('));
  assert.match(fn, /: \{ footer: notificationEmailReason\(type\) \}\)/, 'the HTML mail is rendered without the type\'s footer');
  assert.match(fn, /\[\s*notificationEmailReason\(type\),\s*`Manage notifications:/, 'the plain-text half says some other reason');
  assert.doesNotMatch(fn, /because of activity on your Setnayan account/, 'a generic reason is still typed into the sender');
  // And the template, given it, prints it — and not the Papic default.
  const html = renderBrandedEmail({
    heading: "Ana RSVP'd: attending",
    paragraphs: ['Ana is coming.'],
    ctaLabel: 'Open Setnayan',
    ctaHref: 'https://www.setnayan.com/dashboard',
    footer: notificationEmailReason('rsvp_received'),
  });
  assert.ok(html.includes('a guest replied to your invitation'), 'the RSVP mail does not say why it came');
  assert.ok(!html.includes('Papic gallery'), 'the RSVP mail still says the Papic gallery line');
});
