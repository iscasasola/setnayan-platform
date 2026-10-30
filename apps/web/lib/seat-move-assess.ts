/**
 * 🔁 BEFORE A SEAT CHANGES HANDS — "Swap Ana (Table 2) with Ben (Table 5)?" (R4 slice 6a; owner 2026-10-29, Guests
 * prototype v13 `assess` / `requestMove`: *"Drop a face on a taken seat → 'Swap … ?' with why each sits there and tickable
 * side effects (+1, household)"*).
 *
 * What the confirm sheet says, worked out here so it is tested rather than trusted:
 *   · each person once, with where they sit and WHY they sit there (`seatWhyWords` — who placed it; nothing when nobody
 *     recorded it, never a guess);
 *   · tickable side effects — the mover's +1 who sits beside them now comes along ("move Ben too?", ticked);
 *   · plain warnings — the new table has no seat left for that +1; a +1 leaves the guest who brings them; two people the
 *     couple keeps apart would sit together; a VIP leaves the table of their own tier.
 * At most three lines of side effects and warnings together (the prototype's cap), side effects first.
 *
 * 🚫 No pronoun is guessed: the words name people ("move Ben too?"), never "him" / "her".
 * PURE — no I/O. 🔒 lib/a-swap-says-why.test.ts
 */
import { seatWhyWords } from '@/lib/seat-why';

export type MoveGuest = {
  guest_id: string;
  name: string;
  /** Who brings this guest (`guests.plus_one_of_guest_id`). */
  plus_one_of?: string | null;
  seated_table_id: string | null;
  seat_number: number | null;
  /** 1–4, the guest's seating tier (`guestTier`, lib/seating.ts) — 1 is the couple's closest. */
  tier: 1 | 2 | 3 | 4;
  seat_placed_by?: string | null;
  seat_placed_at?: string | null;
};

export type MoveTable = { label: string; freeSeats: readonly number[] };

export type MoveSideEffect = { key: string; text: string; on: boolean; guestId: string; tableId: string; seat: number };

export type MoveAssessment = {
  kind: 'swap' | 'move';
  title: string;
  /** The people the sheet shows, each with their table now and why they sit there (null = say nothing). */
  rows: ReadonlyArray<{ guestId: string; name: string; where: string; why: string | null }>;
  sideEffects: MoveSideEffect[];
  warnings: string[];
  /** Nothing to say beyond the move itself — a plain move needs no sheet. */
  quiet: boolean;
};

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

export function assessSeatMove(input: {
  mover: MoveGuest;
  target: { tableId: string; seat: number | null };
  /** Who sits in the target seat now (a swap), or null (a move). */
  other: MoveGuest | null;
  guests: readonly MoveGuest[];
  tables: ReadonlyMap<string, MoveTable>;
  keepApart: ReadonlyArray<{ guest_a_id: string; guest_b_id: string }>;
  tierLabel: (tier: 1 | 2 | 3 | 4) => string;
  now?: Date;
}): MoveAssessment {
  const { mover, target, other, guests, tables, keepApart, tierLabel, now } = input;
  const label = (id: string | null) => (id ? (tables.get(id)?.label ?? 'their table') : 'no seat yet');
  const from = mover.seated_table_id;
  const kind = other ? 'swap' : 'move';
  const title = other
    ? `Swap ${first(mover.name)} (${label(from)}) with ${first(other.name)} (${label(target.tableId)})?`
    : `Move ${first(mover.name)} to ${label(target.tableId)}${target.seat !== null ? ` · seat ${target.seat + 1}` : ''}?`;
  const why = (g: MoveGuest) => seatWhyWords({ placed_by: g.seat_placed_by, placed_at: g.seat_placed_at }, first(g.name), now);
  const rows = [mover, ...(other ? [other] : [])].map((g) => ({ guestId: g.guest_id, name: g.name, where: label(g.seated_table_id), why: why(g) }));

  const sideEffects: MoveSideEffect[] = [];
  const warnings: string[] = [];
  const atTable = (tableId: string | null, except: readonly string[]) =>
    tableId ? guests.filter((g) => g.seated_table_id === tableId && !except.includes(g.guest_id)) : [];

  // 1 · the mover's +1s who sit with them now come along (into the target table's free seats).
  if (from && from !== target.tableId) {
    const free = [...(tables.get(target.tableId)?.freeSeats ?? [])].filter((s) => s !== target.seat);
    for (const p of guests.filter((g) => g.plus_one_of === mover.guest_id && g.seated_table_id === from && g.guest_id !== other?.guest_id)) {
      const seat = free.shift();
      if (seat === undefined) warnings.push(`${label(target.tableId)} has no seat left for ${p.name}, ${first(mover.name)}’s +1`);
      else sideEffects.push({ key: `plus:${p.guest_id}`, text: `${first(mover.name)}’s +1 ${p.name} sits with ${first(mover.name)} now — move ${first(p.name)} too?`, on: true, guestId: p.guest_id, tableId: target.tableId, seat });
    }
  }
  // 2 · a +1 who leaves the guest who brings them.
  for (const [g, to] of [[mover, target.tableId], ...(other ? [[other, from] as const] : [])] as const) {
    const host = g.plus_one_of ? guests.find((x) => x.guest_id === g.plus_one_of) : undefined;
    if (host && host.seated_table_id && host.seated_table_id !== to && host.guest_id !== mover.guest_id && host.guest_id !== other?.guest_id) {
      warnings.push(`${first(g.name)} is ${first(host.name)}’s +1 — this seats ${first(g.name)} away from ${first(host.name)}`);
    }
  }
  // 3 · two people the couple keeps apart would share a table.
  const apartFrom = (id: string) => keepApart.flatMap((r) => (r.guest_a_id === id ? [r.guest_b_id] : r.guest_b_id === id ? [r.guest_a_id] : []));
  for (const [g, to] of [[mover, target.tableId], ...(other ? [[other, from] as const] : [])] as const) {
    const there = atTable(to, [mover.guest_id, ...(other ? [other.guest_id] : [])]);
    for (const id of apartFrom(g.guest_id)) {
      const x = there.find((t) => t.guest_id === id);
      if (x) warnings.push(`${first(g.name)} and ${first(x.name)} are kept apart — ${first(x.name)} sits at ${label(to)}`);
    }
  }
  // 4 · a guest of the closest tier leaves the table of their own tier.
  for (const [g, fromT, to] of [[mover, from, target.tableId], ...(other ? [[other, target.tableId, from] as const] : [])] as const) {
    if (g.tier !== 1 || !fromT || !to || fromT === to) continue;
    const ownHere = atTable(fromT, [g.guest_id]).some((x) => x.tier === 1);
    const ownThere = atTable(to, [mover.guest_id, ...(other ? [other.guest_id] : [])]).some((x) => x.tier === 1);
    if (ownHere && !ownThere) warnings.push(`${first(g.name)} sits with the ${tierLabel(1).toLowerCase()} — this moves ${first(g.name)} away from them`);
  }

  const cappedSides = sideEffects.slice(0, 3);
  const cappedWarnings = warnings.slice(0, Math.max(0, 3 - cappedSides.length));
  return { kind, title, rows, sideEffects: cappedSides, warnings: cappedWarnings, quiet: !other && cappedSides.length === 0 && cappedWarnings.length === 0 };
}

/** The toast after it is done — "Swapped Ana and Ben" · "Ana → Table 5 · seat 3 (was Table 2)" + "· moved Ben too". */
export function seatMoveDoneWords(a: MoveAssessment, mover: MoveGuest, other: MoveGuest | null, toLabel: string, seat: number | null, alsoMoved: readonly string[]): string {
  const main =
    a.kind === 'swap' && other
      ? `Swapped ${first(mover.name)} and ${first(other.name)}`
      : `${first(mover.name)} → ${toLabel}${seat !== null ? ` · seat ${seat + 1}` : ''}${a.rows[0]?.where && mover.seated_table_id ? ` (was ${a.rows[0].where})` : ''}`;
  return alsoMoved.length ? `${main} · moved ${alsoMoved.map(first).join(' & ')} too` : main;
}
