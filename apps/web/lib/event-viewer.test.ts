/**
 * A LIST YOU CANNOT SEE SHOULD SAY SO.
 *
 * A delegate the host never shared the guest list with reads zero guest rows,
 * and an RLS refusal is indistinguishable from an empty event: same 200, same
 * zero rows, same null error. Without this rule the guests screen tells a
 * coordinator the couple has invited nobody, and the seat plan draws an empty
 * room for a wedding with two hundred people in it.
 *
 * 🔑 THE THREE CASES ARE NOT TWO. Stranger · delegate-without-the-grant ·
 * delegate-with-it. Only the middle one gets the notice — a stranger never
 * reaches the page, and collapsing the first two would put "the couple
 * haven't shared this with you" in front of somebody with no relationship to
 * the event at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COORDINATOR_AREAS, type ModeratorPermissions } from './delegate-areas';
import { isDelegateWithoutArea, viewerAreaLevel, type EventViewer } from './event-viewer';

const COUPLE: EventViewer = { isCouple: true, delegatePermissions: null };
const STRANGER: EventViewer = { isCouple: false, delegatePermissions: null };

const seatOnly: ModeratorPermissions = {
  edit_all: false,
  checkout: false,
  invite_hosts: false,
  remove_hosts: false,
  areas: { seat_plan: 'view' },
};
const SEAT_ONLY: EventViewer = { isCouple: false, delegatePermissions: seatOnly };
const COORDINATOR: EventViewer = {
  isCouple: false,
  delegatePermissions: {
    edit_all: false,
    checkout: false,
    invite_hosts: false,
    remove_hosts: false,
    areas: COORDINATOR_AREAS,
  },
};

test('the couple never see the notice, whatever else is true', () => {
  assert.equal(isDelegateWithoutArea(COUPLE, 'guest_list'), false);
  assert.equal(viewerAreaLevel(COUPLE, 'guest_list'), 'edit');
  // Even for an area no delegate can hold — the couple do not resolve through
  // the delegate grid at all.
  assert.equal(viewerAreaLevel(COUPLE, 'photos'), 'edit');
});

test('a stranger does not get the notice — it would name a relationship they do not have', () => {
  assert.equal(isDelegateWithoutArea(STRANGER, 'guest_list'), false);
  assert.equal(viewerAreaLevel(STRANGER, 'guest_list'), null);
});

test('a delegate granted only the seat plan gets the notice on the guest list', () => {
  assert.equal(isDelegateWithoutArea(SEAT_ONLY, 'guest_list'), true);
  // …and not on the part they WERE given. The narrowing must not read as a
  // blanket no.
  assert.equal(isDelegateWithoutArea(SEAT_ONLY, 'seat_plan'), false);
  assert.equal(viewerAreaLevel(SEAT_ONLY, 'seat_plan'), 'view');
});

test('the default coordinator grant sees the guest list, so the notice stays out of the way', () => {
  assert.equal(isDelegateWithoutArea(COORDINATOR, 'guest_list'), false);
  assert.equal(viewerAreaLevel(COORDINATOR, 'guest_list'), 'edit');
  // The two the coordinator template deliberately withholds still notice.
  assert.equal(isDelegateWithoutArea(COORDINATOR, 'budget'), true);
  assert.equal(isDelegateWithoutArea(COORDINATOR, 'photos'), true);
});

test('THE GUARD: both screens that render guest names ask before they render', () => {
  // 🔑 DERIVED FROM THE COMPONENT, NOT FROM A LIST I TYPED. Any screen that
  // imports the notice must also gate on it; any screen that reads guests for
  // display must do both. A hand-enumerated list is a list of the screens
  // somebody thought of.
  const screens = [
    'app/dashboard/[eventId]/guests/page.tsx',
    'app/dashboard/[eventId]/seating/page.tsx',
  ];
  let gated = 0;
  for (const path of screens) {
    const src = readFileSync(path, 'utf8');
    assert.ok(
      src.includes('isDelegateWithoutArea(viewer, \'guest_list\')'),
      `${path} renders guest names and must ask whether this viewer may see them`,
    );
    assert.ok(
      src.includes('<NotSharedWithYou'),
      `${path} asks the question and must act on the answer`,
    );
    gated += 1;
  }
  // A floor, so a broken path or a renamed file cannot make this pass by
  // checking nothing.
  assert.equal(gated, screens.length);
  assert.ok(gated >= 2, 'an empty sweep is not a pass');
});
