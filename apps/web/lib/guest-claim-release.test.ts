/**
 * The couple's undo for a forwarded invitation — and the ORDER it must happen in.
 *
 * Owner ruling 2026-08-06: *"the couple has full control of their guests."*
 *
 * 🔑 ROTATING THE QR DOES NOT UNCLAIM. Verified against the live
 * `rotate_guest_qr_token` function: it writes `qr_token`, `qr_token_rotated_at`,
 * `qr_rotation_count` and `updated_at` — and nothing else. It never touches
 * `person_id` (which carries the claim) or `email`. So a couple who presses
 * "new QR" closes the LINK door and leaves the ACCOUNT door open: the person who
 * claimed the seat simply signs in.
 *
 * 🔑 AND THE REVERSE IS WORSE. Detaching without rotating hands the seat
 * straight back to whoever still holds the old link — they open it again and
 * re-claim. That exact bug is already in this project's decision log, from Papic
 * seats: "NEVER SEPARATE THE UNCLAIM FROM THE ROTATION — rotation is the
 * PRECONDITION, not the fix."
 *
 * So the guard here is about ORDER, not existence. A release that runs the two
 * steps the wrong way round would pass any test that only checks both happened.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const ACTIONS = 'app/dashboard/[eventId]/guests/[guestId]/actions.ts';
// ⤷ 2026-09-22: the guest's edit form moved OUT of the route and into the
// shared card both the route and the roster panel render. The route is now a
// loader. Following the symbol, not the filename — a guard left pointing at
// the old path would go green by finding nothing.
const PAGE = 'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx';
const read = (p: string) => fs.readFileSync(p, 'utf8');

function releaseBody(): string {
  const s = read(ACTIONS);
  const start = s.indexOf('export async function releaseGuestClaim');
  assert.ok(start > -1, 'releaseGuestClaim not found');
  const next = s.indexOf('\nexport ', start + 10);
  return s.slice(start, next === -1 ? undefined : next);
}

test('the release ROTATES FIRST, then detaches — never the other way round', () => {
  const b = releaseBody();
  const rotate = b.indexOf('rotate_guest_qr_token');
  const detach = b.indexOf('person_id: null');
  assert.ok(rotate > -1, 'the release must rotate the QR');
  assert.ok(detach > -1, 'the release must detach the claim');
  assert.ok(
    rotate < detach,
    'ROTATION IS THE PRECONDITION — detaching first hands the seat back to the old link',
  );
});

test('a failed rotation ABORTS — it never proceeds to detach', () => {
  const b = releaseBody();
  const rotate = b.indexOf('rotate_guest_qr_token');
  const detach = b.indexOf('person_id: null');
  const between = b.slice(rotate, detach);
  assert.match(
    between,
    /redirect\(/,
    'there must be a bail-out between rotating and detaching, so a failed rotation stops the release',
  );
  assert.match(between, /rpcError|!rotated|!res\?\.ok/, 'the rotation result must actually be checked');
});

test('it clears BOTH things the claimer took — the person link and the email', () => {
  const b = releaseBody();
  assert.match(b, /person_id: null/, 'person_id carries the claim');
  assert.match(b, /email: null/, 'the claimer overwrote the couple\'s contact for that guest');
});

test('it does NOT delete the guest, their reply or their seat', () => {
  const b = releaseBody();
  // Scope to the UPDATE PAYLOAD. The body legitimately mentions deleted_at in
  // its authorisation read (`.is('deleted_at', null)`) — filtering to live
  // guests is not deleting one. An earlier version of this test matched the
  // whole function and failed on that read, which would have pushed the next
  // reader to weaken a correct guard.
  const upd = b.slice(b.indexOf('.update({'), b.indexOf('})', b.indexOf('.update({')));
  assert.ok(upd.length > 0, 'update payload not found');
  assert.doesNotMatch(upd, /deleted_at/, 'releasing a claim must never remove the guest');
  assert.doesNotMatch(upd, /rsvp_status/, 'their reply is theirs and stays');
  assert.doesNotMatch(upd, /seat|table/i, 'their seat assignment stays');
  assert.doesNotMatch(b, /\.delete\(\)/, 'nothing is hard-deleted here');
});

test('authorisation is the RLS session client, matching the sibling delete action', () => {
  const b = releaseBody();
  assert.match(b, /await createClient\(\)/, 'must read through the session client first');
  const read_ = b.indexOf('createClient()');
  const admin = b.indexOf('createAdminClient()');
  assert.ok(read_ > -1 && admin > -1 && read_ < admin, 'authorise before using the admin client');
});

test('the couple actually has a button, and it is not a nested form', () => {
  const p = read(PAGE);
  assert.match(p, /releaseGuestClaim/, 'the page must import the action');
  assert.match(p, /Take this seat back/);
  /*
    ⤷ 2026-09-22: this used to require `formAction={releaseAction}` on the ONE
    form the page had. The card now has an autosaving form, and a destructive
    action must not ride on it — a debounce firing while a host reaches for
    "Take this seat back" is not a race worth having. It gets its own <form>.

    The rule was never "use formAction"; it was "do not nest a form". So that is
    what is asserted now: the release form exists and sits OUTSIDE the autosave
    form, which is a structural fact, not a phrasing.
  */
  assert.match(p, /<form action=\{releaseAction\}/, 'the release needs a form of its own');
  const closeAutosave = p.indexOf('</AutosaveForm>');
  const releaseForm = p.indexOf('<form action={releaseAction}');
  assert.ok(closeAutosave > -1, 'the autosave form is gone — re-derive this check');
  assert.ok(
    releaseForm > closeAutosave,
    'the release form is nested inside the autosave form — the repo lints against that, ' +
      'and a nested form posts the wrong action',
  );
});
