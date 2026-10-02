/**
 * A REMOVED GUEST IS NOT AN INVITATION — Home's defence in depth.
 *
 * Live test 2026-10-02: a host removed a guest; the account that had saved the
 * invitation still saw the event on Home under "You're invited", onto a hub
 * that said "You're not on the guest list for this event yet". The database
 * now ends the link (tests/db/a-deleted-guest-ends-its-account-link.db.test.ts);
 * this pins the READ: `fetchUserEvents` reads each membership's guest row under
 * the account's own RLS (which hides a removed row) and drops a guest
 * membership whose row is gone — for every board that lists invitations
 * (Home, the front-door command list, the auto-surfaced list).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { anInvitationStillOnTheList } from './event-board';

test('a guest membership whose row reads back null is not an invitation', () => {
  assert.equal(anInvitationStillOnTheList({ member_type: 'guest', guest_id: 'g1', seat: null }), false);
  assert.equal(anInvitationStillOnTheList({ member_type: 'guest', guest_id: 'g1', seat: undefined }), false);
});

test('a live invitation stays', () => {
  assert.equal(anInvitationStillOnTheList({ member_type: 'guest', guest_id: 'g1', seat: { guest_id: 'g1' } }), true);
});

test('only guest memberships that name a row are judged', () => {
  assert.equal(anInvitationStillOnTheList({ member_type: 'couple', guest_id: 'g1', seat: null }), true);
  assert.equal(anInvitationStillOnTheList({ member_type: 'coordinator', guest_id: 'g1', seat: null }), true);
  assert.equal(anInvitationStillOnTheList({ member_type: 'guest', guest_id: null, seat: null }), true);
});

test('fetchUserEvents reads the seat and drops a removed one before any board sees it', () => {
  const src = readFileSync(path.join(__dirname, 'events.ts'), 'utf8');
  const body = src.slice(src.indexOf('export const fetchUserEvents'), src.indexOf('const EVENT_EXPIRATION_GRACE_DAYS'));
  assert.ok(body.length > 0, 'fetchUserEvents moved — re-anchor this guard');
  assert.match(body, /seat:guests!event_members_guest_id_fkey\s*\(\s*guest_id\s*\)/, 'the seat embed is gone from the read');
  assert.match(body, /\.filter\(\(row\) =>\s*anInvitationStillOnTheList\(/, 'the rows are no longer filtered by the seat');
});
