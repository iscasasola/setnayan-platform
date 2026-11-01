/**
 * 🪑 WHO PLACED THIS SEAT — and the one line a seat says about it (owner 2026-10-29, DECISION_LOG "GUESTS ANSWERS
 * (owner ~14:40)" answer 4: *"ok"* to "add who placed each seat (auto / arrange vs the couple)"; prototype `whyHere`:
 * "You placed Ana here · yesterday" · "Table 3 · Auto arrange").
 *
 * Stored on `event_seat_assignments.placed_by` ('couple' · 'auto' · NULL) + `placed_at` (migration
 * 20271297291493). Every hand placement stamps 'couple' (`placedByCouple`), every solver run 'auto' (`placedByAuto`).
 * NULL — a seat from before the column, or a writer that does not say — reads as NOTHING: never a guess dressed as a
 * fact (the house rule: a missing read is not an answer).
 * 🔒 lib/a-seat-says-who-placed-it.test.ts
 */

export type SeatPlacedBy = 'couple' | 'auto';

/** The columns a writer adds to the row it writes. */
export type SeatPlacedStamp = { placed_by: SeatPlacedBy; placed_at: string };

export function placedByCouple(now: Date = new Date()): SeatPlacedStamp {
  return { placed_by: 'couple', placed_at: now.toISOString() };
}
export function placedByAuto(now: Date = new Date()): SeatPlacedStamp {
  return { placed_by: 'auto', placed_at: now.toISOString() };
}

/** A stored value → a known one, or null (anything else is "not recorded"). */
export function seatPlacedBy(raw: unknown): SeatPlacedBy | null {
  return raw === 'couple' || raw === 'auto' ? raw : null;
}

const DAY = 86_400_000;

/** "just now" · "today" · "yesterday" · "3 days ago" · "October 3" — never a time that is not known. */
export function placedWhenWords(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  const ms = now.getTime() - at.getTime();
  if (ms < 60_000) return 'just now';
  if (ms < DAY) return 'today';
  if (ms < 2 * DAY) return 'yesterday';
  if (ms < 7 * DAY) return `${Math.floor(ms / DAY)} days ago`;
  return at.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'long', day: 'numeric' });
}

/**
 * The seat's one line — "You placed them here · yesterday" · "Auto arrange placed them here · today" — or null when
 * nobody recorded who placed it (the seat then says nothing). `who` is how the line names the guest ("Ana", or
 * "them" when the caller has no first name).
 */
export function seatWhyWords(
  seat: { placed_by?: unknown; placed_at?: string | null } | null | undefined,
  who = 'them',
  now: Date = new Date(),
): string | null {
  const by = seatPlacedBy(seat?.placed_by);
  if (!by) return null;
  const when = placedWhenWords(seat?.placed_at ?? null, now);
  const said = by === 'couple' ? `You placed ${who} here` : `Auto arrange placed ${who} here`;
  return when ? `${said} · ${when}` : said;
}

/** The short form for a seat's tooltip / a face's spoken name: "placed by you" · "placed by Auto arrange". */
export function seatPlacedShort(raw: unknown): string | null {
  const by = seatPlacedBy(raw);
  return by === 'couple' ? 'placed by you' : by === 'auto' ? 'placed by Auto arrange' : null;
}
