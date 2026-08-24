/**
 * Owner-layer gate (owner-locked 2026-07-26 role-surface model).
 *
 * The event owner opens `/[slug]` like a guest and gets owner controls
 * unlocked on top of it. `resolveOwnerCapability` is the ONLY producer of that
 * unlock, and this suite pins the one rule the 2026-07-26 security review
 * exists to enforce: the gate is the DATABASE, never the UI.
 *
 * So the positive case is the small half. The load-bearing half is the
 * negatives — no account, a cookie-holding guest of this very event, a
 * signed-in stranger — plus the proof that nothing on the request can shortcut
 * the membership read, and that a capability is bound to the event it was
 * checked against.
 *
 * The real membership probe is `loadHostMembership` (app/[slug]/_lib/loaders.ts)
 * — the same React.cache'd event_members + event_moderators pair that already
 * gates the private-event view, `?phase=` preview and `?editor=1`. It is
 * injected (see `HostMembershipCheck`), so this suite substitutes a recording
 * stub and asserts on exactly which user id the gate asks about.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  resolveOwnerCapability,
  type HostMembershipCheck,
} from '../app/[slug]/_lib/site-identity';

const EVENT_ID = 'event-alpha';
const HOST_USER_ID = 'user-host';

/** A membership probe that answers TRUE for exactly one user id — the DB's
 *  answer, stubbed — and records every id it was asked about. */
function membershipProbe(hostUserId: string | null) {
  const asked: string[] = [];
  const check: HostMembershipCheck = async (userId) => {
    asked.push(userId);
    return userId === hostUserId;
  };
  return { check, asked };
}

test('owner gate resolves a capability for a verified host', async () => {
  const probe = membershipProbe(HOST_USER_ID);
  const capability = await resolveOwnerCapability({
    eventId: EVENT_ID,
    viewerUserId: HOST_USER_ID,
    checkHostMembership: probe.check,
  });

  assert.deepEqual(capability, {
    capability: 'owner',
    ownerUserId: HOST_USER_ID,
    ownerEventId: EVENT_ID,
    // Not asked ⇒ false. A caller that does not supply `checkSiteEditing` gets
    // the safe answer, which sends the host to their planning desk rather than
    // to an editor that may redirect them. It can never hand out an edit
    // doorway nobody confirmed.
    maySiteEdit: false,
  });
  // It asked the database about the VIEWER's own id — not an id taken from
  // anything the request could have supplied.
  assert.deepEqual(probe.asked, [HOST_USER_ID]);
});

test('owner gate: the edit fact is asked ONLY of a confirmed host, and only about them', async () => {
  // It must never widen the capability — a person the membership probe refuses
  // gets no capability at all, so the second probe is not even consulted.
  const asked: string[] = [];
  const denied = await resolveOwnerCapability({
    eventId: EVENT_ID,
    viewerUserId: 'somebody-else',
    checkHostMembership: async () => false,
    checkSiteEditing: async (id) => {
      asked.push(id);
      return true;
    },
  });
  assert.equal(denied, null);
  assert.equal(asked.length, 0, 'the edit probe ran for somebody who is not a host at all');

  const host = await resolveOwnerCapability({
    eventId: EVENT_ID,
    viewerUserId: HOST_USER_ID,
    checkHostMembership: async () => true,
    checkSiteEditing: async (id) => {
      asked.push(id);
      return true;
    },
  });
  assert.equal(host?.maySiteEdit, true);
  assert.deepEqual(asked, [HOST_USER_ID], 'the edit probe asked about somebody else');
});

test('owner gate denies an anonymous visitor (no signed-in account)', async () => {
  const probe = membershipProbe(HOST_USER_ID);
  const capability = await resolveOwnerCapability({
    eventId: EVENT_ID,
    viewerUserId: null,
    checkHostMembership: probe.check,
  });

  assert.equal(capability, null);
  // And it never even reached the DB — the anonymous path pays zero queries.
  assert.deepEqual(probe.asked, []);
});

test('owner gate denies a guest holding this event’s cookie but no account', async () => {
  // A redeemed guest link sets the guest-session cookie; it is NOT an account,
  // so the orchestrator resolves `viewerUserId` to null for this viewer even
  // though their cookie is valid for THIS event. A guest cookie must never
  // stand in for host membership.
  const probe = membershipProbe(HOST_USER_ID);
  const capability = await resolveOwnerCapability({
    eventId: EVENT_ID,
    viewerUserId: null,
    checkHostMembership: probe.check,
  });

  assert.equal(capability, null);
  assert.deepEqual(probe.asked, []);
});

test('owner gate denies a signed-in guest of this event who is not a host', async () => {
  // The harder version of the case above: this guest DOES have an account
  // (they claimed one), and they are a legitimate guest of this event. The
  // membership pair still says no, so there is no capability.
  const probe = membershipProbe(HOST_USER_ID);
  const capability = await resolveOwnerCapability({
    eventId: EVENT_ID,
    viewerUserId: 'user-guest-with-account',
    checkHostMembership: probe.check,
  });

  assert.equal(capability, null);
  assert.deepEqual(probe.asked, ['user-guest-with-account']);
});

test('owner gate denies a signed-in stranger (account, no membership anywhere)', async () => {
  const probe = membershipProbe(null); // nobody is a host of this event
  const capability = await resolveOwnerCapability({
    eventId: EVENT_ID,
    viewerUserId: HOST_USER_ID, // even the would-be host id fails a NO answer
    checkHostMembership: probe.check,
  });

  assert.equal(capability, null);
  assert.deepEqual(probe.asked, [HOST_USER_ID]);
});

test('owner capability is bound to the event its membership was checked against', async () => {
  // A host of event A opening event B gets nothing for B — the probe passed in
  // is scoped to the event being rendered, and the capability records which.
  const probe = membershipProbe(HOST_USER_ID);
  const onOwnEvent = await resolveOwnerCapability({
    eventId: 'event-beta',
    viewerUserId: HOST_USER_ID,
    checkHostMembership: probe.check,
  });
  assert.equal(onOwnEvent?.ownerEventId, 'event-beta');

  const strangersEvent = membershipProbe(null);
  const onOtherEvent = await resolveOwnerCapability({
    eventId: 'event-gamma',
    viewerUserId: HOST_USER_ID,
    checkHostMembership: strangersEvent.check,
  });
  assert.equal(onOtherEvent, null);
});
