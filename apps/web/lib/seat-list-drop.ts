/**
 * seat-list-drop.ts — WHAT A GUEST LET GO ON A SEAT ROW DOES (Seats S1c, owner 2026-11-01, DECISION_LOG "SEATS STAYS ITS
 * OWN DOOR, BUT LOOKS AND WORKS LIKE THE GUESTS LIST" · "ONE SHARED DRAG-AND-DROP WITH EDGE SCROLL FOR EVERY LIST").
 *
 * Seats › List is the Guests list grouped by table: one row per seat. A guest is pressed, held and dragged (the shared
 * edge scroll, `lib/drag-edge-scroll.ts`) — or picked with Swap and a seat tapped (the "tap · move" fallback). Both end
 * here: ONE answer for where they were let go. The seat plan's own shipped moves do the rest (`seatGuestHere`,
 * `tradeSeats`, `unseat`, with the "before a seat changes hands" ask in front), so nothing new writes.
 *
 *   · on an EMPTY seat          → they sit there (`place`);
 *   · on SOMEONE ELSE's seat    → the two trade (`trade`);
 *   · on "To seat"              → their seat goes (`unseat`) — only if they had one;
 *   · on their OWN seat / nowhere → nothing.
 *
 * A guest and the +1s they bring move as ONE unit (`seatDropUnit`, R3): a unit needs a free chair each at the table, and
 * never trades with one person. A locked seat (#17) is never moved by hand: "Locked · Unlock to move".
 *
 * Pure (no DOM): the drop rows carry their seat as data attributes (`seatDropAttrs`), read back by `readSeatDrop`.
 * 🔒 lib/seats-list-is-the-guests-list.test.ts
 */
import { HOLD_MS } from './motion-table';
import { realNameParts } from './seat-placeholder-words';

/** How long a finger holds a guest still before they lift — Seats › List's row (`seat-list.tsx` › `HOLD_MS`) and the
 *  tray under the floor (`seat-face-tray.tsx`) alike; 🔒 the-seat-plan-drags-on-a-phone.test.ts holds them equal. */
/** Since 19 Nov 2026 it IS the motion standard's one hold (`HOLD_MS`, 350 ms — MOTION_STANDARD § 2 "long-press hold"). */
export const SEAT_HOLD_MS = HOLD_MS;

export type SeatDropTarget =
  | { kind: 'seat'; tableId: string; seat: number; occupantId: string | null }
  | { kind: 'unseated' };

/** Why a drop did nothing that a person must be told (said in the plan's notice strip). */
export type SeatDropRefusal = 'locked' | 'no-room' | 'no-trade';

export type SeatDropPlan =
  | { kind: 'none' }
  | { kind: 'refused'; reason: SeatDropRefusal; guestId: string }
  | { kind: 'place'; guestId: string; tableId: string; seat: number; along?: ReadonlyArray<{ guestId: string; seat: number }> }
  /** `pairs`: the rest of two same-size units, swapped +1 for +1 after the leads (absent = two single guests). */
  | { kind: 'trade'; guestId: string; otherId: string; tableId: string; seat: number; pairs?: ReadonlyArray<readonly [string, string]> }
  | { kind: 'unseat'; guestId: string; along?: readonly string[] };

/**
 * The guest being moved — and whether they hold a seat now.
 *   · `party`: the rest of their unit who move with them (their +1s at their table, `seatDropUnit`) — empty or absent = alone;
 *   · `locked`: their seat is pinned (#17) — no hand moves them until it is unlocked.
 */
export type SeatDropMover = { id: string; seated: boolean; party?: readonly string[]; locked?: boolean };

/** What the drop knows about the place it was let go (absent = an older caller: only the target seat is judged). */
export type SeatDropRoom = {
  /** The target table's free chairs, in order (the target seat among them when it is free). */
  freeSeats?: readonly number[];
  /** The guest in the target seat holds a locked seat (or anyone in their unit does). */
  occupantLocked?: boolean;
  /** The unit of the guest in the target seat (`seatDropUnit`) — a trade swaps two units of the SAME size only. */
  occupantUnit?: { leadId: string; party: readonly string[] };
};

/** 🔒 #17 — the ONE line a locked guest's hand move answers with. 🔒 lib/a-seat-unit-moves-as-one.test.ts */
export const SEAT_LOCKED_WORDS = 'Locked · Unlock to move';

/** Did a seat write answer "locked" (`SEAT_LOCKED_REFUSAL`, lib/seat-lock.server.ts)? The editor's check of any result. */
export function isSeatLockedRefusal(res: unknown): res is { refused: 'locked' } {
  return Boolean(res && typeof res === 'object' && (res as { refused?: unknown }).refused === 'locked');
}

/**
 * The words each refusal says (drawing `prototypes/seats_names_2026-11-27/`): "Needs 2 seats" — the unit's own size, on
 * a table without room for it or a seat whose unit is another size.
 */
export function seatDropRefusalWords(reason: SeatDropRefusal, partySize: number): string {
  if (reason === 'locked') return SEAT_LOCKED_WORDS;
  return `Needs ${partySize} ${partySize === 1 ? 'seat' : 'seats'}`;
}

/**
 * 🧑‍🤝‍🧑 R3 · WHO MOVES WHEN ONE FACE IS DRAGGED — the guest and the +1s they bring move as ONE unit (owner 27 Nov, the +1
 * rule: a +1 sits at their bringer's table).
 *   · dragging a +1 moves their bringer's unit (the bringer leads);
 *   · a bringer's +1s come along when they sit at the bringer's table, or have no seat yet;
 *   · a principal sponsor under "+1s of VIP guests: nearest" moves alone — their +1 sits at the nearest table by rule.
 * Pure: the guests in, the lead and the party out.
 */
export type SeatUnitGuest = {
  guest_id: string;
  plus_one_of?: string | null;
  seated_table_id: string | null;
  declined?: boolean;
};
export function seatDropUnit(
  guestId: string,
  guests: readonly SeatUnitGuest[],
  opts: { isSponsor?: (guestId: string) => boolean; vipPlusOnes?: 'beside' | 'nearest' } = {},
): { leadId: string; party: string[] } {
  const byId = new Map(guests.map((g) => [g.guest_id, g]));
  const me = byId.get(guestId);
  if (!me) return { leadId: guestId, party: [] };
  const bringer = me.plus_one_of ? byId.get(me.plus_one_of) : undefined;
  const nearest = opts.vipPlusOnes === 'nearest';
  // Under "nearest" a principal sponsor and their +1 are NOT one unit: each moves alone — the +1 dragged (at the
  // sponsor's table or in "To seat") moves only the +1, never the sponsor.
  if (nearest && bringer && opts.isSponsor?.(bringer.guest_id)) return { leadId: me.guest_id, party: [] };
  // A +1 dragged on their own moves their bringer's unit — but only one that is together (same table, or both unseated).
  const lead = bringer && !bringer.declined && bringer.seated_table_id === me.seated_table_id ? bringer : me;
  if (nearest && opts.isSponsor?.(lead.guest_id)) return { leadId: lead.guest_id, party: [] };
  const party = guests
    .filter((g) => g.plus_one_of === lead.guest_id && !g.declined && (g.seated_table_id === null || g.seated_table_id === lead.seated_table_id))
    .map((g) => g.guest_id);
  return { leadId: lead.guest_id, party };
}

export function planSeatDrop(mover: SeatDropMover, target: SeatDropTarget | null, room: SeatDropRoom = {}): SeatDropPlan {
  if (!target) return { kind: 'none' };
  const party = mover.party ?? [];
  if (target.kind === 'unseated') {
    if (!mover.seated) return { kind: 'none' };
    if (mover.locked) return { kind: 'refused', reason: 'locked', guestId: mover.id };
    return party.length ? { kind: 'unseat', guestId: mover.id, along: party } : { kind: 'unseat', guestId: mover.id };
  }
  if (target.occupantId === mover.id || (target.occupantId && party.includes(target.occupantId))) return { kind: 'none' };
  if (mover.locked || (target.occupantId && room.occupantLocked)) return { kind: 'refused', reason: 'locked', guestId: mover.id };
  if (target.occupantId) {
    // A trade swaps two units of the SAME size (§ 4.1) — a pair never trades with one person, nor a single with one
    // half of a pair (R3: either way the pair would split).
    const other = room.occupantUnit ?? { leadId: target.occupantId, party: [] };
    if (other.party.length !== party.length) return { kind: 'refused', reason: 'no-trade', guestId: mover.id };
    if (!party.length) return { kind: 'trade', guestId: mover.id, otherId: target.occupantId, tableId: target.tableId, seat: target.seat };
    return {
      kind: 'trade',
      guestId: mover.id,
      otherId: other.leadId,
      tableId: target.tableId,
      seat: target.seat,
      pairs: party.map((id, i) => [id, other.party[i]!] as const),
    };
  }
  if (!party.length) return { kind: 'place', guestId: mover.id, tableId: target.tableId, seat: target.seat };
  // The unit needs a chair each at the table: the target seat, then the table's next free ones.
  const rest = (room.freeSeats ?? []).filter((s) => s !== target.seat);
  if (rest.length < party.length) return { kind: 'refused', reason: 'no-room', guestId: mover.id };
  return { kind: 'place', guestId: mover.id, tableId: target.tableId, seat: target.seat, along: party.map((guestId, i) => ({ guestId, seat: rest[i]! })) };
}

/** The attributes a drop row wears — what `readSeatDrop` reads back. */
export function seatDropAttrs(t: SeatDropTarget): Record<string, string> {
  if (t.kind === 'unseated') return { 'data-seat-drop': 'unseated' };
  return {
    'data-seat-drop': 'seat',
    'data-seat-drop-table': t.tableId,
    'data-seat-drop-seat': String(t.seat),
    ...(t.occupantId ? { 'data-seat-drop-guest': t.occupantId } : {}),
  };
}

/** A drop row's attributes (an element's `dataset`) → where it is; null when it is no drop row. */
export function readSeatDrop(d: { seatDrop?: string; seatDropTable?: string; seatDropSeat?: string; seatDropGuest?: string } | null | undefined): SeatDropTarget | null {
  if (!d?.seatDrop) return null;
  if (d.seatDrop === 'unseated') return { kind: 'unseated' };
  if (d.seatDrop !== 'seat' || !d.seatDropTable) return null;
  const seat = Number(d.seatDropSeat);
  if (!Number.isInteger(seat) || seat < 0) return null;
  return { kind: 'seat', tableId: d.seatDropTable, seat, occupantId: d.seatDropGuest || null };
}

/** "Table 5 · 8 of 10 seats" — the header's count, its words (the Guests list's "· N"). */
export function seatTallyWords(seated: number, capacity: number, fmt: (n: number) => string = String): string {
  return `${fmt(seated)} of ${fmt(capacity)} ${capacity === 1 ? 'seat' : 'seats'}`;
}

/** 🪪 ON THE CARDS (seat plan § 4.1) — a table card draws its people as Faces (the default) or Names; Show ⇅ picks it. */
export type SeatCardLook = 'faces' | 'names';
export const SEAT_CARD_LOOKS: ReadonlyArray<{ key: SeatCardLook; label: string }> = [
  { key: 'faces', label: 'Faces' },
  { key: 'names', label: 'Names' },
];
/** A remembered pick is read, never repaired: anything but 'names' is Faces. */
export function parseSeatCardLook(raw: unknown): SeatCardLook {
  return raw === 'names' ? 'names' : 'faces';
}

/**
 * 🧑‍🤝‍🧑 The people on a card as UNITS, in seat order: a guest and the +1s they bring who sit at the same table are ONE
 * entry (the bringer first), so Faces and Names both draw the pair joined (controller default, open question 1). A +1
 * whose bringer sits elsewhere stands alone.
 */
export function cardUnits<G extends { id: string; plusOneOf?: string | null; movesAlone?: boolean }>(people: readonly G[]): G[][] {
  // A guest who moves alone (a principal sponsor under "+1s · nearest") is never joined to their +1 — the card draws
  // what a drag moves.
  const joins = new Set(people.filter((g) => !g.movesAlone).map((g) => g.id));
  const out: G[][] = [];
  for (const g of people) {
    if (g.plusOneOf && joins.has(g.plusOneOf)) continue;
    out.push([g, ...(joins.has(g.id) ? people.filter((x) => x.plusOneOf === g.id) : [])]);
  }
  return out;
}

/** How many PEOPLE a card's units hold — the Names cap and its "+N more" count people, not units. */
export function namesWithinCap<G>(units: readonly G[][], cap: number): { shown: G[][]; morePeople: number } {
  const shown: G[][] = [];
  let people = 0;
  for (const u of units) {
    if (people + u.length > cap) break;
    shown.push(u);
    people += u.length;
  }
  const total = units.reduce((n, u) => n + u.length, 0);
  return { shown, morePeople: total - people };
}

/**
 * 🪪 THE SHORT NAME A NAMES CHIP WEARS (drawing `prototypes/seats_names_2026-11-27/`): the person's usual short form
 * when the couple gave one ("Shown as": "Tita Odette"), else the first name and the surname's initial ("Maria C.",
 * "Mark Anthony C."). A stand-in part ("+1" / "TBA") is never an initial. Null when there is no name at all.
 */
export function seatShortName(g: { display_name?: string | null; first_name?: string | null; last_name?: string | null }): string | null {
  const shown = g.display_name?.trim();
  if (shown) return shown;
  const { first, last } = realNameParts(g.first_name, g.last_name);
  if (!first) return last || null;
  return last ? `${first} ${last[0]!.toLocaleUpperCase()}.` : first;
}

/** A name with no short form given: its first word, a courtesy title skipped ("Dr. Jose Rizal" → "Jose"). */
export function shortNameOf(name: string): string {
  const words = name.trim().replace(/^(Mr|Mrs|Ms|Miss|Dr|Atty|Engr|Hon)\.?\s+/i, '').split(/\s+/);
  return words[0] || name.trim();
}

/** How many PEOPLE a card names before "+N more" (drawing `prototypes/seats_names_2026-11-27/`). */
export const NAMES_ON_A_CARD = 12;

type ChipPerson = { name: string; short?: string | null; plusOneOf?: string | null };
/**
 * 🪪 A Names chip's words (drawing `prototypes/seats_names_2026-11-27/`):
 *   · a guest alone → "Maria C.";
 *   · a guest with their +1s → "Maria C.", a hairline, then the small tag "+1" ("+2" for a bigger party);
 *   · a +1 sitting apart from the guest who brings them (a principal sponsor under "nearest") → "Ramon's" then the
 *     small "+1" tag, no hairline (`apart`).
 */
export function nameChipWords(unit: readonly ChipPerson[], bringerShort?: string | null): { name: string; plus: string | null; apart: boolean } {
  const lead = unit[0]!;
  if (unit.length === 1 && lead.plusOneOf && bringerShort) {
    // "Ramon C." → "Ramon’s" (the initial is dropped before the possessive).
    return { name: `${bringerShort.replace(/\s+\S\.$/, '')}’s`, plus: '+1', apart: true };
  }
  return { name: lead.short?.trim() || shortNameOf(lead.name), plus: unit.length > 1 ? `+${unit.length - 1}` : null, apart: false };
}
