/**
 * graph-unlocks.test.ts — J5: each badge's Bronze opens its own graphs (badge-unlock_v6; DECISION_LOG 7d6c8129 ·
 * 50566f42 · a33fd894). One test per claim; each was broken on purpose and went red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BADGE_GRAPHS,
  invitesLine,
  BRONZE_STEP,
  badgeGate,
  giftsLine,
  giftsRec,
  graphUnlocks,
  lockedLine,
  type UnlockFacts,
} from './graph-unlocks';

const facts = (o: Partial<UnlockFacts> = {}): UnlockFacts => ({
  kept: false,
  earned: [],
  counts: { completed_bookings: 0, five_star_reviews: 0, gifts_given: 0, trusted_by: 0, invites: 0 },
  ...o,
});

test('the ruled map: each badge opens its own graphs; Trusted by opens none until ruled; Invites opens ONE', () => {
  assert.deepEqual(BADGE_GRAPHS.completed_bookings, ['slow', 'lost', 'split']);
  assert.deepEqual(BADGE_GRAPHS.five_star_reviews, ['rep', 'replyvs']);
  assert.deepEqual(BADGE_GRAPHS.gifts_given, ['gifts']);
  assert.deepEqual(BADGE_GRAPHS.trusted_by, [], 'open item 10: the partners graph no longer fits Trusted by');
  assert.deepEqual(BADGE_GRAPHS.invites, ['invites'], 'specs 7fbff0cd (10): one graph, month by month');
});

test('below Bronze, a badge hides its graphs and leaves ONE plain line naming them and what is left to go', () => {
  const u = graphUnlocks(facts({ counts: { completed_bookings: 3, five_star_reviews: 0, gifts_given: 0 } }));
  for (const g of ['slow', 'lost', 'split', 'rep', 'replyvs', 'gifts']) assert.ok(u.hidden.has(g), `${g} should be hidden`);
  const cb = u.locked.find((l) => l.badge === 'completed_bookings')!;
  assert.equal(lockedLine(cb, (g) => g.toUpperCase()), 'Completed bookings Bronze opens SLOW · LOST · SPLIT — 2 more completed bookings to go.');
  assert.equal(u.locked.length, 4, 'one line per badge with graphs (completed · five-star · gifts · invites), never one per graph');
});

test('at Bronze the graphs open — the step is the badge’s OWN first step', () => {
  const u = graphUnlocks(
    facts({ counts: { completed_bookings: BRONZE_STEP.completed_bookings, five_star_reviews: BRONZE_STEP.five_star_reviews, gifts_given: BRONZE_STEP.gifts_given, invites: BRONZE_STEP.invites } }),
  );
  assert.equal(u.hidden.size, 0);
  const justBelow = graphUnlocks(facts({ counts: { completed_bookings: BRONZE_STEP.completed_bookings - 1 } }));
  assert.ok(justBelow.hidden.has('slow'));
});

test('keep what you had: a Bronze once earned keeps its graphs when the count dips — J0 keys and main’s legacy keys', () => {
  assert.equal(badgeGate('five_star_reviews', facts({ earned: ['five_star_reviews:tier1'] })), 'open');
  assert.equal(badgeGate('gifts_given', facts({ earned: ['gifts_given:tier3'] })), 'open');
  assert.equal(badgeGate('completed_bookings', facts({ earned: ['events:10'] })), 'open', 'main’s first events step is above Bronze');
  assert.equal(badgeGate('five_star_reviews', facts({ earned: ['gifts_given:tier1'] })), 'locked', 'another badge’s step opens nothing here');
});

test('a shop that already saw graphs keeps them — but a graph NEW with this change still waits for its badge', () => {
  const u = graphUnlocks(facts({ kept: true }));
  for (const g of ['slow', 'lost', 'split', 'rep', 'replyvs']) assert.ok(!u.hidden.has(g), `${g} was seen before — kept`);
  assert.ok(u.hidden.has('gifts'), 'the gifts graph is new: nobody "had" it');
  assert.ok(u.hidden.has('invites'), 'the Invites graph is new too');
  assert.deepEqual(u.locked.map((l) => l.badge), ['gifts_given', 'invites']);
});

test('a count we could not read is never 0: the graphs stay shown, no locked line, and the badge is named unsure', () => {
  const u = graphUnlocks(facts({ counts: { completed_bookings: null }, earned: null }));
  assert.ok(!u.hidden.has('slow'), 'an unread count must not lock graphs the shop saw yesterday');
  assert.ok(u.unsure.includes('completed_bookings'));
  assert.ok(!u.locked.some((l) => l.badge === 'completed_bookings'));
  // The earned list read fine and holds nothing — but the COUNT is unread: still "we don't know", never "below Bronze".
  const v = graphUnlocks(facts({ counts: { completed_bookings: null }, earned: [] }));
  assert.ok(!v.hidden.has('slow'), 'an unread count with an empty earned list must not read as 0');
  assert.ok(v.unsure.includes('completed_bookings'));
});

test('a badge this build has no counter for is decided by its earned steps alone — absent is not "unread"', () => {
  const noCounter = facts({ counts: { completed_bookings: 9 }, earned: [] });
  assert.equal(badgeGate('gifts_given', noCounter), 'locked', 'no gift-points counter here, nothing earned → locked, not shown');
  assert.equal(badgeGate('gifts_given', { ...noCounter, earned: ['gifts_given:tier1'] }), 'open');
  assert.equal(badgeGate('five_star_reviews', noCounter), 'locked');
  assert.equal(graphUnlocks(noCounter).locked.find((l) => l.badge === 'gifts_given')!.toGo, null, 'no count, no "N to go"');
});

test('the gifts recommendation fires only with couples deciding AND stock; High when gifted couples book ≥ 2× as often', () => {
  const g = { giftedBooked: 5, giftedDeciding: 4, plainBooked: 3, plainDeciding: 21, freeStock: 2 };
  assert.equal(giftsLine(g), '5 of the 9 couples you gave a gift to booked you (56%); 3 of the 24 you did not (13%).');
  assert.equal(giftsRec(g)!.impact, 'high');
  assert.equal(giftsRec({ ...g, freeStock: 0 }), null, 'no stock, no task');
  assert.equal(giftsRec({ ...g, giftedDeciding: 0, plainDeciding: 0 }), null, 'nobody deciding, no task');
  assert.equal(giftsRec({ ...g, giftedBooked: 2, giftedDeciding: 7, plainBooked: 4, plainDeciding: 20 })!.impact, 'medium', '22% vs 17% is not twice');
  assert.equal(giftsRec(null), null, 'an unread graph gives no task');
});

test('Invites: until imports are recorded the badge says "not counted yet" — never a number to go, never its graph', () => {
  const u = graphUnlocks(facts({ kept: true }));
  const inv = u.locked.find((l) => l.badge === 'invites');
  assert.ok(inv, 'Invites must leave its line, even for a kept shop (its graph is new)');
  assert.equal(lockedLine(inv!, () => 'Suppliers you invited'), 'Invites Bronze opens Suppliers you invited — not counted yet.');
  assert.ok(u.hidden.has('invites'));
});

test('the Invites line adds the months — invited, booked, completed', () => {
  const months = [
    { month: 'Oct', invited: 4, booked: 2, completed: 1 },
    { month: 'Nov', invited: 2, booked: 1, completed: 1 },
  ];
  assert.equal(invitesLine(months), 'You invited 6 suppliers in the last 12 months; 3 booked, 2 completed an event.');
});
