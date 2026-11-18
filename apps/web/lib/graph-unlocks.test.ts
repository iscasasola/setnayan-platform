/**
 * graph-unlocks.test.ts — J5: each badge's Bronze opens its own graphs (badge-unlock_v6; DECISION_LOG 7d6c8129 ·
 * 50566f42 · a33fd894). One test per claim; each was broken on purpose and went red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BADGE_GRAPHS,
  invitesLine,
  BRONZE_STEP,
  badgeGate,
  giftsLine,
  giftsRec,
  graphUnlocks,
  lockedLine,
  giftPointsToNext,
  notCountedYet,
  type UnlockFacts,
} from './graph-unlocks';
import { SHOP_BADGE_KEYS, SHOP_BADGE_STEPS } from './badge-tiers';
import { BADGE_REWARDS } from './badge-rewards';

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

test('below Bronze, a badge hides its graphs and leaves ONE plain line, in the drawing’s words (badge-unlock_v6 .more)', () => {
  const u = graphUnlocks(facts({ counts: { completed_bookings: 3, five_star_reviews: 0, gifts_given: 0 } }));
  for (const g of ['slow', 'lost', 'split', 'rep', 'replyvs', 'gifts']) assert.ok(u.hidden.has(g), `${g} should be hidden`);
  const cb = u.locked.find((l) => l.badge === 'completed_bookings')!;
  assert.deepEqual(lockedLine(cb), { lead: 'Events Bronze', rest: 'shows you your slow months' });
  assert.deepEqual(lockedLine(u.locked.find((l) => l.badge === 'five_star_reviews')!), { lead: 'Reviews Bronze', rest: 'shows you what couples say' });
  assert.deepEqual(lockedLine(u.locked.find((l) => l.badge === 'gifts_given')!), { lead: 'Gift points Bronze', rest: 'shows you which gifts turn into bookings' });
  assert.equal(u.locked.length, 3, 'one line per counted badge with graphs (completed · five-star · gifts), never one per graph');
});

test('Bronze, the badges and their names are main’s — SHOP_BADGE_STEPS and BADGE_REWARDS, never a copy', () => {
  for (const b of SHOP_BADGE_KEYS) {
    assert.equal(BRONZE_STEP[b], SHOP_BADGE_STEPS[b][0], `${b}: Bronze is not the ladder's first step`);
    assert.equal(notCountedYet(b), !BADGE_REWARDS[b].measured, `${b}: "not counted" is not read from BADGE_REWARDS`);
  }
});

test('at Bronze the graphs open — the step is the badge’s OWN first step', () => {
  const u = graphUnlocks(
    facts({ counts: { completed_bookings: BRONZE_STEP.completed_bookings, five_star_reviews: BRONZE_STEP.five_star_reviews, gifts_given: BRONZE_STEP.gifts_given, invites: BRONZE_STEP.invites } }),
  );
  // Every counted badge at Bronze opens; only a badge not counted yet keeps its graph waiting.
  const waiting = SHOP_BADGE_KEYS.filter(notCountedYet).flatMap((b) => BADGE_GRAPHS[b]);
  assert.deepEqual([...u.hidden].sort(), [...waiting].sort());
  const justBelow = graphUnlocks(facts({ counts: { completed_bookings: BRONZE_STEP.completed_bookings - 1 } }));
  assert.ok(justBelow.hidden.has('slow'));
});

test('earnedBronze is main’s paidTiers, never a second reading of the keys', () => {
  const src = readFileSync(new URL('./graph-unlocks.ts', import.meta.url), 'utf8');
  assert.match(src, /const paid = paidTiers\(earned\);/);
  assert.doesNotMatch(src, /head === 'events'|head === 'reviews'/);
});

test('keep what you had: a Bronze once earned keeps its graphs when the count dips — J0 keys and main’s legacy keys', () => {
  assert.equal(badgeGate('five_star_reviews', facts({ earned: ['five_star_reviews:tier1'] })), 'open');
  assert.equal(badgeGate('gifts_given', facts({ earned: ['gifts_given:tier3'] })), 'open');
  assert.equal(badgeGate('completed_bookings', facts({ earned: ['events:10'] })), 'open', 'main’s first events step is above Bronze');
  assert.equal(badgeGate('five_star_reviews', facts({ earned: ['reviews:5'] })), 'open', 'main’s legacy reviews steps count too (paidTiers)');
  assert.equal(badgeGate('five_star_reviews', facts({ earned: ['reviews:7'] })), 'locked', 'a legacy step main never paid opens nothing');
  assert.equal(badgeGate('five_star_reviews', facts({ earned: ['gifts_given:tier1'] })), 'locked', 'another badge’s step opens nothing here');
});

test('a shop that already saw graphs keeps them — but a graph NEW with this change still waits for its badge', () => {
  const u = graphUnlocks(facts({ kept: true }));
  for (const g of ['slow', 'lost', 'split', 'rep', 'replyvs']) assert.ok(!u.hidden.has(g), `${g} was seen before — kept`);
  assert.ok(u.hidden.has('gifts'), 'the gifts graph is new: nobody "had" it');
  assert.ok(u.hidden.has('invites'), 'the Invites graph is new too');
  assert.deepEqual(u.locked.map((l) => l.badge), ['gifts_given']);
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

test('a count not handed in is decided by its earned steps alone — absent is not "unread"', () => {
  const noCounter = facts({ counts: { completed_bookings: 9 }, earned: [] });
  assert.equal(badgeGate('gifts_given', noCounter), 'locked', 'no count, nothing earned → locked, not shown');
  assert.equal(badgeGate('gifts_given', { ...noCounter, earned: ['gifts_given:tier1'] }), 'open');
  assert.equal(badgeGate('five_star_reviews', noCounter), 'locked');
});

test('an earned list we could not read is "unknown" (Couldn’t load) — the graphs stay, never locked', () => {
  const u = graphUnlocks(facts({ counts: {}, earned: null }));
  for (const b of ['completed_bookings', 'five_star_reviews', 'gifts_given'] as const) assert.ok(u.unsure.includes(b), `${b} not unsure`);
  assert.equal(u.locked.length, 0);
});

test('the gifts recommendation fires only with couples deciding AND stock; High when gifted couples book ≥ 2× as often', () => {
  const g = { giftedBooked: 5, giftedDeciding: 4, plainBooked: 3, plainDeciding: 21, freeStock: 2 };
  assert.equal(giftsLine(g), '5 of the 9 couples you gave a gift to booked you (56%); 3 of the 24 you did not (13%).');
  assert.equal(giftsRec(g)!.impact, 'high');
  // Word for word from badge-unlock_v6 RECS.give_gifts, every number read — the drawing's own sample gives its own text.
  const rec = giftsRec(g, { giftPoints: 300, examplePoints: [{ name: 'a Papic 1000', points: 50 }, { name: 'an Event Plus', points: 300 }] })!;
  assert.equal(rec.title, 'Give a gift to the couples still deciding');
  assert.equal(
    rec.body,
    '21 couples asked and have not booked. Couples you gave a gift to booked 56% of the time; the rest, 13%. Give each of them a gift from your stock. Each gift earns one point for every ₱10 of its price (a Papic 1000 is 50 points, an Event Plus 300), counted once their event is complete; 450 more points reach Gifts given Silver.',
  );
  // An unread part is left out, never guessed.
  assert.doesNotMatch(giftsRec(g)!.body, /Papic|more points reach/);
  assert.deepEqual(giftPointsToNext(SHOP_BADGE_STEPS.gifts_given[0]! - 1), { left: 1, tier: 'Bronze' });
  assert.equal(giftPointsToNext(null), null);
  assert.equal(giftsRec({ ...g, freeStock: 0 }), null, 'no stock, no task');
  assert.equal(giftsRec({ ...g, giftedDeciding: 0, plainDeciding: 0 }), null, 'nobody deciding, no task');
  assert.equal(giftsRec({ ...g, plainDeciding: 0 }), null, 'every couple still deciding already has a gift: no task');
  assert.equal(giftsRec({ ...g, giftedBooked: 2, giftedDeciding: 7, plainBooked: 4, plainDeciding: 20 })!.impact, 'medium', '22% vs 17% is not twice');
  assert.equal(giftsRec(null), null, 'an unread graph gives no task');
});

test('Invites: while BADGE_REWARDS says it is not counted, its graph waits — and it flips with that flag alone', () => {
  const u = graphUnlocks(facts({ kept: true, counts: { invites: 99 } }));
  if (notCountedYet('invites')) {
    assert.ok(u.hidden.has('invites'), 'an uncounted badge drew its graph');
    assert.ok(!u.locked.some((l) => l.badge === 'invites'), 'the drawing gives Invites no line');
  } else {
    assert.ok(!u.hidden.has('invites'), 'a counted Invites at Bronze must open its graph');
  }
});

test('the Invites line adds the months — invited, booked, completed', () => {
  const months = [
    { month: 'Oct', invited: 4, booked: 2, completed: 1 },
    { month: 'Nov', invited: 2, booked: 1, completed: 1 },
  ];
  assert.equal(invitesLine(months), 'You invited 6 suppliers in the last 12 months; 3 booked, 2 completed an event.');
});
