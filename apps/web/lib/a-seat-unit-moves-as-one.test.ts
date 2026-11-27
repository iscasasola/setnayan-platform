/**
 * a-seat-unit-moves-as-one.test.ts — 🧑‍🤝‍🧑 A GUEST AND THEIR +1 MOVE AS ONE · 🔒 A LOCKED SEAT IS NEVER MOVED BY HAND ·
 * 🪪 THE CARDS DRAW FACES OR NAMES (seat plan L10 PR 1, `SEAT-PLAN-COMPLETE-2026-11-27.md` § 4.1 · R3 · #17).
 *
 *   1 · `planSeatDrop` unit moves (R3): a pair onto ONE free seat is refused · a pair onto someone's seat never trades ·
 *       a pair onto room for both places both · a single still places and trades as before.
 *   2 · `seatDropUnit`: dragging a +1 moves their bringer's unit · a principal sponsor under "nearest" moves alone ·
 *       a +1 seated at another table is not part of the unit.
 *   3 · 🔒 a locked mover or a locked occupant is refused with "Locked · Unlock to move"; the editor's hand moves
 *       (`tradeSeats`, `seatGuestHere`, `place`, the ask in front of `assessSeatMove`) all refuse a locked guest.
 *   4 · 🪪 Show ⇅ "On the cards" — Faces / Names; Faces draws a guest and their +1 as ONE joined pair (`data-seat-pair`),
 *       Names draws ONE name chip for the unit; every face still wears `data-seat-face`.
 *
 * SABOTAGE (each seen red, then restored): the `rest.length < party.length` refusal removed → 1 · `seatDropUnit`'s
 * bringer lead dropped → 2 · `refuseLocked(aId, bId)` removed from `tradeSeats` → 3 · `cardUnits(...)` replaced by a
 * plain map → 4.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { SEAT_LOCKED_WORDS, cardUnits, parseSeatCardLook, planSeatDrop, seatDropRefusalWords, seatDropUnit, type SeatUnitGuest } from './seat-list-drop';

const DIR = join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'seating', '_components');
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');
const free = (tableId: string, seat: number) => ({ kind: 'seat', tableId, seat, occupantId: null }) as const;
const taken = (tableId: string, seat: number, occupantId: string) => ({ kind: 'seat', tableId, seat, occupantId }) as const;

test('1 · a pair needs a chair each and never trades with one person (R3)', () => {
  const pair = { id: 'ana', seated: true, party: ['ben'] };
  assert.deepEqual(planSeatDrop(pair, free('t5', 2), { freeSeats: [2] }), { kind: 'refused', reason: 'no-room', guestId: 'ana' }, 'a pair onto one free seat was let in');
  assert.deepEqual(planSeatDrop(pair, free('t5', 2), {}), { kind: 'refused', reason: 'no-room', guestId: 'ana' }, 'a pair with no room told was let in');
  assert.deepEqual(planSeatDrop(pair, taken('t5', 3, 'cy'), { freeSeats: [1, 2, 4] }), { kind: 'refused', reason: 'no-trade', guestId: 'ana' }, 'a pair traded with one person');
  assert.deepEqual(planSeatDrop(pair, free('t5', 2), { freeSeats: [2, 4, 6] }), {
    kind: 'place',
    guestId: 'ana',
    tableId: 't5',
    seat: 2,
    along: [{ guestId: 'ben', seat: 4 }],
  });
  assert.deepEqual(planSeatDrop(pair, taken('t5', 3, 'ben'), { freeSeats: [] }), { kind: 'none' }, 'a pair let go on their own +1 moved something');
  assert.deepEqual(planSeatDrop(pair, { kind: 'unseated' }), { kind: 'unseat', guestId: 'ana', along: ['ben'] }, '"To seat" left the +1 on their chair');
  // A single is exactly as before — no `along`, a trade still trades.
  const solo = { id: 'ana', seated: true };
  assert.deepEqual(planSeatDrop(solo, free('t5', 2), { freeSeats: [2] }), { kind: 'place', guestId: 'ana', tableId: 't5', seat: 2 });
  assert.deepEqual(planSeatDrop(solo, taken('t5', 3, 'cy')), { kind: 'trade', guestId: 'ana', otherId: 'cy', tableId: 't5', seat: 3 });
  assert.match(seatDropRefusalWords('no-room', 'Ana', 2), /^Ana comes with a \+1/);
  assert.match(seatDropRefusalWords('no-trade', 'Ana', 3), /^Ana comes with 2 \+1s/);
});

test('2 · who moves: a +1 moves their bringer’s unit; a sponsor under “nearest” moves alone', () => {
  const guests: SeatUnitGuest[] = [
    { guest_id: 'ana', seated_table_id: 't1' },
    { guest_id: 'ben', plus_one_of: 'ana', seated_table_id: 't1' },
    { guest_id: 'ninong', seated_table_id: 'vip' },
    { guest_id: 'ninang', plus_one_of: 'ninong', seated_table_id: 'vip' },
    { guest_id: 'dan', seated_table_id: 't2' },
    { guest_id: 'eli', plus_one_of: 'dan', seated_table_id: 't3' },
    { guest_id: 'fe', plus_one_of: 'dan', seated_table_id: 't2', declined: true },
  ];
  assert.deepEqual(seatDropUnit('ana', guests), { leadId: 'ana', party: ['ben'] });
  assert.deepEqual(seatDropUnit('ben', guests), { leadId: 'ana', party: ['ben'] }, 'dragging a +1 did not move their bringer’s unit');
  const sponsor = { isSponsor: (id: string) => id === 'ninong', vipPlusOnes: 'nearest' as const };
  assert.deepEqual(seatDropUnit('ninong', guests, sponsor), { leadId: 'ninong', party: [] }, 'a sponsor under “nearest” took their +1 along');
  assert.deepEqual(seatDropUnit('ninong', guests, { ...sponsor, vipPlusOnes: 'beside' }), { leadId: 'ninong', party: ['ninang'] });
  // A +1 at another table, or one who declined, is not in the unit — and a +1 apart from their bringer moves alone.
  assert.deepEqual(seatDropUnit('dan', guests), { leadId: 'dan', party: [] });
  assert.deepEqual(seatDropUnit('eli', guests), { leadId: 'eli', party: [] });
});

test('3 · 🔒 a locked seat is never moved by a hand (#17)', () => {
  assert.equal(SEAT_LOCKED_WORDS, 'Locked · Unlock to move');
  const locked = { id: 'ana', seated: true, locked: true };
  for (const t of [free('t5', 2), taken('t5', 3, 'cy'), { kind: 'unseated' } as const]) {
    assert.deepEqual(planSeatDrop(locked, t, { freeSeats: [2] }), { kind: 'refused', reason: 'locked', guestId: 'ana' }, `a locked guest moved onto ${t.kind}`);
  }
  assert.deepEqual(planSeatDrop({ id: 'ana', seated: true }, taken('t5', 3, 'cy'), { occupantLocked: true }), { kind: 'refused', reason: 'locked', guestId: 'ana' }, 'a locked guest was traded off their seat');
  assert.equal(seatDropRefusalWords('locked', 'Ana', 1), SEAT_LOCKED_WORDS);

  const editor = read('seating-editor.tsx');
  const body = (name: string) => {
    const at = editor.indexOf(`const ${name} = (`);
    assert.ok(at > 0, `${name} is gone`);
    return editor.slice(at, at + 400);
  };
  assert.match(body('tradeSeats'), /refuseLocked\(aId, bId\)/, 'a swap moves a locked guest');
  assert.match(body('seatGuestHere'), /refuseLocked\(guestId\)/, 'seat-here moves a locked guest');
  assert.match(body('place'), /refuseLocked\(pickedId\)/, '"tap · move" moves a locked guest');
  assert.match(body('askBefore'), /refuseLocked\(moverId, otherId\)[\s\S]*assessFor\(/, 'the ask in front of assessSeatMove does not refuse a locked guest first');
  assert.match(editor, /setNotice\(SEAT_LOCKED_WORDS\)/, 'the refusal is not said');
  assert.match(editor, /const unit = unitOf\(draggedId\)[\s\S]{0,400}planSeatDrop\(/, 'the drop does not move the unit');
});

test('4 · 🪪 Show ⇅ “On the cards”: Faces or Names, a pair drawn as ONE', () => {
  const list = read('seat-list.tsx');
  const editor = read('seating-editor.tsx');
  // The pick lives in Show ⇅, under its own heading, only on Seats › List.
  assert.match(editor, /group: 'On the cards'/);
  assert.match(editor, /const listLooks = onSeatList \? cardLookOptions : \[\];/, '“On the cards” is offered off the list');
  assert.match(editor, /cardLook=\{cardLook\}/, 'the list is not told the look');
  assert.match(list, /cardLook = 'faces'/, 'Faces is not the default');
  assert.match(list, /data-seat-card-look=\{cardLook\}/);
  // Every face is still a `data-seat-face`; a pair is ONE joined unit in both looks.
  assert.match(list, /data-seat-face=\{g\.id\}/);
  assert.match(list, /data-seat-pair=""/);
  assert.match(list, /data-seat-card-name=""/);
  assert.match(list, /cardUnits\(shownPeople\.map/, 'the table card draws faces one by one again');
  assert.match(list, /unit\.map\(\(g\) => g\.name\)\.join\(' \+ '\)/, 'Names splits the pair');

  const g = (id: string, plusOneOf: string | null = null) => ({ id, name: id, initials: id[0]!, photo: null, side: 'both' as const, plusOneOf });
  assert.deepEqual(
    cardUnits([g('ana'), g('cy'), g('ben', 'ana'), g('eli', 'dan')]).map((u) => u.map((x) => x.id)),
    [['ana', 'ben'], ['cy'], ['eli']],
    'a guest and their +1 are not one unit on the card',
  );
  assert.equal(parseSeatCardLook('names'), 'names');
  assert.equal(parseSeatCardLook('anything'), 'faces');
  assert.equal(parseSeatCardLook(null), 'faces');
});
