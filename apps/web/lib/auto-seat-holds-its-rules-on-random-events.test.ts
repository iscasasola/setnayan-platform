/**
 * 🎲 THE SEATER HOLDS ITS HARD RULES ON HUNDREDS OF RANDOM EVENTS (seat plan § 7 property tests). A seeded generator
 * (mulberry32 — no dependency, so a failure prints its seed and replays exactly) builds rooms with locked, Spare, VIP
 * and Sweetheart tables, removed chairs, groups, +1s, pending and declined guests and guests already seated; then:
 *   · the same input always gives the same plan;
 *   · in fill-only mode (the shipped seater) no seated guest moves, and nobody is seated twice;
 *   · no table goes over its chairs; nobody sits at a locked or Spare table or the Sweetheart; no declined guest is seated
 *     — all asserted by the independent checker (`checkAutoSeatPlan`), so the checker agrees with the solver;
 *   · a +1 whose bringer is seated sits at their bringer's table (outside the VIP 'nearest' rule, a full table, and a
 *     bringer already seated at a locked or Spare table, which is kept exactly as it is).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { autoSeatTakesTable, computeAutoSeat, type AutoSeatGuest, type EventTableRow, type SeatAssignmentRow } from '@/lib/seating';
import { checkAutoSeatPlan } from '@/lib/seat-plan-validator';

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomEvent(seed: number) {
  const r = mulberry32(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const nTables = 3 + Math.floor(r() * 8);
  const tables: EventTableRow[] = [
    { table_id: 'sw', public_id: 'S89T-sw', event_id: 'e', table_label: 'Sweetheart', table_type: 'sweetheart_2', capacity: 2, sort_order: 0, x_pos: 50, y_pos: 8 },
  ];
  for (let i = 1; i <= nTables; i += 1) {
    const cap = pick([8, 10, 10, 12]);
    tables.push({
      table_id: `t${i}`, public_id: `S89T-${i}`, event_id: 'e', table_label: `Table ${i}`, table_type: 'round_10', capacity: cap,
      sort_order: i, x_pos: 10 + r() * 80, y_pos: 20 + r() * 70,
      removed_seats: r() < 0.2 ? [Math.floor(r() * cap)] : [],
      locked: r() < 0.15,
      table_kind: r() < 0.1 ? 'spare' : r() < 0.15 ? 'vip' : 'regular',
    });
  }
  const groups = ['g1', 'g2', 'g3', 'g4', null, null];
  const guests: AutoSeatGuest[] = [];
  const nGuests = 10 + Math.floor(r() * 90);
  for (let i = 0; i < nGuests; i += 1) {
    const bringer = i > 0 && r() < 0.2 ? guests[Math.floor(r() * i)]!.guest_id : null;
    guests.push({
      guest_id: `g${i}`,
      role: r() < 0.08 ? pick(['principal_sponsor_ninong', 'principal_sponsor_ninang', 'bridesmaid', 'groomsman']) : 'guest',
      group_category: pick(['family', 'friends', 'work']),
      rsvp_status: pick(['attending', 'attending', 'attending', 'pending', 'declined']),
      plus_one_of_guest_id: bringer,
      last_name: `L${Math.floor(r() * 30)}`,
      first_name: `F${i}`,
      group_id: pick(groups),
    });
  }
  // A few guests already seated, by hand, at real chairs.
  const assignments: SeatAssignmentRow[] = [];
  const open = tables.filter((t) => t.table_type !== 'sweetheart_2');
  for (const g of guests) {
    if (g.rsvp_status === 'declined' || r() > 0.15) continue;
    const t = pick(open);
    const used = new Set(assignments.filter((a) => a.table_id === t.table_id).map((a) => a.seat_number));
    const removed = new Set(t.removed_seats ?? []);
    let seat = -1;
    for (let s = 0; s < t.capacity; s += 1) if (!used.has(s) && !removed.has(s)) { seat = s; break; }
    if (seat < 0) continue;
    assignments.push({ assignment_id: `a-${g.guest_id}`, table_id: t.table_id, guest_id: g.guest_id, seat_number: seat, locked: r() < 0.3 });
  }
  return { tables, guests, assignments };
}

const RUNS = 300;

test(`the same event always gives the same plan (${RUNS} seeded events)`, () => {
  for (let seed = 1; seed <= RUNS; seed += 1) {
    const a = randomEvent(seed);
    const b = randomEvent(seed);
    assert.deepEqual(computeAutoSeat(a.tables, a.guests, a.assignments), computeAutoSeat(b.tables, b.guests, b.assignments), `seed ${seed}`);
  }
});

test(`every plan passes the independent check (${RUNS} seeded events)`, () => {
  for (let seed = 1; seed <= RUNS; seed += 1) {
    const ev = randomEvent(seed);
    const added = computeAutoSeat(ev.tables, ev.guests, ev.assignments);
    const breaks = checkAutoSeatPlan({ tables: ev.tables, guests: ev.guests, existing: ev.assignments, added });
    assert.deepEqual(breaks, [], `seed ${seed}: ${JSON.stringify(breaks.slice(0, 3))}`);
  }
});

test(`a +1 sits at their bringer's table whenever both get a seat (${RUNS} seeded events)`, () => {
  let checked = 0;
  for (let seed = 1; seed <= RUNS; seed += 1) {
    const ev = randomEvent(seed);
    const added = computeAutoSeat(ev.tables, ev.guests, ev.assignments);
    const tableOf = new Map([...ev.assignments, ...added].map((s) => [s.guest_id, s.table_id]));
    const newly = new Set(added.map((s) => s.guest_id));
    for (const g of ev.guests) {
      const bringer = g.plus_one_of_guest_id;
      // Only pairs the seater placed together; a pair a person split by hand is theirs to keep.
      if (!bringer || !newly.has(g.guest_id) || !tableOf.has(bringer)) continue;
      const holder = ev.guests.find((x) => x.guest_id === bringer)!;
      if (holder.role !== 'guest') continue; // VIP +1s follow the host's beside/nearest pick, tested in vip-tables-*
      // A +1 placed ALONE beside an already-seated bringer may land at the next table when theirs is full.
      const bringerTable = tableOf.get(bringer)!;
      const room = ev.tables.find((t) => t.table_id === bringerTable)!;
      const full = [...tableOf.values()].filter((t) => t === bringerTable).length >= room.capacity - (room.removed_seats?.length ?? 0);
      if (!newly.has(bringer) && full) continue;
      // A bringer already seated at a LOCKED or Spare table: that table is kept exactly as it is, so their +1 sits nearest.
      if (!autoSeatTakesTable(room)) continue;
      checked += 1;
      assert.equal(tableOf.get(g.guest_id), bringerTable, `seed ${seed}: ${g.guest_id} apart from ${bringer}`);
    }
  }
  assert.ok(checked > 50, `the property must actually be exercised (checked ${checked} pairs)`);
});
