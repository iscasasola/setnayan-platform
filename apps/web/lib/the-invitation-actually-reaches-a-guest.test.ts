/**
 * the-invitation-actually-reaches-a-guest.test.ts — CTRL-B4 build 2.
 *
 * Production 2026-09-22: **146 guests, 0 with `invitation_sent_at`.** There was
 * no invitation send path of any kind, so the couple's Invite step could never
 * complete — "N to send" had no way to reach zero.
 *
 * 🔑 THE LOAD-BEARING PROPERTY IS THE STAMP. `sendEmail()` returns
 * `{ok:false, reason:'not_configured'}` and NO-OPS when the Resend key is
 * missing. Stamping regardless would mark all 146 guests invited on a day
 * nothing left the building — permanently, with the couple's own screen
 * counting it as done.
 *
 * 🛡 Mutation-checked; every sabotage verified to apply before being trusted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { buildInvitationGuestEmail, buildSaveTheDateGuestEmail } from '@/lib/save-the-date-emails-core';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');
const readCode = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(new RegExp(re.source, 'g')) ?? []).length;

const CTX = {
  coupleName: 'Ana & Miguel',
  weddingDateIso: '2027-03-13',
  pageUrl: 'https://setnayan.com/ana-miguel',
  venue: 'Casa Real',
};
const GUEST = { guest_id: 'g1', first_name: 'Rosa', last_name: 'Cruz', display_name: null, email: 'rosa@test.local' };

// ── THE MESSAGE — executed, not grepped ────────────────────────────────────

// SABOTAGE: make the invitation reuse the save-the-date subject → RED.
test('an invitation asks you to come; a save-the-date asks you to hold a day', () => {
  const inv = buildInvitationGuestEmail(GUEST, CTX);
  const std = buildSaveTheDateGuestEmail(GUEST, CTX);
  assert.notEqual(
    inv.subject,
    std.subject,
    'if the two messages are identical there is no reason for two builders — and the guest is told to save a date they were meant to be invited to',
  );
  assert.match(inv.subject, /invited/i, 'the invitation must say what it is');
  assert.match(inv.text, /Ana & Miguel/, 'it must name the couple');
  assert.match(inv.text, /setnayan\.com\/ana-miguel/, 'it must carry the link the guest replies through');
  assert.match(inv.text, /unsubscribe/i, 'every fan-out email carries its unsubscribe route');
  assert.ok(inv.headers?.['List-Unsubscribe'], 'RFC 8058 header, same as the save-the-date');
});

test('a guest with no name still gets a sendable message', () => {
  const inv = buildInvitationGuestEmail({ ...GUEST, first_name: null, last_name: null, display_name: null }, CTX);
  assert.ok(inv.subject.length > 0 && inv.text.length > 0);
  assert.doesNotMatch(inv.text, /Hi null|undefined/, 'a missing name must not leak into the greeting');
});

test('a wedding with no date set still produces a coherent invitation', () => {
  const inv = buildInvitationGuestEmail(GUEST, { ...CTX, weddingDateIso: null, venue: null });
  assert.match(inv.subject, /invited/i);
  assert.doesNotMatch(inv.text, /null|undefined|Invalid Date/, 'an absent date must not render as a broken one');
});

// ── THE MECHANISM — one, shared ────────────────────────────────────────────

// SABOTAGE: stamp before checking res.ok → RED.
// SABOTAGE: give the invitation its own copy of the send loop → RED.
test('both fan-outs share ONE send-and-stamp, and it stamps only an accepted send', () => {
  const src = readCode('lib/save-the-date-emails.ts');
  assert.equal(
    count(src, /async function sendAndStamp</),
    1,
    'two mechanisms for one fact — "was this email accepted?" — is the defect this repo keeps meeting',
  );
  assert.equal(count(src, /sendAndStamp\(admin, recipients, 'std_sent_at'/), 1, 'the save-the-date uses it');
  assert.equal(count(src, /sendAndStamp\(admin, recipients, 'invitation_sent_at'/), 1, 'the invitation uses it');
  const start = src.indexOf('async function sendAndStamp<');
  const body = src.slice(start, src.indexOf('\nexport ', start));
  assert.match(
    body,
    /if \(res\.ok\)\s*\{[\s\S]{0,200}\.update\(/,
    'the stamp must be INSIDE the res.ok branch — sendEmail no-ops without a Resend key, so stamping regardless marks every guest invited on a day nothing was sent',
  );
});

// SABOTAGE: remove the isEmailConfigured guard → RED.
test('no Resend key means nothing sent AND nothing stamped', () => {
  const src = readCode('lib/save-the-date-emails.ts');
  const start = src.indexOf('export async function fanOutInvitationEmails');
  assert.ok(start > 0, 'fanOutInvitationEmails not found — this guard is pointed at nothing');
  const body = src.slice(start);
  assert.ok(body.length > 600, `window collapsed to ${body.length} chars — a guard that cannot see the body cannot fail`);
  assert.match(
    body,
    /isEmailConfigured\(\)[\s\S]{0,160}no_email_config/,
    'it must bail BEFORE touching a guest, and say why — a send that quietly did nothing must not mark anyone as invited',
  );
  assert.match(
    body,
    /\.is\('invitation_sent_at', null\)/,
    'an already-invited guest must not be re-emailed on a re-run',
  );
  assert.match(body, /\.is\('deleted_at', null\)/, 'a removed guest is not a recipient');
});
