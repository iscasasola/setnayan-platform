/**
 * The marketplace grid orders by the approved lenses — and by nothing else.
 *
 * Owner 2026-08-29: ***"use the lenses."***
 *
 * Every rule here is one that would otherwise be re-invented differently the
 * next time somebody touches a public ranking surface.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  EXPLORE_LENS_ORDER,
  exploreCompatInputs,
  exploreLensScore,
  exploreLensWeights,
  offerableExploreLenses,
  orderByExploreLens,
  type ExploreVendor,
} from '@/lib/explore-lens';
import { LENSES, LENS_ORDER } from '@/lib/ranking-lenses';
import { COMPAT_WEIGHTS } from '@/lib/compat-score';

const shop = (o: Partial<ExploreVendor> = {}): ExploreVendor => ({
  avgRating: 4.5,
  reviewCount: 12,
  verified: true,
  ...o,
});

// ── ⛔ The privacy rule, first, because it is the one that must never slip ──

test('the demand lens is NOT offerable on the public grid', () => {
  // It is the only signal telling a couple about OTHER couples, and it has no
  // per-couple opt-out — recorded as the open question for a filing that lodges
  // January 2027. Its DPO approval covers the couple's own dashboard; a public
  // page is a different exposure.
  assert.ok(!EXPLORE_LENS_ORDER.includes('demand'), 'demand must not be listed');
  assert.ok(LENS_ORDER.includes('demand'), 'and it must still exist for the bench');
  const many = Array.from({ length: 6 }, () => shop({ distanceKm: 3 }));
  assert.ok(!offerableExploreLenses(many).includes('demand'));
});

test('a demand count cannot reach the scorer from this surface at all', () => {
  // Not "weighted zero" — not passed. A future weight change on the lens vector
  // must not be able to switch a cross-couple disclosure on by accident.
  const inputs = exploreCompatInputs({ ...shop(), ...({ demandCoupleCount: 99 } as object) });
  assert.equal(
    (inputs as { demandCoupleCount?: number | null }).demandCoupleCount,
    undefined,
    'the projection must not carry a demand count',
  );
});

// ── The four that DO apply, and when they hide themselves ─────────────────

test('a stranger with no event sees exactly one chip, and today’s order', () => {
  // Signed out: no venue, no budget, no dates. Every driving input is null, so
  // every lens hides itself and only the default remains.
  const strangers = Array.from({ length: 5 }, () => shop());
  assert.deepEqual(offerableExploreLenses(strangers), ['fit']);
});

test('a lens appears only once it can actually tell shops apart', () => {
  // Its own gate: ≥3 candidates AND ≥2 with a resolved driving input.
  const two = [shop({ distanceKm: 2 }), shop({ distanceKm: 9 })];
  assert.deepEqual(offerableExploreLenses(two), ['fit'], 'two candidates is not a rail');

  const oneMeasured = [shop({ distanceKm: 2 }), shop(), shop()];
  assert.deepEqual(offerableExploreLenses(oneMeasured), ['fit'], 'one measured shop orders nothing');

  const three = [shop({ distanceKm: 2 }), shop({ distanceKm: 9 }), shop()];
  assert.ok(offerableExploreLenses(three).includes('near'));
});

test('“fits your budget” needs a category, so an unfiltered grid never offers it', () => {
  // The couple's budget is split per category; comparing a mixed grid against
  // one category's figure would be a number that means nothing. The caller
  // passes null when no category filter is on — this asserts the consequence.
  const unfiltered = Array.from({ length: 4 }, () => shop({ distanceKm: 5 }));
  assert.ok(!offerableExploreLenses(unfiltered).includes('budget'));

  const filtered = [
    shop({ budgetFitRatio: 1 }),
    shop({ budgetFitRatio: 0.4 }),
    shop({ budgetFitRatio: 1 }),
  ];
  assert.ok(offerableExploreLenses(filtered).includes('budget'));
});

test('every offerable lens is one the owner approved — no new ones', () => {
  const many = Array.from({ length: 6 }, (_, i) =>
    shop({ distanceKm: i, budgetFitRatio: 1, firstVerifiedAt: new Date().toISOString() }),
  );
  for (const k of offerableExploreLenses(many)) {
    assert.ok(LENS_ORDER.includes(k), `${k} is not one of the approved lenses`);
  }
});

// ── One scorer, not two ───────────────────────────────────────────────────

test('the weights ARE the registry’s — this surface defines none of its own', () => {
  for (const k of EXPLORE_LENS_ORDER) {
    assert.equal(exploreLensWeights(k), LENSES[k].weights, `${k} must reuse the registry object`);
  }
  assert.equal(exploreLensWeights('fit'), COMPAT_WEIGHTS, 'the default lens is the default vector');
});

test('the default lens leaves ordering as the caller had it', () => {
  // Nothing about "Best matches" should reshuffle a grid whose shops are
  // indistinguishable — that is what makes the empty-marketplace case safe.
  const a = shop(), b = shop(), c = shop();
  assert.deepEqual(orderByExploreLens([a, b, c], 'fit'), [a, b, c]);
});

// ── Ordering behaviour ────────────────────────────────────────────────────

test('a lens re-orders and never removes', () => {
  const near = shop({ distanceKm: 1 });
  const far = shop({ distanceKm: 80 });
  const out = orderByExploreLens([far, near], 'near');
  assert.equal(out.length, 2, 'nothing is dropped');
  assert.equal(out[0], near, 'the nearer shop leads under the nearest lens');
});

test('ties keep the incoming order, so the existing ranking survives underneath', () => {
  // 🪤 THIS TEST WAS DECORATION AND MUTATION TESTING PROVED IT. Both fixtures
  // were `shop({ distanceKm: 5 })` — structurally IDENTICAL — and `deepEqual`
  // compares by VALUE, so `[a, b]` deep-equals `[b, a]` and reversing the tie
  // comparator passed. **An ordering test on indistinguishable fixtures cannot
  // fail.** They carry a tag the projection never reads, so the score is still
  // identical while the objects are not.
  const first = { ...shop({ distanceKm: 5 }), tag: 'first' };
  const second = { ...shop({ distanceKm: 5 }), tag: 'second' };
  assert.equal(
    exploreLensScore(first, 'near'),
    exploreLensScore(second, 'near'),
    'the two must genuinely tie, or this proves nothing about ties',
  );
  assert.deepEqual(
    orderByExploreLens([first, second], 'near').map((v) => v.tag),
    ['first', 'second'],
  );
  assert.deepEqual(
    orderByExploreLens([second, first], 'near').map((v) => v.tag),
    ['second', 'first'],
  );
});

test('an unmeasured shop is neutral, never penalised out of the grid', () => {
  // A shop we know nothing about must not sink below one we know is a poor fit.
  const unknown = shop();
  const wayOverBudget = shop({ budgetFitRatio: 0.05 });
  const out = orderByExploreLens([wayOverBudget, unknown], 'budget');
  assert.equal(out[0], unknown, 'unknown outranks known-bad');
  assert.ok(
    exploreLensScore(unknown, 'budget') > exploreLensScore(wayOverBudget, 'budget'),
  );
});

test('the budget lens does not rank by the SIZE of a price', () => {
  // priceFitScore is flat 1.0 for everything within budget, so a cheap and a
  // dear shop that both fit tie exactly. That tie is the whole difference
  // between segmentation and selling placement.
  const cheapButFits = shop({ budgetFitRatio: 1 });
  const dearButFits = shop({ budgetFitRatio: 1 });
  assert.equal(
    exploreLensScore(cheapButFits, 'budget'),
    exploreLensScore(dearButFits, 'budget'),
  );
});
