/**
 * march-moves.ts — which name may go where in the Wedding March.
 *
 * ⚖ Owner 2026-09-21, pointing at an empty "—" beside a name: *"tapping should
 * allow us to pair them as well with someone. or the name can be dragged there
 * to pair."* And: *"dragging a name to another will swap the names."*
 *
 * Two moves, one rule each:
 *
 *   JOIN  — someone takes the empty place on a line. They now walk with the
 *           person already on it. If they had a partner, that partner keeps
 *           their own line and walks alone.
 *   SWAP  — two names trade places. Each takes the other's partner AND the
 *           other's spot in the order, so every line stays where it was and
 *           only the names move.
 *
 * 🔑 ONE RULE FOR THE SCREEN AND THE SERVER. The panel asks this module which
 * names to offer in each picker; the server action asks it again, against a
 * fresh read, before it writes. If the two ever used different rules, the
 * picker would offer a move the server refuses — or worse, the server would
 * accept one the screen said was impossible.
 *
 * Pure: no database, no session. It reads the printed lines
 * (`entourageLines`) and the column rule (`columnOfRole`) — the same two the
 * invitation prints from, so "she can stand there" means the invitation will
 * print her there.
 */

import { columnOfRole, type EntouragePerson, type EntourageRow } from '@/lib/entourage';

export type MarchPlace = { line: number; col: 0 | 1; person: EntouragePerson };

export type MarchVerdict = { ok: true } | { ok: false; reason: string };

/** Where one guest stands in a group's lines, or null when they are not in it. */
export function placeOf(lines: readonly EntourageRow[], guestId: string): MarchPlace | null {
  for (const [line, row] of lines.entries()) {
    for (const col of [0, 1] as const) {
      const person = row[col];
      if (person?.id === guestId) return { line, col, person };
    }
  }
  return null;
}

/**
 * May `joinerId` take the empty place on `anchorId`'s line?
 *
 * The empty place is whichever column the anchor is NOT in. In a group with
 * sides (Ninong left, Ninang right) the joiner's role must belong in that
 * column — otherwise the invitation would print them somewhere other than
 * where they were dropped, which is a move that silently did something else.
 */
export function joinVerdict(
  lines: readonly EntourageRow[],
  groupKey: string,
  anchorId: string,
  joinerId: string,
): MarchVerdict {
  if (anchorId === joinerId) return { ok: false, reason: 'A person cannot walk with themselves.' };
  const anchor = placeOf(lines, anchorId);
  if (!anchor) return { ok: false, reason: 'That line has changed since the page loaded — reload and try again.' };
  const row = lines[anchor.line]!;
  const emptyCol = anchor.col === 0 ? 1 : 0;
  if (row[emptyCol]) {
    return { ok: false, reason: `${anchor.person.name} already walks with someone.` };
  }
  const joiner = placeOf(lines, joinerId);
  if (!joiner) {
    return {
      ok: false,
      reason: 'Only someone from this part of the entourage can take that place.',
    };
  }
  const wants = columnOfRole(groupKey, joiner.person.role);
  if (wants !== null && wants !== emptyCol) {
    return {
      ok: false,
      reason: `${joiner.person.name} walks on the ${wants === 0 ? 'left' : 'right'}, so they cannot take a place on the ${emptyCol === 0 ? 'left' : 'right'}.`,
    };
  }
  return { ok: true };
}

/**
 * May `aId` and `bId` trade places?
 *
 * In a group with sides only names in the SAME column may swap: swapping a
 * Ninong with a Ninang would hand each of them a partner of their own side —
 * two Ninongs on one line.
 */
export function swapVerdict(
  lines: readonly EntourageRow[],
  groupKey: string,
  aId: string,
  bId: string,
): MarchVerdict {
  if (aId === bId) return { ok: false, reason: 'Pick a different name to swap with.' };
  const a = placeOf(lines, aId);
  const b = placeOf(lines, bId);
  if (!a || !b) {
    return { ok: false, reason: 'Only names from the same part of the entourage can swap.' };
  }
  if (a.line === b.line) {
    return { ok: false, reason: `${a.person.name} and ${b.person.name} already walk together.` };
  }
  const sided = columnOfRole(groupKey, a.person.role) !== null;
  if (sided && a.col !== b.col) {
    return {
      ok: false,
      reason: `${a.person.name} and ${b.person.name} walk on different sides, so they cannot swap. Drag onto a name in the same column.`,
    };
  }
  return { ok: true };
}

export type MarchOption = { id: string; name: string; note: string | null };

/** Who the picker on an empty place offers: everyone `joinVerdict` accepts. */
export function joinersFor(
  lines: readonly EntourageRow[],
  groupKey: string,
  anchorId: string,
): MarchOption[] {
  const out: MarchOption[] = [];
  for (const row of lines) {
    for (const person of row) {
      if (!person?.id || !joinVerdict(lines, groupKey, anchorId, person.id).ok) continue;
      const partner = row[0] === person ? row[1] : row[0];
      // Say what the move costs: their current partner is left walking alone.
      out.push({ id: person.id, name: person.name, note: partner ? `now with ${partner.name}` : null });
    }
  }
  return out;
}

/** Who "Swap with…" offers for one name: everyone `swapVerdict` accepts. */
export function swapsFor(
  lines: readonly EntourageRow[],
  groupKey: string,
  guestId: string,
): MarchOption[] {
  const out: MarchOption[] = [];
  for (const row of lines) {
    for (const person of row) {
      if (!person?.id || !swapVerdict(lines, groupKey, guestId, person.id).ok) continue;
      const partner = row[0] === person ? row[1] : row[0];
      out.push({ id: person.id, name: person.name, note: partner ? `with ${partner.name}` : null });
    }
  }
  return out;
}
