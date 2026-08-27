/**
 * GUARD — a wake plans its own farewell, and a wedding never sees it.
 *
 * ── WHAT THIS EXISTS FOR ────────────────────────────────────────────────────
 * A wake borrowed the WEDDING's plan wholesale. `PLAN_GROUPS` had no notion of
 * an event type at all, so the funeral home — the single largest thing a family
 * arranges, chosen within hours of a death — bucketed into **"Logistics & Misc"**
 * beside the giveaways and the security detail. Nothing errored. The number was
 * filed under the wrong heading, on the screen a grieving family uses to work
 * out what they can afford.
 *
 * Owner 2026-08-27, having ruled that death-care suppliers are listed:
 * *"1 first then 2 after."* This is the after.
 *
 * ── THE TWO DIRECTIONS, AND THE SECOND IS THE ONE THAT BITES ────────────────
 * 🚨 It is not enough that a wake GAINS its sections. A wedding must not gain
 * them. An unscoped group belongs to every type, so the failure mode of a
 * half-done job is *"Choose the funeral home"* appearing on a couple's budget
 * screen — which is the kind of thing nobody tests for because nobody imagines
 * writing it.
 *
 * 🔑 AND THE FILTER IS ON THE RENDER, NEVER ON THE BUCKETING.
 * `planGroupForCategory` stays deliberately unfiltered: a stored pick must
 * resolve to its group whatever screen is asking, or a category could become
 * unbucketable when read from the wrong context — which is exactly how a pick
 * ends up swept into a fallback bucket, the defect this whole change reverses.
 * Rule 5 pins that distinction in place.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PLAN_GROUPS,
  planGroupsForEventType,
  planGroupForCategory,
} from './wedding-plan-groups';

const FAREWELL_IDS = ['farewell_home', 'farewell_cremation', 'farewell_memorial_park'] as const;

test('1 · a wake sees its own three sections', () => {
  const ids = planGroupsForEventType('wake').map((g) => g.id);
  for (const id of FAREWELL_IDS) {
    assert.ok(ids.includes(id), `a wake cannot see ${id} — its own plan section is missing`);
  }
});

test('2 · 🚨 a wedding never sees a funeral section', () => {
  const ids = planGroupsForEventType('wedding').map((g) => g.id);
  const leaked = FAREWELL_IDS.filter((id) => ids.includes(id));
  assert.deepEqual(
    leaked,
    [],
    `a wedding's plan shows ${leaked.join(', ')}. "Choose the funeral home" would ` +
      `render on a couple's budget screen.`,
  );
});

test('3 · …and neither does any other celebration, nor an unknown type', () => {
  // The default matters: an event type this build has never heard of must fall
  // back to the wedding-shaped plan, NOT to everything-including-the-farewell.
  for (const t of ['birthday', 'debut', 'christening', 'travel', 'corporate', 'pet_adoption', null]) {
    const ids = planGroupsForEventType(t).map((g) => g.id);
    const leaked = FAREWELL_IDS.filter((id) => ids.includes(id));
    assert.deepEqual(leaked, [], `${String(t)} sees ${leaked.join(', ')}`);
  }
});

test('4 · the wedding plan is UNCHANGED — every other card still shows', () => {
  /*
    ⚠ THE LOAD-BEARING ONE. Adding a scope to the new groups is additive only if
    every EXISTING group stayed unscoped. A stray `eventTypes` on a wedding card
    would silently delete a section from every couple's plan, and rules 1–3
    would all still pass.

    🪤 THE FIRST VERSION OF THIS RULE WAS DECORATION, and mutation is the only
    reason I know. It derived `expected` from PLAN_GROUPS-minus-farewell and
    compared it to planGroupsForEventType('wedding') — but adding
    `eventTypes: ['wedding']` to an existing card leaves it in BOTH sides, so the
    two moved together and agreed. Two halves wrong in the same direction agree
    with each other perfectly.

    What actually needs asserting is the SCOPE SET itself: exactly three groups
    carry an `eventTypes`, and they are the farewell ones. Anything else with a
    scope has been quietly removed from every type it does not name — a birthday
    losing its logistics card, with nothing thrown.
  */
  const scoped = PLAN_GROUPS.filter((g) => g.eventTypes).map((g) => g.id).sort();
  assert.deepEqual(
    scoped,
    [...FAREWELL_IDS].sort(),
    `these plan cards carry an event-type scope: ${scoped.join(', ')}. Only the ` +
      `three farewell cards may — a scope on any other card silently deletes it ` +
      `from every type it does not name.`,
  );
  const weddingIds = planGroupsForEventType('wedding').map((g) => g.id);
  // Floor: if PLAN_GROUPS were ever emptied this file would pass vacuously.
  assert.ok(weddingIds.length >= 30, `only ${weddingIds.length} wedding plan cards — the list collapsed`);
});

test('5 · 🔑 bucketing is NOT scoped — a pick resolves from any screen', () => {
  // The filter is a rendering decision. If it leaked into resolution, a stored
  // funeral_home pick read from a context that did not know the event type
  // would resolve to null and be swept into the fallback bucket — recreating
  // the exact defect this change reverses, one layer down.
  assert.equal(planGroupForCategory('funeral_home'), 'farewell_home');
  assert.equal(planGroupForCategory('cremation'), 'farewell_cremation');
  assert.equal(planGroupForCategory('memorial_park'), 'farewell_memorial_park');
});

test('6 · ⏱ a farewell card never carries a countdown', () => {
  /*
    Every other card answers "how many months before the day should this be
    locked". A death is not planned. `monthsBefore: 0` is the only honest value
    — and it is asserted rather than described, because a well-meaning tidy-up
    ("surely this should be 1?") would put a countdown on a funeral.
  */
  for (const id of FAREWELL_IDS) {
    const g = PLAN_GROUPS.find((x) => x.id === id);
    assert.ok(g, `${id} is gone from PLAN_GROUPS`);
    assert.equal(
      g.monthsBefore,
      0,
      `${id} has a ${g.monthsBefore}-month lead time — that is a countdown to a funeral`,
    );
  }
});

test('7 · the farewell cards speak in the solemn register', () => {
  // Not decoration: the copy tables are keyed by id and a missing entry is a
  // compile error, but WRONG copy is not. These three words are the ones that
  // would read as a planner nagging a bereaved family.
  const banned = /\block\b|hurry|deadline|book now|don.t miss/i;
  for (const id of FAREWELL_IDS) {
    const g = PLAN_GROUPS.find((x) => x.id === id)!;
    assert.doesNotMatch(g.hint, banned, `${id}'s hint reads like a planner nagging a bereaved family`);
    assert.doesNotMatch(g.label, banned, `${id}'s label does`);
  }
});
