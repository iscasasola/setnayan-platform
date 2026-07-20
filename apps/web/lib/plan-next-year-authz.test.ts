/**
 * Regression suite for the "Plan next year" authorization gate.
 *
 * THE BUG THIS PINS (privilege escalation, live 2026-07-20): planNextYearEvent
 * authorized on an RLS-gated `events` SELECT alone. That policy resolves through
 * `current_event_ids()`, which returns every event_id the caller has ANY
 * `event_members` row for — member_type is never consulted — so a mere GUEST
 * read the host's event back and sailed through. The action then cloned the
 * event with the SERVICE-ROLE client and inserted the caller as
 * `member_type='couple'` of the new one. Since a server action is a public POST,
 * the `[eventId]` layout's couple gate never ran.
 *
 * Delete the couple check from `authorizePlanNextYear` and the "guest" test below
 * goes red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  authorizePlanNextYear,
  PLAN_NEXT_YEAR_MEMBER_TYPES,
  type EventMembershipRow,
} from './plan-next-year-authz';

const VICTIM_EVENT = 'S89E-VICTIM0001';
const ATTACKER = 'user-attacker';

/** A membership reader that always answers with one fixed row. */
function reader(row: EventMembershipRow) {
  const calls: Array<[string, string]> = [];
  return {
    calls,
    deps: {
      async readMembership(eventId: string, userId: string) {
        calls.push([eventId, userId]);
        return row;
      },
    },
  };
}

test('THE HOLE: a GUEST of the source event is rejected (RLS read would have passed)', async () => {
  // The join flow (app/join/[eventId]/actions.ts) seeds exactly this row, and
  // it is enough to satisfy event_member_can_read on the victim's event.
  const { deps, calls } = reader({ member_type: 'guest' });

  const result = await authorizePlanNextYear(VICTIM_EVENT, ATTACKER, deps);

  assert.deepEqual(result, { ok: false, reason: 'not_a_couple' });
  // …and the gate consulted the caller's own membership for the SOURCE event.
  assert.deepEqual(calls, [[VICTIM_EVENT, ATTACKER]]);
});

test('a couple of the source event is allowed', async () => {
  const { deps } = reader({ member_type: 'couple' });
  assert.deepEqual(await authorizePlanNextYear(VICTIM_EVENT, 'user-host', deps), { ok: true });
});

test('every other member_type is rejected — couple-only, moderators included', async () => {
  for (const memberType of ['guest', 'vendor', 'coordinator', 'moderator', 'admin', 'COUPLE', '']) {
    const { deps } = reader({ member_type: memberType });
    const result = await authorizePlanNextYear(VICTIM_EVENT, ATTACKER, deps);
    assert.equal(result.ok, false, `${memberType || '<empty>'} must be rejected`);
  }
});

test('no membership row at all → not_a_member (non-member replaying the POST)', async () => {
  const { deps } = reader(null);
  assert.deepEqual(await authorizePlanNextYear(VICTIM_EVENT, ATTACKER, deps), {
    ok: false,
    reason: 'not_a_member',
  });
});

test('a row with a missing / null member_type fails closed', async () => {
  for (const row of [{}, { member_type: null }] as EventMembershipRow[]) {
    const { deps } = reader(row);
    const result = await authorizePlanNextYear(VICTIM_EVENT, ATTACKER, deps);
    assert.equal(result.ok, false);
  }
});

test('a throwing membership read is NOT permission (fails closed, never bubbles)', async () => {
  const result = await authorizePlanNextYear(VICTIM_EVENT, ATTACKER, {
    async readMembership() {
      throw new Error('network down');
    },
  });
  assert.deepEqual(result, { ok: false, reason: 'not_a_member' });
});

test('blank event id or user id is rejected without even reading', async () => {
  let read = false;
  const deps = {
    async readMembership() {
      read = true;
      return { member_type: 'couple' };
    },
  };
  assert.equal((await authorizePlanNextYear('', ATTACKER, deps)).ok, false);
  assert.equal((await authorizePlanNextYear(VICTIM_EVENT, '', deps)).ok, false);
  assert.equal(read, false, 'must short-circuit before the read');
});

test('the allow-list is couple-only (guards against a silent widening)', () => {
  assert.deepEqual([...PLAN_NEXT_YEAR_MEMBER_TYPES], ['couple']);
});
