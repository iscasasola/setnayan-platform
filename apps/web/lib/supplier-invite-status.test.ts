/**
 * The couple is told where their link stands — and is told only what
 * `vendor_invites` records (owner 2026-10-10: "the couple IS told when the
 * supplier declines or never opens the link").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  INVITE_STATUS_UNREAD_LINE,
  joinedLine,
  ownRecordLine,
  supplierInviteStatus,
} from './supplier-invite-status';

const HERE = dirname(fileURLToPath(import.meta.url));
const NOW = Date.parse('2026-10-10T08:00:00Z');
const iso = (daysFromNow: number) => new Date(NOW + daysFromNow * 86_400_000).toISOString();

test('no link ever made → nothing is said', () => {
  assert.equal(supplierInviteStatus(null, NOW), null);
});

test('a live link reads as sent, with how long ago, and "no answer yet"', () => {
  const today = supplierInviteStatus({ status: 'pending', sentAt: iso(0), expiresAt: iso(90) }, NOW);
  assert.deepEqual(today, { key: 'sent', line: 'Link sent today · no answer yet', tone: 'warn' });
  const yesterday = supplierInviteStatus({ status: 'pending', sentAt: iso(-1), expiresAt: iso(89) }, NOW);
  assert.equal(yesterday?.line, 'Link sent yesterday · no answer yet');
  const older = supplierInviteStatus({ status: 'pending', sentAt: iso(-12), expiresAt: iso(78) }, NOW);
  assert.equal(older?.line, 'Link sent 12 days ago · no answer yet');
});

test('a sent date that cannot be read drops the "ago", never invents one', () => {
  const s = supplierInviteStatus({ status: 'pending', sentAt: null, expiresAt: iso(10) }, NOW);
  assert.equal(s?.line, 'Link sent · no answer yet');
});

test('a declined link tells the couple, in red', () => {
  const s = supplierInviteStatus({ status: 'declined', sentAt: iso(-3), expiresAt: iso(87) }, NOW);
  assert.equal(s?.key, 'declined');
  assert.equal(s?.tone, 'danger');
  assert.match(s?.line ?? '', /not this supplier/);
});

test('a link nobody used is EXPIRED even while the row still says pending', () => {
  // The database only flips pending → expired when the link is opened, so a
  // link that was never opened stays `pending` for ever.
  const lazy = supplierInviteStatus({ status: 'pending', sentAt: iso(-91), expiresAt: iso(-1) }, NOW);
  assert.equal(lazy?.key, 'expired');
  const stored = supplierInviteStatus({ status: 'expired', sentAt: iso(-91), expiresAt: iso(-1) }, NOW);
  assert.deepEqual(lazy, stored);
  assert.equal(stored?.line, 'Your link ran out with no answer');
});

test('a claimed link reads as joined; a revoked one says nothing', () => {
  assert.equal(supplierInviteStatus({ status: 'claimed', sentAt: iso(-2), expiresAt: iso(88) }, NOW)?.key, 'joined');
  // The link knows they joined; it cannot know their card is up — the row does.
  assert.equal(
    supplierInviteStatus({ status: 'claimed', sentAt: iso(-2), expiresAt: iso(88) }, NOW)?.line,
    'Joined through your link · their card is not up yet',
  );
  assert.equal(joinedLine(true), 'Now on Setnayan — their own card');
  assert.equal(joinedLine(false), 'Joined through your link · their card is not up yet');
  assert.equal(supplierInviteStatus({ status: 'revoked', sentAt: iso(-2), expiresAt: iso(88) }, NOW), null);
});

test('it never claims to know whether the link was OPENED — the table does not record it', () => {
  const lines = [
    supplierInviteStatus({ status: 'pending', sentAt: iso(-5), expiresAt: iso(85) }, NOW)?.line,
    supplierInviteStatus({ status: 'expired', sentAt: iso(-95), expiresAt: iso(-5) }, NOW)?.line,
    supplierInviteStatus({ status: 'declined', sentAt: iso(-5), expiresAt: iso(85) }, NOW)?.line,
    INVITE_STATUS_UNREAD_LINE,
  ].join(' | ');
  assert.doesNotMatch(lines, /open(ed)?\b/i);
  // …and the snapshot of production columns agrees there is nothing to read.
  const snapshot = readFileSync(
    join(HERE, '..', '..', '..', 'supabase', 'security', 'prod-schema.snapshot.txt'),
    'utf8',
  );
  assert.ok(snapshot.includes('vendor_invites.declined_at'), 're-point: the snapshot lists vendor_invites columns');
  assert.ok(
    !/vendor_invites\.opened_at/.test(snapshot),
    'vendor_invites.opened_at exists now — teach supplierInviteStatus to read it (the seam in its docblock)',
  );
});

test('the record sentence is the prototype’s', () => {
  assert.equal(ownRecordLine(false), 'Added by you · your record, not a booking');
  assert.equal(ownRecordLine(true), 'Added by you · booked by hand');
});
