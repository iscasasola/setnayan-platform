/**
 * day-count-bar.ts — THE DAY BAR's numbers (Availability plan step 4, the widget approved 18 Nov; drawing
 * `prototypes/availability_steps_3_4_2026-11-19.html` § Step 4). Pure: safe in a server or client component.
 *
 *   Made to order      "3 of 5 in progress · 2 free" — orders counted IN PROGRESS on every day of their preparation
 *                      window [due − prep, due] (owner 19 Nov, DECISION_LOG "AVAILABILITY FINALIZED" — not by due date).
 *                      The count is the database's (`schedule_pool_in_progress_on`); this file only words it.
 *   Rented by the piece "320 of 500 out · 180 free" — pieces = the SUM of the bookings' quantities.
 *
 * The strip: up to ten, one piece per order (or per piece); above ten, a bar. The dark part is taken, the light part
 * is free. The dot: green when all are free, yellow when some are left, black when full.
 *
 * 🔒 A refused read is never "0 out": `unread` draws "Couldn't read how many are out" in the bar's place.
 */
import type { AvailabilityStyle } from './availability-styles';

export type CountBarKind = 'orders' | 'pieces';

export type CountBar =
  | {
      kind: CountBarKind;
      /** The bar's name: "Orders in progress" · the card's own name ("Tiffany chairs"). */
      name: string;
      /** What one piece is called, as drawn — the schedule's own name, lower case ("chairs"); absent = "pieces". */
      noun?: string;
      taken: number;
      total: number;
      free: number;
      /** "3 of 5 in progress" · "320 of 500 out". */
      words: string;
      /** The computer's shorter words (drawing: "3 of 5" · "320 of 500"). */
      short: string;
      dot: 'ok' | 'some' | 'full';
      strip: 'pieces' | 'fill';
      unread?: false;
    }
  | { kind: CountBarKind; name: string; unread: true };

/** The day bar a group draws, by the style of its cards. Null = the group keeps today's look (day · Not set · …). */
export function countBarKind(style: AvailabilityStyle | null): CountBarKind | null {
  if (style === 'order') return 'orders';
  if (style === 'piece') return 'pieces';
  return null;
}

const n = (x: number) => x.toLocaleString('en-US');

export function countBarOf(input: {
  kind: CountBarKind;
  name: string;
  /** The schedule's own name ("Chairs") — the answer line says "180 chairs free" as drawn, not "180 pieces free". */
  noun?: string | null;
  taken: number | null;
  total: number;
}): CountBar {
  const { kind, name, total } = input;
  if (input.taken === null) return { kind, name, unread: true };
  const noun = input.noun?.trim().toLowerCase() || undefined;
  const taken = Math.max(0, input.taken);
  const free = Math.max(0, total - taken);
  const words = kind === 'orders' ? `${n(taken)} of ${n(total)} in progress` : `${n(taken)} of ${n(total)} out`;
  return {
    kind,
    name,
    ...(kind === 'pieces' && noun ? { noun } : {}),
    taken,
    total,
    free,
    words,
    short: `${n(taken)} of ${n(total)}`,
    dot: taken === 0 ? 'ok' : taken >= total ? 'full' : 'some',
    strip: total <= 10 ? 'pieces' : 'fill',
  };
}

/** One of the schedule's word: "chairs" → "chair", "tables" → "table", "boxes" → "box", "parties" → "party". A word
 *  that does not end in a plain plural is kept as typed ("1 equipment free"), never guessed at (review 2026-11-20). */
export function singularOf(noun: string): string {
  if (/[^aeiou]ies$/.test(noun)) return noun.slice(0, -3) + 'y';
  if (/(ss|sh|ch|x|z)es$/.test(noun)) return noun.slice(0, -2);
  if (/[^s]s$/.test(noun)) return noun.slice(0, -1);
  return noun;
}

/** "chairs" when the bar has its noun ("chair" for one), else "piece"/"pieces" by count. */
const pieceWord = (b: { noun?: string }, count: number) =>
  b.noun ? (count === 1 ? singularOf(b.noun) : b.noun) : count === 1 ? 'piece' : 'pieces';

/** The taken share of the fill bar, 0..100, for a bar above ten. */
export function countBarFillPct(bar: { taken: number; total: number }): number {
  if (bar.total <= 0) return 100;
  return Math.min(100, Math.round((bar.taken / bar.total) * 100));
}

/**
 * The answer line's free part, summed over the bars (drawing: "2 orders and 180 chairs free" — the pieces in the
 * schedule's own word, `noun`). Null when no bar can
 * say it — a group with no bar, or one whose read was refused, keeps the day's own line.
 */
export function freeWords(bars: readonly (CountBar | null)[]): string | null {
  if (bars.length === 0 || bars.some((b) => b === null || b.unread)) return null;
  const parts = (bars as Exclude<CountBar, { unread: true }>[]).map((b) =>
    b.kind === 'orders' ? `${n(b.free)} ${b.free === 1 ? 'order' : 'orders'}` : `${n(b.free)} ${pieceWord(b, b.free)}`,
  );
  const joined = parts.length <= 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return `${joined} free`;
}

/**
 * The answer line when the day is FULL, in the bars' own words (review 2026-11-19: a full chair day read "500 bookings
 * already"). "All 500 pieces out" · "5 of 5 orders in progress", joined like freeWords. Null when no bar can say it.
 */
export function fullWords(bars: readonly (CountBar | null)[]): string | null {
  if (bars.length === 0 || bars.some((b) => b === null || b.unread)) return null;
  const parts = (bars as Exclude<CountBar, { unread: true }>[]).map((b) =>
    b.kind === 'orders'
      ? `${n(b.taken)} of ${n(b.total)} ${b.total === 1 ? 'order' : 'orders'} in progress`
      : `all ${n(b.total)} ${pieceWord(b, b.total)} out`,
  );
  const joined = parts.length <= 2 ? parts.join(' and ') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}
