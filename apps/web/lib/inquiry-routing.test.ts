/**
 * Who handles a new client (#8013 drawing (e)/(f) + controller rows 2, 3). Held: the fair split picks on the card's
 * branch only; a paused holder passes to the next Account Manager then the Branch Manager; an uncovered card goes to
 * the Branch Manager, else the Shop Manager; a client keeps their person; a second card they don't cover is a
 * hand-over, never a silent move; adjusted cuts win only while they fit today's people.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { decideHandler, pickForCard, type RoutingMember } from './inquiry-routing';

const m = (memberId: string, duty: string, branchId: string | null, createdAt: string, paused = false): RoutingMember => ({
  memberId, duty, branchId, createdAt, paused,
});
const team: RoutingMember[] = [
  m('ana', 'shop_manager', null, '2026-01-01'),
  m('rico', 'branch_manager', 'makati', '2026-02-01'),
  m('bea', 'account_manager', 'makati', '2026-03-01'),
  m('joy', 'account_manager', 'makati', '2026-04-01'),
  m('cebu-am', 'account_manager', 'cebu', '2026-03-15'),
];
const base = {
  cardBranchId: 'makati',
  cardCoverIds: ['bea', 'joy', 'cebu-am'],
  team,
  adjusted: [],
  counts: new Map<string, number>(),
  lastName: 'Tan',
  currentHandlerId: null,
};

test('the fair split picks among the card’s Account Managers on the card’s branch only', () => {
  // Even split A–M | N–Z (no counts): Tan → the second person by seat age (joy).
  assert.deepEqual(decideHandler(base), { kind: 'assign', memberId: 'joy', why: 'split' });
  assert.deepEqual(decideHandler({ ...base, lastName: 'Dela Cruz' }), { kind: 'assign', memberId: 'bea', why: 'split' });
});

test('a paused holder passes to the next Account Manager, then the Branch Manager', () => {
  const paused = team.map((x) => (x.memberId === 'joy' ? { ...x, paused: true } : x));
  assert.deepEqual(pickForCard({ ...base, team: paused }), { memberId: 'bea', why: 'away-next-account-manager' });
  const bothPaused = team.map((x) => (x.memberId === 'joy' || x.memberId === 'bea' ? { ...x, paused: true } : x));
  assert.deepEqual(pickForCard({ ...base, team: bothPaused }), { memberId: 'rico', why: 'away-branch-manager' });
});

test('a card nobody covers → the Branch Manager; no Branch Manager → the Shop Manager', () => {
  assert.deepEqual(pickForCard({ ...base, cardCoverIds: [] }), { memberId: 'rico', why: 'card-uncovered-branch-manager' });
  assert.deepEqual(
    pickForCard({ ...base, cardCoverIds: [], team: team.filter((x) => x.memberId !== 'rico') }),
    { memberId: 'ana', why: 'shop-manager' },
  );
  assert.deepEqual(pickForCard({ ...base, cardBranchId: null, cardCoverIds: [] }), { memberId: 'ana', why: 'shop-manager' });
});

test('nothing at all → nobody, never a guess', () => {
  assert.deepEqual(decideHandler({ ...base, team: [], cardCoverIds: [] }), { kind: 'nobody' });
});

test('a client keeps their person; a second card they don’t cover is a hand-over', () => {
  assert.deepEqual(decideHandler({ ...base, currentHandlerId: 'bea' }), { kind: 'keep', memberId: 'bea' });
  assert.deepEqual(
    decideHandler({ ...base, cardCoverIds: ['joy'], currentHandlerId: 'bea' }),
    { kind: 'hand-over', keepId: 'bea', offerId: 'joy' },
  );
  // A Branch Manager or Shop Manager handling a client simply keeps them.
  assert.deepEqual(decideHandler({ ...base, currentHandlerId: 'rico' }), { kind: 'keep', memberId: 'rico' });
});

test('adjusted cuts win while they fit today’s people; a join makes them not fit, so the fair split runs', () => {
  const adjusted = [
    { memberId: 'bea', from: 'AA', to: 'TA' },
    { memberId: 'joy', from: 'TA', to: null },
  ];
  assert.deepEqual(pickForCard({ ...base, adjusted, lastName: 'Santos' }), { memberId: 'bea', why: 'split' });
  const grown = [...team, m('mark', 'account_manager', 'makati', '2026-05-01')];
  const r = pickForCard({ ...base, team: grown, cardCoverIds: ['bea', 'joy', 'mark'], adjusted, lastName: 'Santos' });
  assert.notEqual(r?.memberId, undefined);
  assert.equal(r?.why, 'split');
});
