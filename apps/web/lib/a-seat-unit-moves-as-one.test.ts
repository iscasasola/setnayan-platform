/**
 * a-seat-unit-moves-as-one.test.ts — 🧑‍🤝‍🧑 A GUEST AND THEIR +1 MOVE AS ONE · 🔒 A LOCKED SEAT IS NEVER MOVED BY HAND ·
 * 🪪 THE CARDS DRAW FACES OR NAMES (seat plan L10 PR 1, `SEAT-PLAN-COMPLETE-2026-11-27.md` § 4.1 · R3 · #17).
 *
 *   1 · `planSeatDrop` unit moves (R3, § 4.1): a pair onto ONE free seat is refused · a trade swaps two units of the
 *       SAME size only (a pair onto a single, a single onto half a pair — refused; pair ⇄ pair trades +1 for +1) · a pair
 *       onto room for both places both · a single still places and trades as before. Refusals say "Needs 2 seats".
 *   2 · `seatDropUnit`: dragging a +1 moves their bringer's unit · a principal sponsor (only) under "nearest" moves
 *       alone · a +1 seated at another table is not part of the unit.
 *   3 · 🔒 a locked mover or a locked occupant is refused with "Locked · Unlock to move" — in the editor's hand moves
 *       (`tradeSeats`, `seatGuestHere`, `place`, `unseat` / Remove, the ask in front of `assessSeatMove`) AND on the
 *       server (`assignGuest`, `swapSeats`, `unassignGuest` read `locked` before they write).
 *   4 · ONE write and ONE Undo per unit move: the unit rides `along` / `also` / `pairs` on the existing actions (no new
 *       action); "tap · move" is the drag's own answer (`dropSeat`).
 *   5 · 🪪 Show ⇅ "On the cards" — Faces / Names; Faces draws a guest and their +1 as ONE joined pair (`data-seat-pair`),
 *       Names draws ONE chip per unit (drawing `prototypes/seats_names_2026-11-27/`: 32 px, 14 px medium, the short
 *       name, a hairline then "+1", "Ramon's +1", "+N more" after 12); every face AND name chip wears `data-seat-face`.
 *
 * SABOTAGE (each seen red, then restored): the `rest.length < party.length` refusal removed → 1 · `seatDropUnit`'s
 * bringer lead dropped → 2 · the `.eq('locked', true)` read removed from `swapSeats` → 3 · `seatGuestHere(t, guestId,
 * plan.seat, along)` split into one call per guest → 4 · `cardUnits(...)` replaced by a plain map → 5 · the chip's
 * `text-sn-md` written as the made-up `text-sn-13` → 5 and 6 (6 resolves the class to its pixels through the config).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  NAMES_ON_A_CARD,
  SEAT_LOCKED_WORDS,
  cardUnits,
  nameChipWords,
  namesWithinCap,
  parseSeatCardLook,
  planSeatDrop,
  seatDropRefusalWords,
  seatDropUnit,
  seatShortName,
  shortNameOf,
  type SeatUnitGuest,
} from './seat-list-drop';

const DIR = join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'seating', '_components');
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');
const ACTIONS = readFileSync(join(DIR, '..', 'actions.ts'), 'utf8');
/** One exported action's body — up to the next export. */
const action = (name: string) => {
  const at = ACTIONS.indexOf(`export async function ${name}(`);
  assert.ok(at >= 0, `${name} is gone`);
  const next = ACTIONS.indexOf('\nexport async function ', at + 10);
  return ACTIONS.slice(at, next < 0 ? undefined : next);
};
const free = (tableId: string, seat: number) => ({ kind: 'seat', tableId, seat, occupantId: null }) as const;
const taken = (tableId: string, seat: number, occupantId: string) => ({ kind: 'seat', tableId, seat, occupantId }) as const;

test('1 · a pair needs a chair each and never trades with one person (R3)', () => {
  const pair = { id: 'ana', seated: true, party: ['ben'] };
  assert.deepEqual(planSeatDrop(pair, free('t5', 2), { freeSeats: [2] }), { kind: 'refused', reason: 'no-room', guestId: 'ana' }, 'a pair onto one free seat was let in');
  assert.deepEqual(planSeatDrop(pair, free('t5', 2), {}), { kind: 'refused', reason: 'no-room', guestId: 'ana' }, 'a pair with no room told was let in');
  assert.deepEqual(planSeatDrop(pair, taken('t5', 3, 'cy'), { freeSeats: [1, 2, 4] }), { kind: 'refused', reason: 'no-trade', guestId: 'ana' }, 'a pair traded with one person');
  // A single onto half of a pair (Cy onto Ben, Ana's +1) would split Ana and Ben — refused.
  assert.deepEqual(
    planSeatDrop({ id: 'cy', seated: true }, taken('t5', 3, 'ben'), { occupantUnit: { leadId: 'ana', party: ['ben'] } }),
    { kind: 'refused', reason: 'no-trade', guestId: 'cy' },
    'a single traded with half of a pair',
  );
  // Two pairs trade: lead with lead, +1 with +1.
  assert.deepEqual(planSeatDrop({ id: 'dan', seated: true, party: ['eli'] }, taken('t5', 3, 'ben'), { occupantUnit: { leadId: 'ana', party: ['ben'] } }), {
    kind: 'trade',
    guestId: 'dan',
    otherId: 'ana',
    tableId: 't5',
    seat: 3,
    pairs: [['eli', 'ben']],
  });
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
  assert.equal(seatDropRefusalWords('no-room', 2), 'Needs 2 seats');
  assert.equal(seatDropRefusalWords('no-trade', 3), 'Needs 3 seats');
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
  // Under "nearest" the sponsor's +1 moves ALONE — at the sponsor's table or in "To seat" — never the sponsor.
  assert.deepEqual(seatDropUnit('ninang', guests, sponsor), { leadId: 'ninang', party: [] }, 'dragging a sponsor’s +1 moved the sponsor');
  const toSeat: SeatUnitGuest[] = [
    { guest_id: 'ninong', seated_table_id: null },
    { guest_id: 'ninang', plus_one_of: 'ninong', seated_table_id: null },
  ];
  assert.deepEqual(seatDropUnit('ninang', toSeat, sponsor), { leadId: 'ninang', party: [] }, 'a sponsor’s +1 in “To seat” moved the sponsor');
  assert.deepEqual(seatDropUnit('ninang', guests, { ...sponsor, vipPlusOnes: 'beside' }), { leadId: 'ninong', party: ['ninang'] });
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
  assert.equal(seatDropRefusalWords('locked', 1), SEAT_LOCKED_WORDS);

  const editor = read('seating-editor.tsx');
  const body = (name: string) => {
    const at = editor.indexOf(`const ${name} = (`);
    assert.ok(at > 0, `${name} is gone`);
    return editor.slice(at, at + 400);
  };
  assert.match(body('tradeSeats'), /refuseLocked\(aId, bId, \.\.\.pairs\.flat\(\)\)/, 'a swap moves a locked guest');
  assert.match(body('seatGuestHere'), /refuseLocked\(guestId, \.\.\.along\.map/, 'seat-here moves a locked guest');
  assert.match(body('unseat'), /refuseLocked\(guestId, \.\.\.also\)/, 'Remove (or its swipe) takes a locked guest off');
  assert.match(body('place'), /refuseLocked\(pickedId\)/, '"tap · move" moves a locked guest');
  assert.match(body('askBefore'), /refuseLocked\(moverId, otherId\)[\s\S]*assessFor\(/, 'the ask in front of assessSeatMove does not refuse a locked guest first');
  assert.match(editor, /setNotice\(SEAT_LOCKED_WORDS\)/, 'the refusal is not said');
  assert.match(editor, /const unit = unitOf\(draggedId\)[\s\S]{0,800}planSeatDrop\(/, 'the drop does not move the unit');
  // The server refuses too — a stale tab, the 3D room or a direct call — and says so as an answer, not a thrown error.
  // (Every seat writer's own check, and that it comes before the write: lib/every-seat-write-asks-the-lock.test.ts.)
  for (const name of ['assignGuest', 'swapSeats', 'unassignGuest']) {
    const b = action(name);
    assert.match(b, /await lockedSeatGuests\(supabase, eventId,/, `${name} never reads the lock`);
    assert.match(b, /return SEAT_LOCKED_REFUSAL;/, `${name} does not refuse a locked seat`);
  }
  assert.match(editor, /const saidLocked = /, 'the server’s refusal is not said');
});

test('4 · one write and one Undo per unit move; "tap · move" is the drag’s own answer', () => {
  const editor = read('seating-editor.tsx');
  const drop = editor.slice(editor.indexOf('const dropSeat = '), editor.indexOf('const noteDrop = '));
  assert.match(drop, /seatGuestHere\(t, guestId, plan\.seat, along\)/, 'a unit is placed in more than one write');
  assert.doesNotMatch(drop, /for \(const x of along\) seatGuestHere/, 'a unit is placed one guest at a time');
  assert.match(drop, /return unseat\(guestId, false, plan\.along\)/, '"To seat" unseats the party one by one');
  assert.match(drop, /occupantUnit = target\.kind === 'seat' && target\.occupantId \? unitOf\(target\.occupantId\)/, 'a trade does not know the other unit');
  assert.match(action('assignGuest'), /\.\.\.along\.map\(\(x\) => \(\{ event_id: eventId, table_id: tableId, guest_id: x\.guest_id/, 'assignGuest does not seat the unit in one upsert');
  assert.match(action('unassignGuest'), /\.in\('guest_id', everyone\)/, 'unassignGuest does not take the unit off in one delete');
  // ONE Undo: the unit goes back in the same write.
  const unseat = editor.slice(editor.indexOf('const unseat = '), editor.indexOf('const removeTables = '));
  assert.match(unseat, /back\.set\('along', JSON\.stringify\(backAlong/, 'the Undo puts back only the lead');
  // tap · move → the same answer as a drag.
  const tapBlank = editor.slice(editor.indexOf('const tapBlank = '), editor.indexOf('const comingUnseated = '));
  assert.match(tapBlank, /dropSeat\(pickedId, \{ kind: 'seat', tableId, seat, occupantId: null \}\)/, 'tap · move skips the unit rule');
  assert.match(editor.slice(editor.indexOf('const place = '), editor.indexOf('const unseat = ')), /dropSeat\(pickedId,/, 'a picked +1 moves alone onto a chair');
  // Only principal sponsors move alone under "nearest".
  assert.match(editor, /const isNearestSponsor = \(id: string\): boolean => guestsById\.get\(id\)\?\.role\.startsWith\('principal_sponsor'\) === true;/);
});

test('5 · 🪪 Show ⇅ “On the cards”: Faces or Names, a pair drawn as ONE', () => {
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
  assert.match(list, /cardUnits\(shownPeople\.map/, 'the table card draws faces one by one again');
  // A pair in Faces is TOUCHING, never overlapping (controller post-merge review).
  const pair = list.slice(list.indexOf('data-seat-pair=""') - 200, list.indexOf('data-seat-pair=""') + 300);
  assert.doesNotMatch(pair, /-ml-/, 'the faces of a pair overlap again');
  // The Names chip (drawing `prototypes/seats_names_2026-11-27/`): a face too; 26 px tall, 13 px at full ink, 9 px at the
  // sides; a 14 px hairline with 2 px / 6 px around it; the "+1" tag 11 px, 600, the quiet ink.
  const nameChip = list.slice(list.indexOf('data-seat-card-name=""') - 300, list.indexOf('data-seat-card-name=""') + 1200);
  assert.match(nameChip, /data-seat-face=\{lead\.id\}/, 'a Names chip is no seat face');
  assert.match(nameChip, /h-\[26px\][^"]*px-\[9px\] text-sn-md font-medium text-ink"/, 'a Names chip is not 26 px · 9 px sides · 13 px · 500 · full ink');
  assert.match(nameChip, /mx-1\.5 my-0\.5 h-3\.5 w-px[^"]*" data-seat-hairline=""/, 'the hairline is not 14 px with 2 px / 6 px around it');
  // The quiet ink is `--color-ink-3`, read through its global (`--m-slate-2`, light and dark) — no stylesheet of its own.
  assert.match(nameChip, /text-sn-xs font-semibold text-\[color:var\(--m-slate-2\)\]/, 'the +1 tag is not 11 px · 600 · the quiet ink');
  // "+N more" is a chip with a hairline ring and the accent word; empty seats are up to 3 small dotted chairs.
  assert.match(list, /ring-1 ring-inset ring-ink\/15"\s*data-seat-names-more=""/, '"+N more" is not a ringed chip');
  assert.match(list, /text-sn-md font-semibold text-sn-accent/, '"+N more" is not the accent word at 600');
  assert.match(list, /const NAMES_DOTS = 3;/);
  // Empty seats: up to 3 dots of 12 px, then ALWAYS the full count ("••+2 empty", "•••+4 empty").
  const empty = list.slice(list.indexOf('const namesEmpty = '), list.indexOf('const nearestLine = '));
  assert.match(empty, /h-3 w-3 shrink-0 rounded-full border border-dashed/, 'the empty-seat dots are not 12 px');
  assert.match(empty, /\+\{formatCount\(empty\)\} empty/, 'the empty label is not the full count');
  assert.doesNotMatch(empty, /empty > NAMES_DOTS \?/, 'the empty label shows only past three dots again');
  assert.match(list, /data-seat-names-empty=""/);
  assert.match(list, /Their \+1s · nearest the Principal Sponsors/, 'the nearest line is gone');
  // A card without room for the lifted unit does not light.
  assert.match(list, /'data-seat-drop-room': String\(freeOf\(u\)\.length\)/);
  assert.match(list, /const fits = room === undefined \|\| Number\(room\) >= unitSizeRef\.current\(d\.id\);/, 'a card without room lights on drag');
  // The chip is NOT a button (the card is the 44 px press).
  assert.doesNotMatch(nameChip.slice(0, 900), /<button/, 'a Names chip became a button — it would need the 44 px floor');
  assert.equal(NAMES_ON_A_CARD, 12);
  const p = (name: string, plusOneOf: string | null = null, short: string | null = null) => ({ name, plusOneOf, short });
  assert.deepEqual(nameChipWords([p('Maria Cruz', null, 'Maria C.')]), { name: 'Maria C.', plus: null, apart: false });
  assert.deepEqual(nameChipWords([p('Maria Cruz', null, 'Maria C.'), p('Ben Reyes', 'a')]), { name: 'Maria C.', plus: '+1', apart: false });
  assert.deepEqual(nameChipWords([p('Ana Cruz'), p('Ben', 'a'), p('Cy', 'a')]), { name: 'Ana', plus: '+2', apart: false });
  assert.deepEqual(nameChipWords([p('Liza Santos', 'r')], 'Ramon S.'), { name: 'Ramon’s', plus: '+1', apart: true }, 'a sponsor’s +1 apart from them is not “Ramon’s +1”');
  assert.equal(shortNameOf('Dr. Jose Rizal'), 'Jose');
  // The short name: the usual short form, else first name + surname initial; a stand-in is never an initial.
  assert.equal(seatShortName({ first_name: 'Maria', last_name: 'Cruz' }), 'Maria C.');
  assert.equal(seatShortName({ first_name: 'Mark Anthony', last_name: 'Cruz' }), 'Mark Anthony C.');
  assert.equal(seatShortName({ display_name: 'Tita Odette', first_name: 'Odette', last_name: 'Reyes' }), 'Tita Odette');
  assert.equal(seatShortName({ first_name: 'Ben', last_name: '+1' }), 'Ben');
  // The cap counts PEOPLE: six pairs fill 12; "+N more" counts people too.
  const pairs = Array.from({ length: 7 }, (_, i) => [`a${i}`, `b${i}`]);
  assert.deepEqual(
    (({ shown, morePeople }) => ({ shown: shown.length, morePeople }))(namesWithinCap(pairs, 12)),
    { shown: 6, morePeople: 2 },
    'the Names cap counts units, not people',
  );

  const g = (id: string, plusOneOf: string | null = null, movesAlone = false) => ({ id, name: id, initials: id[0]!, photo: null, side: 'both' as const, plusOneOf, movesAlone });
  assert.deepEqual(
    cardUnits([g('ana'), g('cy'), g('ben', 'ana'), g('eli', 'dan')]).map((u) => u.map((x) => x.id)),
    [['ana', 'ben'], ['cy'], ['eli']],
    'a guest and their +1 are not one unit on the card',
  );
  // A principal sponsor under "nearest" is drawn apart from their +1 — the card draws what a drag moves.
  assert.deepEqual(
    cardUnits([g('ramon', null, true), g('liza', 'ramon')]).map((u) => u.map((x) => x.id)),
    [['ramon'], ['liza']],
    'the joined “Ramon | +1” chip moves only Ramon',
  );
  assert.equal(parseSeatCardLook('names'), 'names');
  assert.equal(parseSeatCardLook('anything'), 'faces');
  assert.equal(parseSeatCardLook(null), 'faces');
});

test('6 · every size on Seats › List is a REAL class, and renders the drawing’s pixels', async () => {
  /* The `text-sn-*` sizes are named (`sn-xs` = 11 · `sn-sm` = 12 · `sn-md` = 13 …); a made-up `text-sn-13` is no class
     at all, and the words fall back to whatever they inherit. Resolve each class through the real Tailwind config to
     its CSS variable, and the variable to its pixels in globals.css — the size the browser draws. */
  const config = (await import('../tailwind.config')).default as { theme?: { extend?: { fontSize?: Record<string, unknown>; colors?: Record<string, unknown> } } };
  const sizes = config.theme?.extend?.fontSize ?? {};
  const colours = config.theme?.extend?.colors ?? {};
  const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
  const px = (cls: string): number | null => {
    const v = sizes[cls];
    const varName = (Array.isArray(v) ? v[0] : v) as string | undefined;
    const m = varName?.match(/var\((--[\w-]+)\)/);
    const decl = m ? css.match(new RegExp(`${m[1]}:\\s*(\\d+)px`)) : null;
    return decl ? Number(decl[1]) : null;
  };
  const list = read('seat-list.tsx');
  // No `text-sn-…` on the list that is neither a size nor a colour of the config.
  const used = [...new Set([...list.matchAll(/\btext-(sn-[\w-]+)/g)].map((m) => m[1]!))];
  // A size (`sn-md`) or a colour of the `sn` group (`sn-accent` → colors.sn.accent).
  const snColours = ((colours as { sn?: Record<string, unknown> }).sn ?? {}) as Record<string, unknown>;
  const unknown = used.filter((c) => !(c in sizes) && !(c.slice('sn-'.length) in snColours));
  assert.deepEqual(unknown, [], 'a text-sn-… class on Seats › List is not in the Tailwind config — it draws nothing');
  const chip = list.slice(list.indexOf('data-seat-card-name=""') - 300, list.indexOf('data-seat-card-name=""'));
  const sizeOf = (slice: string) => px(slice.match(/\btext-(sn-(?:3xs|2xs|xs|sm|md|base|lg|xl|2xl|3xl))\b/)?.[1] ?? '');
  assert.equal(sizeOf(chip), 13, 'the Names chip does not render at 13 px');
  const tag = list.slice(list.indexOf('data-seat-plus-tag=""') - 200, list.indexOf('data-seat-plus-tag=""'));
  assert.equal(sizeOf(tag), 11, 'the +1 tag does not render at 11 px');
  const more = list.slice(list.indexOf('data-seat-names-more=""') - 250, list.indexOf('data-seat-names-more=""'));
  assert.equal(sizeOf(more), 13, '"+N more" does not render at 13 px');
  const emptyCount = list.slice(list.indexOf('data-seat-names-empty-count=""') - 120, list.indexOf('data-seat-names-empty-count=""'));
  assert.equal(sizeOf(emptyCount), 12, 'the empty count does not render at 12 px');
});
