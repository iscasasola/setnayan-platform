/**
 * 🔁 "GIVE THIS SPOT TO SOMEONE ELSE" (guest pathway, owner DECISION_LOG
 * 2026-09-26). Pins the wiring of `giveSpotToSomeoneElse`
 * (app/dashboard/[eventId]/guests/[guestId]/actions.ts); the schema half — the
 * old token finds nobody after the rotation — is
 * tests/db/giving-a-spot-away-kills-the-old-key.db.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const ACTIONS = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/guests/[guestId]/actions.ts'), 'utf8'));
const CARD = stripComments(readFileSync(join(WEB, 'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx'), 'utf8'));

function body(name: string): string {
  const at = ACTIONS.search(new RegExp(`(?:export )?async function ${name}\\(`));
  assert.ok(at > -1, `${name} not found`);
  const rest = ACTIONS.slice(at);
  const end = rest.search(/\n}\n/);
  return rest.slice(0, end);
}

test('the swap rides the release door — no new server action', () => {
  const release = body('releaseGuestClaim');
  assert.match(release, /formData\.get\('swap_name'\)/);
  assert.match(release, /return giveSpotToSomeoneElse\(eventId, guestId, swapName\)/);
  assert.doesNotMatch(ACTIONS, /export async function giveSpot/, 'the swap became its own export');
});

test('only a guest who has NOT replied can be swapped', () => {
  const b = body('giveSpotToSomeoneElse');
  assert.match(b, /rsvp_status !== 'pending'\) back\('swap_replied'\)/, 'a replied guest can be swapped');
  // …and the write itself is scoped to a still-pending row (a reply landing
  // mid-swap cannot be overwritten).
  assert.match(b, /\.eq\('rsvp_status', 'pending'\);/);
});

test('a NEW KEY FIRST, as the couple — and its failure stops everything', () => {
  const b = body('giveSpotToSomeoneElse');
  const rotate = b.indexOf("supabase.rpc('rotate_guest_qr_token'");
  const drop = b.indexOf(".from('event_members')");
  const rename = b.indexOf('first_name: parsed.firstName');
  assert.ok(rotate > -1, 'the swap does not rotate as the couple (a service-role call is refused by the function)');
  assert.ok(rotate < drop && drop < rename, 'the order must be: rotate, then let go of the old account, then rename');
  assert.match(b.slice(rotate, drop), /back\('swap_failed'\)/, 'a failed rotation does not stop the swap');
});

test('the spot is kept, the old person is cleared', () => {
  const b = body('giveSpotToSomeoneElse');
  const upd = b.slice(b.indexOf('.update({'), b.indexOf('})', b.indexOf('.update({')));
  for (const gone of ['person_id: null', 'email: null', 'mobile: null', 'photo_url: null', 'dietary_restrictions: null', 'guest_note: null']) {
    assert.ok(upd.includes(gone), `${gone} — the old person's ${gone.split(':')[0]} stays on the new person's spot`);
  }
  for (const kept of ['plus_one_count', 'side', 'role', 'rsvp_status', 'deleted_at', 'table', 'seat']) {
    assert.doesNotMatch(upd, new RegExp(`\\b${kept}\\b\\s*:`), `the swap changes ${kept} — the spot must stay as it was`);
  }
  assert.match(b, /from\('event_members'\)\s*\.delete\(\)/, 'the old account keeps its hold on the seat');
  assert.doesNotMatch(b, /emitNotification|sendEmail/, 'the old person is told — the owner said they are not');
});

test('"Take this seat back" rotates as the couple too (a service-role call is refused)', () => {
  assert.match(body('releaseGuestClaim'), /supabase\.rpc\('rotate_guest_qr_token'/);
  assert.doesNotMatch(ACTIONS, /admin\.rpc\('rotate_guest_qr_token'/);
});

test('the card offers the swap only to a guest who has not replied', () => {
  assert.match(CARD, /guest\.rsvp_status === 'pending' \? \(\s*<form action=\{releaseAction\}[^>]*data-give-spot=""/);
  assert.match(CARD, /name="swap_name"/);
  assert.match(CARD, /Give the spot/);
});
