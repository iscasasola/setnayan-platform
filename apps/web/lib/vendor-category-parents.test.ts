/**
 * vendor-category-parents.test.ts — the chooser refuses BEFORE the work.
 *
 * 🔴 WHAT THIS IS FOR (owner 2026-08-28): *"looking at our service card creation
 * with so many categories? should the choices be only for the service we
 * actually cover and not all?"*
 *
 * Measured on his own shop before answering, and the answer is not taste. The
 * save enforces two caps — cards per kind, families per plan — and enforces them
 * **after the card is authored**, as a redirect carrying an error. SetnaProd is
 * on Solo (ONE family), covers *Pabati* (booths) and *Day-Of Coordinators*
 * (planning), and is offered ~34 kinds. Everything outside those two families
 * was a refusal waiting to happen, collected after the photo was uploaded.
 *
 * ⚖ These cases are the SHOP'S OWN SHAPE, read out of production, not invented:
 * `existingParents = {booths, planning}`, `parentCategories = 1`, zero cards.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { parentsOfCategory, standingForCategory } from '@/lib/vendor-category-parents';

// ⚠ Asserted first: under `tsx --test` an `@/lib/…` import has come back with
// EMPTY named exports in this repo, and a guard whose subject is `undefined`
// runs zero checks and reports a pass.
test('the module under test actually loaded', () => {
  assert.equal(typeof standingForCategory, 'function');
  assert.equal(typeof parentsOfCategory, 'function');
  assert.deepEqual(parentsOfCategory('photobooth' as never), ['booths']);
});

/** SetnaProd, as production holds it today. */
const SETNAPROD = {
  existingParents: new Set(['booths', 'planning']),
  cardsByCategory: {} as Record<string, number>,
  parentCategories: 1,
  servicesPerLeaf: 3,
};

test('what the shop already covers is offered', () => {
  for (const kind of ['photobooth', 'mobile_bar', 'guest_booth', 'planner_coordinator', 'wedding_paperwork', 'travel_honeymoon']) {
    assert.equal(
      standingForCategory(kind as never, SETNAPROD).standing,
      'covered',
      `${kind} stopped being offered to a shop that works in its family`,
    );
  }
});

test('a family the plan cannot hold is refused HERE, with the reason', () => {
  const st = standingForCategory('catering' as never, SETNAPROD);
  assert.equal(st.standing, 'locked', 'a kind the save would refuse is being offered again');
  assert.ok(st.standing === 'locked' && st.why.length > 0, 'the refusal lost its reason');
  // The sentence is for a supplier, not a log line.
  assert.ok(st.standing === 'locked' && /upgrade/i.test(st.why), 'the refusal stopped saying what to do about it');
});

test('the four exempt kinds are never refused — they count against nothing', () => {
  // officiant · church fees · security · miscellaneous have no family at all, so
  // the cap has never applied to them. Locking them would invent a refusal the
  // save does not make.
  for (const kind of ['officiant', 'church_fees', 'security', 'misc']) {
    assert.deepEqual(parentsOfCategory(kind as never), [], `${kind} grew a family`);
    assert.equal(
      standingForCategory(kind as never, SETNAPROD).standing,
      'open',
      `${kind} started being refused`,
    );
  }
});

test('a full kind is refused even inside a covered family', () => {
  const st = standingForCategory('photobooth' as never, {
    ...SETNAPROD,
    cardsByCategory: { photobooth: 3 },
  });
  assert.equal(st.standing, 'locked', 'the cards-per-kind cap stopped being asked');
  assert.ok(st.standing === 'locked' && /3/.test(st.why), 'the refusal stopped naming the number');
});

test('a brand-new shop is offered everything', () => {
  // No coverage, no cards: the first family is always free, so nothing may be
  // greyed. A new shop meeting a wall of locked kinds would read as a product
  // that does not do their trade.
  const fresh = {
    existingParents: new Set<string>(),
    cardsByCategory: {},
    parentCategories: 1,
    servicesPerLeaf: 3,
  };
  for (const kind of ['catering', 'photobooth', 'planner_coordinator', 'cake_maker']) {
    assert.equal(standingForCategory(kind as never, fresh).standing, 'open', `${kind} was refused to a new shop`);
  }
});

test('unlimited plans lock nothing', () => {
  const enterprise = {
    existingParents: new Set(['booths', 'planning']),
    cardsByCategory: { catering: 99 },
    parentCategories: Infinity,
    servicesPerLeaf: Infinity,
  };
  assert.equal(standingForCategory('catering' as never, enterprise).standing, 'open');
});

test('the rule fails OPEN, never closed', () => {
  // A shop whose coverage could not be read has an EMPTY parent set — it must
  // see everything and meet the save's own gate as before. The opposite (a read
  // failure deleting kinds a supplier is entitled to sell) is the harm.
  const unreadable = {
    existingParents: new Set<string>(),
    cardsByCategory: {},
    parentCategories: 1,
    servicesPerLeaf: 2,
  };
  const kinds = ['catering', 'photobooth', 'planner_coordinator', 'cake_maker', 'mobile_bar'];
  const locked = kinds.filter((k) => standingForCategory(k as never, unreadable).standing === 'locked');
  assert.deepEqual(locked, [], 'a failed coverage read started refusing kinds');
});
