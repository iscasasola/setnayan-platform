/**
 * 🤝 A BOOKED COORDINATOR IS TOLD THEIR INVITE IS WAITING (supplier gate audit 2026-11-02, row E1).
 *
 * `autoInviteCoordinator` made a 7-day `/host/accept/<token>` invite on a paid planner_coordinator booking and told
 * nobody — the couple had to copy the link by hand. Held here:
 *   1. the right account is told: the one whose email IS the invite's (the accept page refuses any other), the shop
 *      owner first when it is that account, nobody when no account matches;
 *   2. the notice opens the invite's own accept link;
 *   3. the grant tells them on a NEW invite only (after the write landed, with the written token), passes the booked
 *      shop through from the caller, and never emails it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { coordinatorInviteNotice, coordinatorInviteRecipient } from '@/lib/coordinator-invite-notice';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the account told is the one whose email is the invite’s — the shop owner first, nobody on a near-match', () => {
  const byEmail = [{ user_id: 'u-email', email: 'Ana@Planner.ph' }];
  assert.equal(coordinatorInviteRecipient({ inviteEmail: 'ana@planner.ph', shopOwner: null, byEmail }), 'u-email');
  assert.equal(
    coordinatorInviteRecipient({ inviteEmail: 'ana@planner.ph', shopOwner: { user_id: 'u-owner', email: 'ana@planner.ph' }, byEmail }),
    'u-owner',
  );
  // The shop owner signed up with another email: the accept page would refuse them — tell the email's account instead.
  assert.equal(
    coordinatorInviteRecipient({ inviteEmail: 'ana@planner.ph', shopOwner: { user_id: 'u-owner', email: 'boss@planner.ph' }, byEmail }),
    'u-email',
  );
  // An `ilike` widened by `_` brings back a near-match: never told.
  assert.equal(coordinatorInviteRecipient({ inviteEmail: 'a_a@x.ph', shopOwner: null, byEmail: [{ user_id: 'u', email: 'aba@x.ph' }] }), null);
  assert.equal(coordinatorInviteRecipient({ inviteEmail: '', shopOwner: null, byEmail }), null);
});

test('the notice opens the invite’s own accept link', () => {
  const n = coordinatorInviteNotice({ token: 'tok123', eventName: 'Cale & Ice', days: 7 });
  assert.equal(n.relatedUrl, '/host/accept/tok123');
  assert.match(n.title, /Cale & Ice/);
});

test('the grant tells the coordinator on a NEW invite, with the written token, in the app only', () => {
  const src = read('lib/coordinator-grant.ts');
  const insert = src.indexOf(".from('event_moderators').insert(");
  const tell = src.indexOf('tellTheCoordinator(admin');
  assert.ok(insert > 0 && tell > insert, 'the coordinator must be told after the invite is written');
  assert.match(src.slice(insert, tell), /\.select\('invitation_token'\)/, 'the notice must carry the token the database wrote');
  assert.match(src.slice(insert, tell), /if \(error \|\| !made\) \{[\s\S]{0,300}return \{ created: false \}/, 'a refused write must tell nobody');
  // The dedupe return (an invite already there) comes before the insert — so a re-marked payment tells nobody again.
  assert.ok(src.indexOf('if (already) return') < insert);
  assert.match(src, /type: 'coordinator_invited'/);
  const emit = read('lib/notification-emit.ts');
  const allow = emit.slice(emit.indexOf('EMAIL_ENABLED_TYPES'), emit.indexOf('MARKETING_GATED_EMAIL_TYPES'));
  assert.doesNotMatch(allow, /'coordinator_invited'/, 'coordinator_invited is on the email allowlist');
});

test('the paid-booking caller passes the booked shop through', () => {
  const action = read('app/dashboard/[eventId]/vendors/actions.ts');
  assert.match(action, /autoInviteCoordinator\([\s\S]{0,300}shopProfileId: prevRow\.marketplace_vendor_id/);
});

test('the enum value exists in a migration of its own', () => {
  const m = readFileSync(join(WEB, '..', '..', 'supabase', 'migrations', '20271303211103_notification_type_coordinator_invited.sql'), 'utf8');
  assert.match(m, /ALTER TYPE public\.notification_type ADD VALUE IF NOT EXISTS 'coordinator_invited'/);
});
