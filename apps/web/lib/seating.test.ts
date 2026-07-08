/**
 * Unit suite for groupTablesIntoUnits (smart seat-plan · Phase 1 — combined
 * linked-table seat count). Load-bearing invariant: tables sharing a
 * link_group_id collapse into ONE display unit whose `capacity` is the sum of
 * each member's *effective* seats (removed chairs excluded), so the editor lists
 * and the caterer count the joined unit once ("Table 3 & 4 · 20 seats").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupTablesIntoUnits,
  computeAutoSeat,
  solveSeatPlan,
  relaxLowestPriorityRule,
  recommendTableSet,
  tableNumberEndsInFour,
  defaultPriorityOrder,
  parsePriorityOrder,
  resolvePriorityRank,
  computeGuestSwap,
  computeTableSwap,
  type EventTableRow,
  type AutoSeatGuest,
  type PriorityOrder,
  type KeepApartRule,
  type RecommendGuest,
  type SeatAssignmentRow,
} from './seating';

// Checked index access — the repo typechecks with noUncheckedIndexedAccess, so a
// bare units[i] is T | undefined. Asserts presence and returns the element.
function at<T>(arr: T[], i: number): T {
  const v = arr[i];
  assert.ok(v, `expected an element at index ${i}`);
  return v;
}

// A minimal table row. Only the fields groupTablesIntoUnits reads are required;
// the rest are filled with harmless defaults so the literal types EventTableRow.
function tbl(over: Partial<EventTableRow> & Pick<EventTableRow, 'table_id'>): EventTableRow {
  return {
    public_id: over.table_id,
    event_id: 'evt',
    table_label: over.table_id,
    table_type: 'round_10',
    capacity: 10,
    sort_order: 0,
    x_pos: 0,
    y_pos: 0,
    rotation_deg: 0,
    removed_seats: [],
    qr_token: '',
    qr_published_at: null,
    link_group_id: null,
    link_group_label: null,
    ...over,
  } as EventTableRow;
}

test('unlinked tables each become a one-member unit at full effective capacity', () => {
  const units = groupTablesIntoUnits([
    tbl({ table_id: 'a', table_label: 'Table 1', capacity: 10 }),
    tbl({ table_id: 'b', table_label: 'Table 2', capacity: 8 }),
  ]);
  assert.equal(units.length, 2);
  assert.equal(at(units, 0).label, 'Table 1');
  assert.equal(at(units, 0).isLinked, false);
  assert.equal(at(units, 0).members.length, 1);
  assert.equal(at(units, 0).capacity, 10);
  assert.equal(at(units, 1).capacity, 8);
});

test('linked tables collapse into one unit with the combined seat count', () => {
  const units = groupTablesIntoUnits([
    tbl({ table_id: 'a', table_label: 'Table 3', capacity: 10, link_group_id: 'g1', link_group_label: 'Table 3 & 4' }),
    tbl({ table_id: 'b', table_label: 'Table 4', capacity: 10, link_group_id: 'g1', link_group_label: 'Table 3 & 4' }),
  ]);
  assert.equal(units.length, 1);
  const u = at(units, 0);
  assert.equal(u.key, 'g1');
  assert.equal(u.label, 'Table 3 & 4');
  assert.equal(u.isLinked, true);
  assert.equal(u.members.length, 2);
  assert.equal(u.lead.table_id, 'a'); // first member anchors the unit
  assert.equal(u.capacity, 20); // 10 + 10 counted once as a pool
});

test('combined capacity excludes removed chairs across every member', () => {
  const units = groupTablesIntoUnits([
    tbl({ table_id: 'a', capacity: 10, removed_seats: [0, 1], link_group_id: 'g1', link_group_label: 'Joined' }),
    tbl({ table_id: 'b', capacity: 10, removed_seats: [9], link_group_id: 'g1', link_group_label: 'Joined' }),
  ]);
  assert.equal(units.length, 1);
  assert.equal(at(units, 0).capacity, 17); // (10-2) + (10-1)
});

test('empty input yields no units; a lone table carrying a link_group_id is a 1-member linked unit', () => {
  assert.deepEqual(groupTablesIntoUnits([]), []);
  // A degenerate link group with a single member still reports isLinked (the
  // lead carries a link_group_id) but counts as one table's worth of seats.
  const units = groupTablesIntoUnits([
    tbl({ table_id: 'solo', capacity: 10, link_group_id: 'g9', link_group_label: 'Head Table' }),
  ]);
  assert.equal(units.length, 1);
  assert.equal(at(units, 0).isLinked, true);
  assert.equal(at(units, 0).members.length, 1);
  assert.equal(at(units, 0).label, 'Head Table');
  assert.equal(at(units, 0).capacity, 10);
});

test('a mix of linked and unlinked tables yields one unit per link group plus singles', () => {
  const units = groupTablesIntoUnits([
    tbl({ table_id: 'a', table_label: 'Table 1' }),
    tbl({ table_id: 'b', link_group_id: 'g1', link_group_label: 'Sponsors' }),
    tbl({ table_id: 'c', link_group_id: 'g1', link_group_label: 'Sponsors' }),
    tbl({ table_id: 'd', table_label: 'Table 5' }),
  ]);
  assert.equal(units.length, 3);
  assert.deepEqual(
    units.map((u) => u.members.length),
    [1, 2, 1],
  );
  // First-seen order is preserved (tables arrive pre-sorted).
  assert.deepEqual(
    units.map((u) => u.label),
    ['Table 1', 'Sponsors', 'Table 5'],
  );
});

// ---------------------------------------------------------------------------
// Smart seat-plan · Phase 2 — draggable seating priority order. Load-bearing
// invariant: the tier order decides who fills the stage-closest tables first;
// null = the default 1→2→3→4 fill (back-compatible).
// ---------------------------------------------------------------------------

function guest(over: Partial<AutoSeatGuest> & Pick<AutoSeatGuest, 'guest_id'>): AutoSeatGuest {
  return {
    role: 'friend',
    group_category: 'friends',
    rsvp_status: 'attending',
    plus_one_of_guest_id: null,
    last_name: over.guest_id,
    first_name: over.guest_id,
    group_id: null,
    seating_priority: null,
    ...over,
  };
}

test('defaultPriorityOrder lists the 4 role tiers, highest first, with canonical labels', () => {
  const order = defaultPriorityOrder();
  assert.deepEqual(
    order.map((o) => o.tier),
    [1, 2, 3, 4],
  );
  assert.equal(order[0]?.label, 'Family & principal sponsors');
});

test('parsePriorityOrder keeps valid reorders, de-dupes, and rejects junk', () => {
  // Reorder + dedupe; labels are re-derived (input labels ignored).
  const parsed = parsePriorityOrder([{ tier: 2, label: 'whatever' }, { tier: 1 }, { tier: 2 }]);
  assert.deepEqual(parsed?.map((o) => o.tier), [2, 1]);
  assert.equal(parsed?.[0]?.label, 'Entourage'); // canonical, not "whatever"
  // Malformed / empty → null (callers fall back to the default).
  assert.equal(parsePriorityOrder(null), null);
  assert.equal(parsePriorityOrder('nope'), null);
  assert.equal(parsePriorityOrder([{ tier: 9 }, {}]), null);
  assert.equal(parsePriorityOrder([]), null);
});

test('resolvePriorityRank: null → default ranks; a reorder flips them; missing tiers fall to the end', () => {
  assert.deepEqual(resolvePriorityRank(null), { 1: 0, 2: 1, 3: 2, 4: 3 });
  const order: PriorityOrder = [
    { tier: 2, label: 'Entourage' },
    { tier: 1, label: 'Family & principal sponsors' },
  ];
  // 2 and 1 ranked first (0,1); the unlisted 3,4 keep a stable tail (2,3).
  assert.deepEqual(resolvePriorityRank(order), { 2: 0, 1: 1, 3: 2, 4: 3 });
});

test('computeAutoSeat: the priority order decides who gets the stage-closest table', () => {
  const stage = { x: 50, y: 8 };
  // One seat per table so the first-seated guest takes the nearer table.
  const near = tbl({ table_id: 'near', capacity: 1, x_pos: 50, y_pos: 15 });
  const far = tbl({ table_id: 'far', capacity: 1, x_pos: 50, y_pos: 90 });
  // Tier set by the explicit seating_priority override (independent of role).
  const a = guest({ guest_id: 'a', seating_priority: 1 }); // tier 1
  const b = guest({ guest_id: 'b', seating_priority: 2 }); // tier 2
  const tableOf = (rows: ReturnType<typeof computeAutoSeat>, id: string) =>
    rows.find((r) => r.guest_id === id)?.table_id;

  // Default order (1→2): tier-1 'a' takes the near table.
  const def = computeAutoSeat([near, far], [a, b], [], stage, null);
  assert.equal(tableOf(def, 'a'), 'near');
  assert.equal(tableOf(def, 'b'), 'far');

  // Reordered (tier 2 first): now tier-2 'b' takes the near table.
  const reordered: PriorityOrder = [
    { tier: 2, label: 'Entourage' },
    { tier: 1, label: 'Family & principal sponsors' },
    { tier: 3, label: 'Extended family' },
    { tier: 4, label: 'Friends & others' },
  ];
  const re = computeAutoSeat([near, far], [a, b], [], stage, reordered);
  assert.equal(tableOf(re, 'b'), 'near');
  assert.equal(tableOf(re, 'a'), 'far');
});

// ---------------------------------------------------------------------------
// Smart seat-plan · Phase 3 — keep-apart constraint solver (solveSeatPlan).
// Load-bearing invariants: keep-apart is HARD + GROUP-AWARE + LINK-GROUP-AWARE;
// the solver degrades gracefully (best-effort + violations, never throws) and is
// deterministic.
// ---------------------------------------------------------------------------

const STAGE = { x: 50, y: 8 };
// Link-group unit key the solver uses for "same table" (linked tables = 1 pool).
const unitKey = (tables: EventTableRow[], tableId: string) => {
  const t = tables.find((x) => x.table_id === tableId);
  return t?.link_group_id ?? tableId;
};
const seatTableOf = (rows: { guest_id: string; table_id: string }[], id: string) =>
  rows.find((r) => r.guest_id === id)?.table_id;

test('solveSeatPlan with no rules returns the plain warm-start (back-compatible)', () => {
  const tables = [tbl({ table_id: 't1', capacity: 10, x_pos: 50, y_pos: 15 })];
  const guests = [guest({ guest_id: 'a' }), guest({ guest_id: 'b' })];
  const warm = computeAutoSeat(tables, guests, [], STAGE, null);
  const res = solveSeatPlan({ tables, guests, assignments: [], stage: STAGE, constraints: [] });
  assert.deepEqual(res.assignments, warm);
  assert.equal(res.totalRules, 0);
  assert.deepEqual(res.violations, []);
});

test('solveSeatPlan separates a keep-apart pair onto different tables (satisfiable)', () => {
  // Two roomy tables; warm-start co-seats both at the nearer one → the solver moves one.
  const tables = [
    tbl({ table_id: 'near', capacity: 10, x_pos: 50, y_pos: 15 }),
    tbl({ table_id: 'far', capacity: 10, x_pos: 50, y_pos: 90 }),
  ];
  const guests = [guest({ guest_id: 'a' }), guest({ guest_id: 'b' })];
  const constraints: KeepApartRule[] = [{ guest_a_id: 'a', guest_b_id: 'b' }];
  const res = solveSeatPlan({ tables, guests, assignments: [], stage: STAGE, constraints });
  assert.notEqual(seatTableOf(res.assignments, 'a'), seatTableOf(res.assignments, 'b'));
  assert.deepEqual(res.violations, []);
  assert.equal(res.satisfiedCount, 1);
  assert.equal(res.totalRules, 1);
});

test('solveSeatPlan is GROUP-AWARE: a pair rule separates both guests whole groups', () => {
  const tables = [
    tbl({ table_id: 'near', capacity: 10, x_pos: 50, y_pos: 15 }),
    tbl({ table_id: 'far', capacity: 10, x_pos: 50, y_pos: 90 }),
  ];
  // A,A2 in group G1; B,B2 in group G2. Rule is only on (a,b).
  const guests = [
    guest({ guest_id: 'a', group_id: 'G1' }),
    guest({ guest_id: 'a2', group_id: 'G1' }),
    guest({ guest_id: 'b', group_id: 'G2' }),
    guest({ guest_id: 'b2', group_id: 'G2' }),
  ];
  const groupMembers = new Map<string, string[]>([
    ['a', ['G1']],
    ['a2', ['G1']],
    ['b', ['G2']],
    ['b2', ['G2']],
  ]);
  const constraints: KeepApartRule[] = [{ guest_a_id: 'a', guest_b_id: 'b' }];
  const res = solveSeatPlan({ tables, guests, assignments: [], stage: STAGE, constraints, groupMembers });
  // No G1 member may share a unit with any G2 member — even though only (a,b) was a rule.
  const g1 = ['a', 'a2'];
  const g2 = ['b', 'b2'];
  for (const x of g1) {
    for (const y of g2) {
      assert.notEqual(
        unitKey(tables, seatTableOf(res.assignments, x)!),
        unitKey(tables, seatTableOf(res.assignments, y)!),
        `${x} and ${y} must not share a table`,
      );
    }
  }
  assert.deepEqual(res.violations, []);
});

test('solveSeatPlan is LINK-GROUP-AWARE: keep-apart guests never share a linked unit', () => {
  // Two linked tables (one pool) + one separate table. Warm-start co-seats both
  // in the linked unit; the solver must move one to the unlinked table — putting
  // them on the two linked member tables would NOT satisfy the rule.
  const tables = [
    tbl({ table_id: 'L1', capacity: 2, x_pos: 48, y_pos: 15, link_group_id: 'L', link_group_label: 'Joined' }),
    tbl({ table_id: 'L2', capacity: 2, x_pos: 52, y_pos: 15, link_group_id: 'L', link_group_label: 'Joined' }),
    tbl({ table_id: 'solo', capacity: 10, x_pos: 50, y_pos: 90 }),
  ];
  const guests = [guest({ guest_id: 'a' }), guest({ guest_id: 'b' })];
  const constraints: KeepApartRule[] = [{ guest_a_id: 'a', guest_b_id: 'b' }];
  const res = solveSeatPlan({ tables, guests, assignments: [], stage: STAGE, constraints });
  assert.notEqual(
    unitKey(tables, seatTableOf(res.assignments, 'a')!),
    unitKey(tables, seatTableOf(res.assignments, 'b')!),
  );
  assert.deepEqual(res.violations, []);
});

test('solveSeatPlan degrades gracefully when over-constrained (best-effort + violations, no throw)', () => {
  // One 2-seat table, two keep-apart guests: impossible to separate.
  const tables = [tbl({ table_id: 'only', capacity: 2, x_pos: 50, y_pos: 15 })];
  const guests = [guest({ guest_id: 'a' }), guest({ guest_id: 'b' })];
  const constraints: KeepApartRule[] = [{ guest_a_id: 'a', guest_b_id: 'b' }];
  const res = solveSeatPlan({ tables, guests, assignments: [], stage: STAGE, constraints });
  assert.equal(res.assignments.length, 2); // everyone still seated
  assert.equal(res.violations.length, 1);
  assert.equal(res.satisfiedCount, 0);
  assert.equal(res.totalRules, 1);
});

test('solveSeatPlan is deterministic — same input yields an identical plan', () => {
  const tables = [
    tbl({ table_id: 'near', capacity: 4, x_pos: 50, y_pos: 15 }),
    tbl({ table_id: 'far', capacity: 4, x_pos: 50, y_pos: 90 }),
  ];
  const guests = [
    guest({ guest_id: 'a' }),
    guest({ guest_id: 'b' }),
    guest({ guest_id: 'c' }),
    guest({ guest_id: 'd' }),
  ];
  const constraints: KeepApartRule[] = [
    { guest_a_id: 'a', guest_b_id: 'b' },
    { guest_a_id: 'c', guest_b_id: 'd' },
  ];
  const r1 = solveSeatPlan({ tables, guests, assignments: [], stage: STAGE, constraints });
  const r2 = solveSeatPlan({ tables, guests, assignments: [], stage: STAGE, constraints });
  assert.deepEqual(r1, r2);
});

// ---------------------------------------------------------------------------
// Smart seat-plan · Phase 4 — relax (explainability). relaxLowestPriorityRule
// drops the rule guarding the least-important guest, keeping VIP separations.
// ---------------------------------------------------------------------------

test('relaxLowestPriorityRule drops the rule guarding the least-important guest', () => {
  const guests = [
    guest({ guest_id: 'a', seating_priority: 1 }), // VIP
    guest({ guest_id: 'b', seating_priority: 1 }), // VIP
    guest({ guest_id: 'c', seating_priority: 4 }), // low priority
    guest({ guest_id: 'd', seating_priority: 4 }), // low priority
  ];
  const rules: KeepApartRule[] = [
    { guest_a_id: 'a', guest_b_id: 'b' }, // protects two VIPs — keep
    { guest_a_id: 'c', guest_b_id: 'd' }, // two low-priority — most expendable
  ];
  assert.deepEqual(relaxLowestPriorityRule(rules, guests, null), { guest_a_id: 'c', guest_b_id: 'd' });
  // A mixed rule (one VIP, one low) is more expendable than an all-VIP rule.
  const mixed: KeepApartRule[] = [
    { guest_a_id: 'a', guest_b_id: 'b' },
    { guest_a_id: 'a', guest_b_id: 'c' },
  ];
  assert.deepEqual(relaxLowestPriorityRule(mixed, guests, null), { guest_a_id: 'a', guest_b_id: 'c' });
  // Empty → null.
  assert.equal(relaxLowestPriorityRule([], guests, null), null);
});

// ---------------------------------------------------------------------------
// RSVP→seat: the auto-seater holds a seat for everyone NOT declined (pending +
// maybe get tentative seats) so the couple can plan the whole room before all
// replies are in. Only declined guests are excluded.
// ---------------------------------------------------------------------------

test('computeAutoSeat seats pending/maybe (held) and excludes only declined', () => {
  const tables = [tbl({ table_id: 't1', capacity: 10, x_pos: 50, y_pos: 15 })];
  const guests = [
    guest({ guest_id: 'att', rsvp_status: 'attending' }),
    guest({ guest_id: 'pend', rsvp_status: 'pending' }),
    guest({ guest_id: 'maybe', rsvp_status: 'maybe' }),
    guest({ guest_id: 'dec', rsvp_status: 'declined' }),
  ];
  const seated = computeAutoSeat(tables, guests, [], { x: 50, y: 8 }, null)
    .map((r) => r.guest_id)
    .sort();
  assert.deepEqual(seated, ['att', 'maybe', 'pend']); // declined left out, the rest held
});

// ---------------------------------------------------------------------------
// Chinese (Tsinoy) tradition · table-4 avoidance (advisory only). The number 4
// (四 ≈ 死, "death") is avoided, so a Chinese wedding's auto-draft skips
// ones-digit-4 table numbers, and the editor warns on a manual one. The rule is
// conservative: only the ONES digit being 4 counts.
// ---------------------------------------------------------------------------

// Pull the trailing number from each generated round-table label so we can assert
// over the actual table numbers (the Sweetheart has no trailing number → null).
function trailingNumber(label: string): number | null {
  const m = /(\d+)\s*$/.exec(label);
  return m ? Number(m[1]) : null;
}

test('tableNumberEndsInFour matches ONLY a ones-digit-4 trailing number', () => {
  // Matches: trailing number whose ones digit is 4.
  for (const label of ['Table 4', 'Table 14', 'Table 24', 'Table 34', 'Table 44', 'Sponsors 4', '104']) {
    assert.equal(tableNumberEndsInFour(label), true, label);
  }
  // No match: 4 not in the ones place, or no trailing number at all.
  for (const label of ['Table 40', 'Table 42', 'Table 1', 'Table 10', 'Sweetheart', 'Table 4B', '', 'Head Table']) {
    assert.equal(tableNumberEndsInFour(label), false, label);
  }
});

test('recommendTableSet default path is byte-identical (Table 1..N, no skip)', () => {
  // 25 non-couple guests → ceil(25/10) = 3 round tables, labelled Table 1..3.
  const guests: RecommendGuest[] = Array.from({ length: 25 }, () => ({
    role: 'guest',
    rsvp_status: 'attending',
  }));
  const def = recommendTableSet(guests);
  const off = recommendTableSet(guests, { skipFour: false });
  // The Sweetheart leads, then the round tables in plain order.
  const expected = [
    { type: 'sweetheart_2', capacity: 2, label: 'Sweetheart' },
    { type: 'round_10', capacity: 10, label: 'Table 1' },
    { type: 'round_10', capacity: 10, label: 'Table 2' },
    { type: 'round_10', capacity: 10, label: 'Table 3' },
  ];
  assert.deepEqual(def, expected);
  assert.deepEqual(off, expected); // explicit skipFour:false === default
});

test('recommendTableSet skipFour:true emits the SAME count with no ones-digit-4 numbers', () => {
  // 55 non-couple guests → ceil(55/10) = 6 round tables. With skip-4, the numbers
  // advance past 4 → Table 1,2,3,5,6,7 (still exactly 6 round tables).
  const guests: RecommendGuest[] = Array.from({ length: 55 }, () => ({
    role: 'guest',
    rsvp_status: 'attending',
  }));
  const def = recommendTableSet(guests);
  const skip = recommendTableSet(guests, { skipFour: true });

  // Same table COUNT (Sweetheart + 6 rounds) on both paths.
  assert.equal(skip.length, def.length);

  // No generated round-table label has a ones-digit-4 trailing number.
  for (const t of skip) {
    const n = trailingNumber(t.label);
    if (n !== null) assert.notEqual(n % 10, 4, `label "${t.label}" must not end in 4`);
  }

  // Exact labels — the skip jumps 4 → 5.
  assert.deepEqual(
    skip.map((t) => t.label),
    ['Sweetheart', 'Table 1', 'Table 2', 'Table 3', 'Table 5', 'Table 6', 'Table 7'],
  );
});

test('recommendTableSet skipFour:true skips every ones-digit-4 across many tables', () => {
  // 200 guests → 20 round tables. Skipping 4,14 yields 1..3,5..13,15..22 (20 tables).
  const guests: RecommendGuest[] = Array.from({ length: 200 }, () => ({
    role: 'guest',
    rsvp_status: 'attending',
  }));
  const skip = recommendTableSet(guests, { skipFour: true });
  const rounds = skip.filter((t) => t.type === 'round_10');
  assert.equal(rounds.length, 20); // requested count preserved
  for (const t of rounds) {
    const n = trailingNumber(t.label);
    assert.ok(n !== null && n % 10 !== 4, `label "${t.label}" must skip ones-digit-4`);
  }
  // The two skipped numbers (4, 14) never appear; the next clean number (22) does.
  const labels = rounds.map((t) => t.label);
  assert.ok(!labels.includes('Table 4'));
  assert.ok(!labels.includes('Table 14'));
  assert.equal(labels[labels.length - 1], 'Table 22');
});

// ---------------------------------------------------------------------------
// Atomic swap logic — computeGuestSwap / computeTableSwap mirror the DB RPCs.
// The DB guarantees atomicity + the physical-chair unique index; these pins
// the client-visible END STATE the RPC produces (no NULL-park artefact leaks).
// ---------------------------------------------------------------------------

function asg(over: Partial<SeatAssignmentRow> & Pick<SeatAssignmentRow, 'guest_id'>): SeatAssignmentRow {
  return {
    assignment_id: `a-${over.guest_id}`,
    table_id: 't1',
    seat_number: 0,
    ...over,
  };
}

test('computeGuestSwap exchanges (table, seat) of two seated guests', () => {
  const rows = [
    asg({ guest_id: 'A', table_id: 't1', seat_number: 2 }),
    asg({ guest_id: 'B', table_id: 't2', seat_number: 5 }),
  ];
  const r = computeGuestSwap(rows, 'A', 'B');
  assert.ok(r);
  // A takes B's chair, B takes A's chair.
  assert.deepEqual(r.a, { tableId: 't2', seatNumber: 5 });
  assert.deepEqual(r.b, { tableId: 't1', seatNumber: 2 });
});

test('computeGuestSwap carries a NULL seat_number (table-only, no chair)', () => {
  const rows = [
    asg({ guest_id: 'A', table_id: 't1', seat_number: null }),
    asg({ guest_id: 'B', table_id: 't2', seat_number: 3 }),
  ];
  const r = computeGuestSwap(rows, 'A', 'B');
  assert.ok(r);
  assert.deepEqual(r.a, { tableId: 't2', seatNumber: 3 });
  assert.deepEqual(r.b, { tableId: 't1', seatNumber: null });
});

test('computeGuestSwap returns null when a guest is unseated (RPC would raise)', () => {
  const rows = [asg({ guest_id: 'A', table_id: 't1', seat_number: 0 })];
  assert.equal(computeGuestSwap(rows, 'A', 'B'), null); // B has no row
  assert.equal(computeGuestSwap(rows, 'A', 'A'), null); // self-swap
});

test('computeGuestSwap never lands two guests on one chair', () => {
  // The whole point of the swap: after it, A and B still occupy exactly the two
  // chairs they collectively held — just exchanged. No chair is doubled.
  const rows = [
    asg({ guest_id: 'A', table_id: 't1', seat_number: 1 }),
    asg({ guest_id: 'B', table_id: 't1', seat_number: 4 }),
  ];
  const r = computeGuestSwap(rows, 'A', 'B');
  assert.ok(r);
  const chairs = [r.a, r.b].map((p) => `${p.tableId}:${p.seatNumber}`);
  assert.equal(new Set(chairs).size, 2, 'the two guests must occupy two distinct chairs');
  assert.deepEqual(chairs.sort(), ['t1:1', 't1:4'].sort());
});

test('computeTableSwap flips table_id for every occupant, keeping seat numbers', () => {
  const rows = [
    asg({ guest_id: 'A', table_id: 't1', seat_number: 0 }),
    asg({ guest_id: 'B', table_id: 't1', seat_number: 1 }),
    asg({ guest_id: 'C', table_id: 't2', seat_number: 0 }),
    asg({ guest_id: 'D', table_id: 't3', seat_number: 0 }), // untouched — other table
  ];
  const moved = computeTableSwap(rows, 't1', 't2');
  assert.equal(moved.size, 3);
  assert.deepEqual(moved.get('A'), { tableId: 't2', seatNumber: 0 });
  assert.deepEqual(moved.get('B'), { tableId: 't2', seatNumber: 1 });
  assert.deepEqual(moved.get('C'), { tableId: 't1', seatNumber: 0 });
  assert.equal(moved.has('D'), false); // guest on t3 not affected
});

test('computeTableSwap keeps every (table, seat) chair unique after the swap', () => {
  // t1 seats {0,1}, t2 seats {0,1} — post-swap the two tables exchange whole
  // rosters, so all four (table,seat) pairs stay distinct.
  const rows = [
    asg({ guest_id: 'A', table_id: 't1', seat_number: 0 }),
    asg({ guest_id: 'B', table_id: 't1', seat_number: 1 }),
    asg({ guest_id: 'C', table_id: 't2', seat_number: 0 }),
    asg({ guest_id: 'D', table_id: 't2', seat_number: 1 }),
  ];
  const moved = computeTableSwap(rows, 't1', 't2');
  const chairs = [...moved.values()].map((p) => `${p.tableId}:${p.seatNumber}`);
  assert.equal(new Set(chairs).size, chairs.length, 'no chair may be double-booked');
});

test('computeTableSwap on identical tables is a no-op', () => {
  const rows = [asg({ guest_id: 'A', table_id: 't1', seat_number: 0 })];
  assert.equal(computeTableSwap(rows, 't1', 't1').size, 0);
});

// ---------------------------------------------------------------------------
// Smart seat-plan · Phase 6 — group-overflow adjacency. When a custom group
// overflows its anchor table, the spillover lands on the table nearest BY FLOOR
// COORDINATES to the anchor, not the next stage-ranked table (which can be
// across the room). Ungrouped guests keep the pure stage-ranked fill.
// ---------------------------------------------------------------------------

// Stage at (50,8): 'anc' is stage-nearest (dist² 3208); 'far' is the NEXT
// stage-ranked table (3281) but physically across the room; 'left' (3364) sits
// right beside 'anc'. So stage order = [anc, far, left] while the anchor's
// physical neighbour is 'left'.
const ADJ_TABLES = [
  tbl({ table_id: 'anc', capacity: 1, x_pos: 12, y_pos: 50 }),
  tbl({ table_id: 'far', capacity: 1, x_pos: 90, y_pos: 49 }),
  tbl({ table_id: 'left', capacity: 1, x_pos: 10, y_pos: 50 }),
];

test('Phase 6: a grouped overflow spills to the physically ADJACENT table, not the next stage-ranked one', () => {
  const g1 = guest({ guest_id: 'g1', group_id: 'grp' });
  const g2 = guest({ guest_id: 'g2', group_id: 'grp' });
  const rows = computeAutoSeat(ADJ_TABLES, [g1, g2], [], { x: 50, y: 8 }, null);
  assert.equal(seatTableOf(rows, 'g1'), 'anc'); // anchor = stage-nearest
  assert.equal(seatTableOf(rows, 'g2'), 'left'); // overflow → nearest to anchor, NOT 'far'
});

test('Phase 6: WITHOUT a group the fill is unchanged (stage order → overflow lands on far)', () => {
  const g1 = guest({ guest_id: 'g1' }); // no group_id
  const g2 = guest({ guest_id: 'g2' });
  const rows = computeAutoSeat(ADJ_TABLES, [g1, g2], [], { x: 50, y: 8 }, null);
  assert.equal(seatTableOf(rows, 'g1'), 'anc');
  assert.equal(seatTableOf(rows, 'g2'), 'far'); // pure stage order — proves the superset property
});

test('Phase 6 (G8 toggle): groupAdjacency=false reverts a grouped overflow to the classic stage-order fill', () => {
  const g1 = guest({ guest_id: 'g1', group_id: 'grp' });
  const g2 = guest({ guest_id: 'g2', group_id: 'grp' });
  // 7th arg = groupAdjacency OFF → the group's overflow uses stage order, not
  // coordinate adjacency, so g2 lands on 'far' exactly like the ungrouped case.
  const rows = computeAutoSeat(ADJ_TABLES, [g1, g2], [], { x: 50, y: 8 }, null, undefined, false);
  assert.equal(seatTableOf(rows, 'g1'), 'anc');
  assert.equal(seatTableOf(rows, 'g2'), 'far');
});
