/**
 * ONE free Helper for every supplier, on every plan (owner 2026-10-14, DECISION_LOG 🧑‍🤝‍🧑 call 2).
 *
 * What is held: the free seat is ONE, it is ONLY the Helper role (`viewer`), the founding admin is never counted,
 * a plan with 0 seats still takes one Helper, a second Helper counts, and moving the free Helper to a paid role is
 * refused when the plan has no room. If any of these goes wrong a seat is given away (money) or a supplier is refused
 * the helper the owner promised (fairness).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { FREE_HELPER_ROLE, FREE_HELPER_SEATS, canSeat, seatLine, teamSeats } from './vendor-free-helper';

const FOUNDER = 'u-founder';
const m = (id: string, role: string) => ({ user_id: `u-${id}`, vendor_team_member_id: id, role });

test('the constant is the owner’s ONE, and the free role is the read-only Helper', () => {
  assert.equal(FREE_HELPER_SEATS, 1);
  assert.equal(FREE_HELPER_ROLE, 'viewer');
});

test('the founder is never counted; one Helper rides free; a second Helper counts', () => {
  const founderRow = { user_id: FOUNDER, role: 'admin' };
  assert.deepEqual(teamSeats([founderRow], FOUNDER), { people: 0, freeHelpers: 0, counted: 0 });
  assert.deepEqual(teamSeats([founderRow, m('a', 'viewer')], FOUNDER), { people: 1, freeHelpers: 1, counted: 0 });
  assert.deepEqual(teamSeats([founderRow, m('a', 'viewer'), m('b', 'viewer')], FOUNDER), { people: 2, freeHelpers: 1, counted: 1 });
});

test('an Admin or a Team member is never free — only the Helper role is', () => {
  assert.equal(teamSeats([m('a', 'agent')], FOUNDER).counted, 1);
  assert.equal(teamSeats([m('a', 'admin')], FOUNDER).counted, 1);
  assert.equal(teamSeats([m('a', 'owner')], FOUNDER).counted, 1);
});

test('a plan with NO seats (Free with the paywall on) still takes its one Helper — and nobody else', () => {
  const cap = 0;
  assert.equal(canSeat({ members: [], founderUserId: FOUNDER, cap, change: { kind: 'invite', role: 'viewer' } }), true);
  assert.equal(canSeat({ members: [], founderUserId: FOUNDER, cap, change: { kind: 'invite', role: 'agent' } }), false);
  assert.equal(canSeat({ members: [m('a', 'viewer')], founderUserId: FOUNDER, cap, change: { kind: 'invite', role: 'viewer' } }), false);
});

test('Solo (1 seat): a Team member AND a Helper fit; a third person does not', () => {
  const cap = 1;
  const team = [m('a', 'agent')];
  assert.equal(canSeat({ members: team, founderUserId: FOUNDER, cap, change: { kind: 'invite', role: 'viewer' } }), true);
  const full = [...team, m('b', 'viewer')];
  assert.equal(canSeat({ members: full, founderUserId: FOUNDER, cap, change: { kind: 'invite', role: 'viewer' } }), false);
  assert.equal(canSeat({ members: full, founderUserId: FOUNDER, cap, change: { kind: 'invite', role: 'agent' } }), false);
});

test('moving the free Helper to a paid role is refused when the plan is full, allowed when it has room', () => {
  const team = [m('a', 'agent'), m('b', 'viewer')];
  assert.equal(canSeat({ members: team, founderUserId: FOUNDER, cap: 1, change: { kind: 'role', memberId: 'b', role: 'agent' } }), false);
  assert.equal(canSeat({ members: team, founderUserId: FOUNDER, cap: 2, change: { kind: 'role', memberId: 'b', role: 'agent' } }), true);
  // Moving a counted member DOWN to Helper never makes it worse — always allowed.
  assert.equal(canSeat({ members: team, founderUserId: FOUNDER, cap: 1, change: { kind: 'role', memberId: 'a', role: 'viewer' } }), true);
});

test('a team already over its seats (a downgrade) may shuffle roles but not grow', () => {
  const team = [m('a', 'agent'), m('b', 'agent'), m('c', 'agent')];
  assert.equal(canSeat({ members: team, founderUserId: FOUNDER, cap: 1, change: { kind: 'role', memberId: 'a', role: 'admin' } }), true);
  assert.equal(canSeat({ members: team, founderUserId: FOUNDER, cap: 1, change: { kind: 'invite', role: 'agent' } }), false);
  // …and its free Helper still comes in, because it does not count.
  assert.equal(canSeat({ members: team, founderUserId: FOUNDER, cap: 1, change: { kind: 'invite', role: 'viewer' } }), true);
});

test('unlimited plans are never refused', () => {
  assert.equal(canSeat({ members: [m('a', 'agent')], founderUserId: FOUNDER, cap: Infinity, change: { kind: 'invite', role: 'agent' } }), true);
});

test('the line says what is used and that the Helper is free', () => {
  assert.equal(seatLine(teamSeats([m('a', 'agent'), m('b', 'viewer')], FOUNDER), 3), '1 of 3 used · your free Helper is in use');
  assert.equal(seatLine(teamSeats([], FOUNDER), 0), '0 of 0 used · 1 Helper free on every plan');
  assert.equal(seatLine(teamSeats([m('a', 'agent')], FOUNDER), Infinity), '1 with you · no limit · 1 Helper free on every plan');
});
