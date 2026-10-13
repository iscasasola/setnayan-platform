/**
 * lib/seat-counter.ts — THE SEAT COUNTER'S RULES, ONE PLACE (the Seat plan's table sheet; owner "approved" 2026-10-13,
 * `MAKER_PRINTS_SEAT_COUNTER_2026-10-13_fable.md` § 7). The editor (`seating-editor.tsx`) and its dev lab read the same
 * answer; the drawing is the shared `Counter` (kind 17).
 *
 * Kept from the shipped stepper, byte for byte in meaning:
 *   · − removes the HIGHEST-numbered EMPTY chair, and is refused (grey) when every chair left is taken;
 *   · + brings back the LOWEST-numbered removed chair, and is grey when no chair is removed (all of them are out);
 *   · the number is the chairs at the table now (capacity − removed). A chair's name is its number from 1.
 *
 * Pure: no request, no React.
 */

export type SeatCounterInput = {
  /** The table's chairs, removed ones included. */
  capacity: number;
  /** The chairs taken away (0-based seat numbers). */
  removed: ReadonlySet<number>;
  /** Which chairs have a guest in them (0-based) — `occupied[i]`. */
  occupied: ReadonlyArray<boolean>;
};

export type SeatCounter = {
  /** The chairs at the table now. */
  value: number;
  capacity: number;
  /** Guests seated at this table. */
  seated: number;
  /** The chair − takes away (0-based), or null — grey. */
  less: number | null;
  /** The chair + brings back (0-based), or null — grey. */
  more: number | null;
  /** The − button's name — saying why when it is grey. */
  lessLabel: string;
  /** The + button's name — saying why when it is grey. */
  moreLabel: string;
  /** The row's small line: "6 seated · of 10 chairs". */
  line: string;
};

export function seatCounter({ capacity, removed, occupied }: SeatCounterInput): SeatCounter {
  const cap = Number.isInteger(capacity) && capacity > 0 ? capacity : 0;
  let less: number | null = null;
  for (let i = cap - 1; i >= 0; i--) {
    if (!removed.has(i) && !occupied[i]) {
      less = i;
      break;
    }
  }
  let more: number | null = null;
  for (let i = 0; i < cap; i++) {
    if (removed.has(i)) {
      more = i;
      break;
    }
  }
  let gone = 0;
  for (const i of removed) if (i >= 0 && i < cap) gone += 1;
  let seated = 0;
  for (let i = 0; i < cap; i++) if (occupied[i] && !removed.has(i)) seated += 1;
  return {
    value: cap - gone,
    capacity: cap,
    seated,
    less,
    more,
    lessLabel: less === null ? 'Every chair left is taken' : 'One chair less',
    moreLabel: more === null ? `All ${cap} chairs are out` : 'One chair more',
    line: `${seated} seated · of ${cap} chairs`,
  };
}

/** The status line after a step: "Chair 8 removed." · "Chair 8 is back." (a chair is named from 1). */
export function seatStepWords(seat: number, removed: boolean): string {
  return removed ? `Chair ${seat + 1} removed.` : `Chair ${seat + 1} is back.`;
}
