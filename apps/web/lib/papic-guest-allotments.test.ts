/**
 * GUARD — the couple's split adds up, and says so in words they can read.
 *
 * 🔑 THIS EXECUTES THE RULE, IT DOES NOT MATCH ITS TEXT. `papic-guest-allotments.ts`
 * has no imports for exactly this reason: a guard that greps for a formula
 * passes on a comment describing the formula. Same discipline as
 * `papic-guest-quota-mirrors-sql.test.ts`.
 *
 * ⚠ EVERY ASSERTION BELOW WAS MUTATION-TESTED — see the changelog fragment for
 * the before → after occurrence counts. An unmeasured sabotage proves nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ALLOTMENT_RPC,
  ALLOTMENT_STORAGE,
  ROLE_MULTIPLIER,
  splitTheRest,
  suggestedAllotment,
  summariseAllotments,
  orderAllotmentPickerRows,
} from './papic-guest-allotments';

/** The worked example the couple actually reads, end to end. */
const WORKED = {
  pot: 1632,
  guestCount: 120,
  named: [4, 4, 4, 4, 4, 4, 4, 4],
  everyoneElse: null,
};

test('the worked example divides exactly as the line claims', () => {
  const split = splitTheRest(WORKED);
  assert.equal(split.namedTotal, 32);
  assert.equal(split.unnamedCount, 112);
  assert.equal(split.perHead, 14);
  assert.equal(split.spare, 32);
  assert.equal(split.overCommitted, false);
  // 14 × 112 + 32 named + 32 spare = 1,632. Nothing is invented and nothing
  // silently disappears — the three parts equal the pot.
  assert.equal(split.perHead * split.unnamedCount + split.namedTotal + split.spare, WORKED.pot);
});

test('🚨 a blank box is not a number', () => {
  // NULL means "work it out for me" and derives 14. An explicit figure is
  // obeyed. Collapsing them would silently re-divide the whole celebration
  // because somebody cleared the field to retype it.
  const derived = splitTheRest({ ...WORKED, everyoneElse: null });
  const explicit = splitTheRest({ ...WORKED, everyoneElse: 5 });

  assert.equal(derived.perHead, 14);
  assert.equal(explicit.perHead, 5);
  assert.notEqual(derived.perHead, explicit.perHead);
  // And the credits a smaller share does not spend are still there, as spare.
  assert.equal(explicit.spare, 1600 - 5 * 112);
});

test('🚨 nobody is ever shown "0 credits each"', () => {
  // A 200-guest celebration holding only the free grant divides to 0, and a
  // ceiling of 0 would refuse every guest their FIRST photograph. The database
  // ends with GREATEST(1, …) for exactly this; the sheet must not disagree.
  const thin = splitTheRest({ pot: 50, guestCount: 200, named: [], everyoneElse: null });
  assert.equal(thin.perHead, 1, 'the floor of 1 is a fairness rule, not a rounding artefact');
  assert.ok(!/ 0 credits each/.test(summariseAllotments({ pot: 50, guestCount: 200, named: [], everyoneElse: null })));
  // Over-committed still yields 1, because the database clamps to 0 before
  // dividing and then floors at 1. The flag warns; it does not change the number.
  const over = splitTheRest({ pot: 100, guestCount: 10, named: [80, 80], everyoneElse: null });
  assert.equal(over.overCommitted, true);
  assert.equal(over.perHead, 1);
});

test('🚨 over-commitment is REPORTED, never clamped', () => {
  // A sheet that quietly caps itself adds up on screen while the database
  // refuses guests all night, and the couple never learns why.
  const split = splitTheRest({ pot: 100, guestCount: 10, named: [80, 80], everyoneElse: null });
  assert.equal(split.overCommitted, true);
  assert.equal(split.namedTotal, 160);
  assert.match(summariseAllotments({ pot: 100, guestCount: 10, named: [80, 80], everyoneElse: null }), /60 credits more than this celebration holds/);
});

test("the couple's own number cannot promise more than the celebration holds", () => {
  // 1,600 over 112 guests derives 14. Asking for 500 each is not refused with
  // an error — it is capped at what is actually there, which is the honest
  // number and the one the database will enforce.
  const greedy = splitTheRest({ ...WORKED, everyoneElse: 500 });
  assert.equal(greedy.perHead, 14);
  // A number BELOW the derived share is obeyed exactly, and the difference
  // becomes spare rather than evaporating.
  const modest = splitTheRest({ ...WORKED, everyoneElse: 10 });
  assert.equal(modest.perHead, 10);
  assert.equal(modest.spare, 1600 - 10 * 112);
});

test('when everyone on the list is named, the remainder is spare — not divided by zero', () => {
  const split = splitTheRest({ pot: 100, guestCount: 2, named: [10, 10], everyoneElse: null });
  assert.equal(split.unnamedCount, 0);
  assert.equal(split.perHead, 0);
  assert.equal(split.spare, 80);
  assert.ok(Number.isFinite(split.perHead), 'perHead must never be Infinity or NaN');
  assert.match(summariseAllotments({ pot: 100, guestCount: 2, named: [10, 10], everyoneElse: null }), /everyone on your list is named/);
});

test('sponsors default to a BIGGER share, in the ceremony order that earns it', () => {
  assert.ok(ROLE_MULTIPLIER.principal > ROLE_MULTIPLIER.cord, 'a ninong outranks a cord sponsor');
  assert.ok(ROLE_MULTIPLIER.cord > ROLE_MULTIPLIER.guest, 'a cord sponsor outranks a plus-one');
  for (const secondary of ['cord', 'veil', 'coin', 'candle'] as const) {
    assert.equal(ROLE_MULTIPLIER[secondary], ROLE_MULTIPLIER.cord, `${secondary} is a secondary tier`);
  }
  // It scales the ordinary share rather than naming an amount — a hard-coded
  // "give a ninong 60" is extravagant at a 40-guest civil ceremony and
  // insulting at a 400-guest reception.
  assert.equal(suggestedAllotment('principal', 14), 42);
  assert.equal(suggestedAllotment('cord', 14), 28);
  assert.equal(suggestedAllotment('guest', 14), 14);
  // Rounded UP, so a role that earns more never lands on less through flooring.
  assert.equal(suggestedAllotment('principal', 5) % 1, 0);
  assert.ok(suggestedAllotment('principal', 5) >= 15);
  // Nothing to scale means nothing suggested — never NaN in a number box.
  assert.equal(suggestedAllotment('principal', 0), 0);
});

test('🚨 the copy says CREDITS, and never a bare "per guest"', () => {
  const line = summariseAllotments(WORKED);
  assert.equal(line, '120 guests · 8 named · everyone else gets 14 credits each · 32 spare');
  // The currency meaning is a CREDIT (32df56e81). "Shot" is still correct for a
  // photograph, but this line is about money and must not say it.
  assert.ok(!/\bshots?\b/i.test(line), 'the currency reads credits, never shots');
  // 🔑 `papic_event_pool_config.points_per_guest` (the POOL MULTIPLIER, default
  // 150) and GUEST_CAPTURE_CREDITS (what one guest may SPEND, also 150) are two
  // different numbers wearing one phrase. This control adds a third. A bare
  // "per guest" here would teach the couple a wrong model of their own night.
  assert.ok(!/per guest/i.test(line), 'say what the number does, never a bare "per guest"');
});

test('the storage contract is collected in ONE object, in schema vocabulary', () => {
  // Adopting the ceiling migration's real names must be an edit to one file.
  // If these strings start appearing inline in the action or the component, a
  // rename will half-land.
  const names = Object.values(ALLOTMENT_STORAGE);
  assert.equal(new Set(names).size, names.length, 'no duplicate column names');
  for (const name of names) {
    assert.match(name, /^[a-z][a-z0-9_]*$/, `${name} must be a bare snake_case identifier`);
    assert.ok(!/credit/.test(name), `${name}: the schema says points, not credits`);
  }
  // ⚠ NOT a bare `points_per_guest` — that name is taken by the pool multiplier
  // and means something else entirely.
  assert.ok(
    !names.includes('points_per_guest' as (typeof names)[number]),
    'points_per_guest is the POOL MULTIPLIER — a spend ceiling must not borrow it',
  );
});

test('the contract matches the ceiling migration exactly', () => {
  // 🔑 THESE ARE NOT NAMES THIS SESSION CHOSE. They are the ceiling migration's
  // own, adopted verbatim (20271184624871). If a rename lands there, it lands
  // here in the same edit or the sheet writes into columns that do not exist.
  assert.equal(ALLOTMENT_STORAGE.enabled, 'papic_guest_spend_ceiling_on');
  assert.equal(ALLOTMENT_STORAGE.everyoneElse, 'papic_guest_spend_ceiling_points');
  assert.equal(ALLOTMENT_STORAGE.releasedAt, 'papic_guest_spend_ceiling_released_at');
  assert.equal(ALLOTMENT_STORAGE.table, 'papic_guest_spend_ceilings');
  assert.equal(ALLOTMENT_RPC.setOne, 'papic_set_guest_spend_ceiling');
  assert.equal(ALLOTMENT_RPC.release, 'papic_set_guest_spend_ceiling_release');
  assert.equal(ALLOTMENT_RPC.resolve, 'papic_guest_spend_ceiling');
  // 🪤 The head count comes from its OWN function. papic_event_pool_status's
  // guest_count is a literal 0 on every non-flat-pass event — i.e. on every
  // celebration this row is drawn on — so dividing by it is nonsense.
  assert.equal(ALLOTMENT_RPC.headcount, 'papic_event_guest_headcount');
});

/* ── The picker: finding one guest among two hundred ────────────────────────
 *
 * Owner, 2026-08-31: *"there might be over 200 guests, and we should not list
 * them all. or let the user search a guest from the list and show what they
 * have?"*
 */

test('an empty query returns EVERYBODY — search is a filter, never a gate', () => {
  const guests = [
    { guestId: 'a', name: 'Ana', saved: null },
    { guestId: 'b', name: 'Ben', saved: 40 },
  ];
  assert.equal(orderAllotmentPickerRows(guests, '').length, 2);
  assert.equal(orderAllotmentPickerRows(guests, '   ').length, 2, 'whitespace is not a query');
});

test('NAMED GUESTS COME FIRST — the couple’s own choices are never buried', () => {
  // Alphabetically Ana/Cara/Zeny come before/around Ben; by NAMED they must not.
  const guests = [
    { guestId: 'a', name: 'Ana', saved: null },
    { guestId: 'b', name: 'Ben', saved: 40 },
    { guestId: 'c', name: 'Cara', saved: null },
    { guestId: 'z', name: 'Zeny', saved: 12 },
  ];
  assert.deepEqual(
    orderAllotmentPickerRows(guests, '').map((g) => g.guestId),
    ['b', 'z', 'a', 'c'],
  );
});

test('ZERO IS A NAMED GUEST — "may not spend" is a choice, not an absence', () => {
  // The documented way to exclude somebody. A truthiness test would sort her
  // in with the un-named and hide the couple's most surprising decision at the
  // bottom of a 200-row list.
  const guests = [
    { guestId: 'a', name: 'Ana', saved: null },
    { guestId: 'lola', name: 'Lola Remy', saved: 0 },
  ];
  assert.deepEqual(
    orderAllotmentPickerRows(guests, '').map((g) => g.guestId),
    ['lola', 'a'],
    'a guest set to 0 must sort with the named',
  );
});

test('within each group the incoming (alphabetical) order is kept', () => {
  const guests = [
    { guestId: 'a', name: 'Ana', saved: 5 },
    { guestId: 'b', name: 'Ben', saved: 5 },
    { guestId: 'c', name: 'Cara', saved: null },
    { guestId: 'd', name: 'Dina', saved: null },
  ];
  assert.deepEqual(
    orderAllotmentPickerRows(guests, '').map((g) => g.guestId),
    ['a', 'b', 'c', 'd'],
    'the partition must be stable, not a re-sort',
  );
});

test('matching is case-insensitive substring — what somebody typing "lola" expects', () => {
  const guests = [
    { guestId: 'lola', name: 'Lola Remy', saved: null },
    { guestId: 'tito', name: 'Tito Gener', saved: null },
  ];
  for (const q of ['lola', 'LOLA', 'Lola', 'remy', 'la re']) {
    assert.deepEqual(
      orderAllotmentPickerRows(guests, q).map((g) => g.guestId),
      ['lola'],
      `"${q}" must find Lola Remy`,
    );
  }
});

test('a query that matches nobody returns nothing — never the whole list', () => {
  const guests = [{ guestId: 'a', name: 'Ana', saved: null }];
  assert.deepEqual(orderAllotmentPickerRows(guests, 'zzz'), []);
});

test('named-first still holds WHILE searching', () => {
  const guests = [
    { guestId: 'm1', name: 'Maria Cruz', saved: null },
    { guestId: 'm2', name: 'Maria Santos', saved: 60 },
    { guestId: 'x', name: 'Pedro', saved: 99 },
  ];
  assert.deepEqual(
    orderAllotmentPickerRows(guests, 'maria').map((g) => g.guestId),
    ['m2', 'm1'],
    'the named Maria first, and Pedro excluded despite being named',
  );
});

test('the source list is never mutated', () => {
  const guests = [
    { guestId: 'a', name: 'Ana', saved: null },
    { guestId: 'b', name: 'Ben', saved: 40 },
  ];
  const before = guests.map((g) => g.guestId);
  orderAllotmentPickerRows(guests, '');
  assert.deepEqual(guests.map((g) => g.guestId), before, 'ordering must not reorder the input');
});
