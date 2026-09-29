/**
 * extra-seats.ts — how many seat rows a guest's "+N" should have.
 *
 * ⚖ Owner 2026-09-21: "+1 per guest can be up to number 4 … these are for the
 * additional seats", then, asked whether the seat plan should hold chairs for
 * them: "decision. yes. + will have seats beside the person invited".
 *
 * A seat is a ROW (`guests.plus_one_of_guest_id` = the guest who brings it) —
 * the shape a named plus-one already had, which the seat engine already keeps
 * beside its primary and the pax count already counts. So "+3" means exactly
 * three such rows.
 *
 * 🔒 ONLY A PLACEHOLDER IS EVER REMOVED. A placeholder is an unnamed "TBA" seat
 * nobody confirmed. A seat someone NAMED is a person — with their own QR, their
 * own invitation — and lowering a number must never delete them. If the named
 * seats alone exceed the new number, the change is refused with the reason, and
 * the couple removes that person themselves.
 *
 * Pure: no database. The server applies what this returns.
 */

export type ExtraSeatRow = {
  guest_id: string;
  first_name: string | null;
  /** `plus_one_name_confirmed_at` — set when a name was given for this seat. */
  confirmed_at: string | null;
  created_at?: string | null;
};

export const PLACEHOLDER_FIRST_NAME = 'TBA';

/** An unnamed seat nobody has claimed — the only kind that may be removed. */
export function isPlaceholderSeat(row: ExtraSeatRow): boolean {
  return !row.confirmed_at && (row.first_name ?? '').trim().toUpperCase() === PLACEHOLDER_FIRST_NAME;
}

export type ExtraSeatPlan =
  | { ok: true; create: number; remove: string[] }
  | { ok: false; named: number; reason: string };

export function planExtraSeats(
  want: number,
  rows: readonly ExtraSeatRow[],
  guestName = 'This guest',
): ExtraSeatPlan {
  const target = Math.max(0, Math.min(4, Math.trunc(want)));
  const placeholders = rows.filter(isPlaceholderSeat);
  const named = rows.length - placeholders.length;

  if (named > target) {
    return {
      ok: false,
      named,
      reason:
        named === 1
          ? `${guestName}’s plus-one is already named — remove them from the guest list first to go below +1.`
          : `${named} of ${guestName}’s plus-ones are already named — remove one from the guest list first to go lower.`,
    };
  }
  if (rows.length < target) return { ok: true, create: target - rows.length, remove: [] };
  // Too many: drop placeholders only, the newest first.
  const surplus = rows.length - target;
  const newestFirst = [...placeholders].sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
  return { ok: true, create: 0, remove: newestFirst.slice(0, surplus).map((r) => r.guest_id) };
}

/** Which seat a guest's RSVP name fills: the oldest placeholder, else none. */
export function seatToName(rows: readonly ExtraSeatRow[]): string | null {
  const open = rows
    .filter(isPlaceholderSeat)
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
  return open[0]?.guest_id ?? null;
}

/**
 * One seat's answers from the reply. `meal` / `dietary` are PRESENT only when
 * the reply drew that box for the seat (owner 2026-09-29: a plus-one is asked
 * first name, last name, meal and dietary — nothing else); absent = not asked,
 * so the seat's stored answer is left alone.
 */
export type SeatNameInput = {
  seatId: string | null;
  first: string;
  last: string;
  meal?: string;
  dietary?: string | null;
};

/**
 * Read the reply's name boxes: `plus_one_first_name_1…4` / `_last_name_` /
 * `plus_one_seat_id_`, or — from a reply rendered before seats had boxes — the
 * single unnumbered pair. Blank boxes are dropped: a blank box is not a
 * removal (the reply's standing rule).
 */
export function readSeatNames(form: { get(name: string): FormDataEntryValue | null }): SeatNameInput[] {
  const text = (k: string) => String(form.get(k) ?? '').replace(/\s+/g, ' ').trim();
  const out: SeatNameInput[] = [];
  for (let i = 1; i <= 4; i++) {
    const first = text(`plus_one_first_name_${i}`);
    const last = text(`plus_one_last_name_${i}`);
    const seatId = text(`plus_one_seat_id_${i}`) || null;
    // The seat's meal + dietary ride with it — keys present only when drawn.
    const details: Pick<SeatNameInput, 'meal' | 'dietary'> = {};
    if (form.get(`plus_one_meal_${i}`) !== null) details.meal = text(`plus_one_meal_${i}`) || 'no_preference';
    if (form.get(`plus_one_dietary_${i}`) !== null) details.dietary = text(`plus_one_dietary_${i}`).slice(0, 500) || null;
    if (first || last) out.push({ seatId, first, last, ...details });
    // ⚖ A blank name on a seat that already EXISTS still saves its meal and
    // dietary (the caterer cooks for "+2 TBA" too) — and never touches its
    // name: clearing a name is not a removal (removing a guest is the host's).
    else if (seatId && Object.keys(details).length > 0) out.push({ seatId, first: '', last: '', ...details });
  }
  if (out.length === 0) {
    const first = text('plus_one_first_name');
    const last = text('plus_one_last_name');
    if (first || last) out.push({ seatId: null, first, last });
  }
  return out;
}

type SeatDetails = Pick<SeatNameInput, 'meal' | 'dietary'>;

export type SeatNameOp =
  | ({ kind: 'name'; seatId: string; first: string; last: string } & SeatDetails)
  | ({ kind: 'create'; first: string; last: string } & SeatDetails)
  /** No name given: only the seat's meal / dietary move; its name is untouched. */
  | ({ kind: 'details'; seatId: string } & SeatDetails);

/** The seat's meal / dietary keys, only those the reply carried. */
function detailsOf(n: SeatNameInput): SeatDetails {
  const d: SeatDetails = {};
  if (n.meal !== undefined) d.meal = n.meal;
  if (n.dietary !== undefined) d.dietary = n.dietary;
  return d;
}

/**
 * Which seat each typed name fills.
 *
 * ⚖ Owner 2026-09-21 ("2. yes"): one name box per seat.
 *
 * 🔒 THE FORM IS NOT TRUSTED — anyone holding the invitation link can post it.
 *   · a box's seat id is honoured only if it is one of THIS guest's seats;
 *   · a box without one fills the oldest open placeholder;
 *   · a NEW seat is made only while this guest has fewer seats than the couple
 *     gave (`allowed`) — so no reply can mint a seat the couple did not.
 * Two boxes never name the same seat.
 */
export function planSeatNames(
  names: readonly SeatNameInput[],
  seats: readonly ExtraSeatRow[],
  allowed: number,
): SeatNameOp[] {
  const mine = new Set(seats.map((s) => s.guest_id));
  const used = new Set<string>();
  const ops: SeatNameOp[] = [];
  let created = 0;
  const open = [...seats]
    .filter(isPlaceholderSeat)
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));

  for (const n of names) {
    const own = n.seatId && mine.has(n.seatId) && !used.has(n.seatId) ? n.seatId : null;
    if (!n.first && !n.last) {
      // Details only — honoured on this guest's OWN seat, never used to make one.
      if (own) {
        used.add(own);
        ops.push({ kind: 'details', seatId: own, ...detailsOf(n) });
      }
      continue;
    }
    const target = own ?? open.find((s) => !used.has(s.guest_id))?.guest_id ?? null;
    if (target) {
      used.add(target);
      ops.push({ kind: 'name', seatId: target, first: n.first, last: n.last, ...detailsOf(n) });
    } else if (seats.length + created < allowed) {
      created += 1;
      ops.push({ kind: 'create', first: n.first, last: n.last, ...detailsOf(n) });
    }
    // else: every seat is spoken for and no more may be made — the name is not saved.
  }
  return ops;
}

/**
 * The reply's name boxes: one per seat the guest was given, each carrying the
 * seat it fills and the name already on it. A seat not made yet still gets a
 * box (naming it makes it, up to the count). With no seats read at all, one
 * box — the reply exactly as it was before extra seats existed.
 */
export function plusOneNameSlots(
  count: number,
  seats: readonly { guest_id: string; name: string | null }[] | undefined,
  legacyName: string | null | undefined,
): { seatId: string | null; name: string | null }[] {
  if (!seats) return [{ seatId: null, name: legacyName ?? null }];
  /*
    ⚖ Owner 2026-09-29: *"adding +1-4 should be a host decision. and their QR
    auto adapts to it?"* — `count` is the host's, read at render, so the same
    link shows the new number of boxes the moment the host changes it.
    🔒 A NAMED SEAT IS NEVER DROPPED FROM THE REPLY, even when the host's number
    is now below it (a guest-side screen must not make a named person — their
    row, their QR — vanish; removing is the host's). The number caps only the
    EMPTY boxes: named seats + open ones up to `count`, never more than four.
  */
  const want = Math.max(1, Math.min(4, count));
  const namedCount = seats.filter((s) => s.name).length;
  let open = Math.max(0, want - namedCount);
  const out: { seatId: string | null; name: string | null }[] = [];
  for (const s of seats) {
    if (s.name) out.push({ seatId: s.guest_id, name: s.name });
    else if (open > 0) {
      open -= 1;
      out.push({ seatId: s.guest_id, name: null });
    }
  }
  while (open > 0 && out.length < 4) {
    open -= 1;
    out.push({ seatId: null, name: null });
  }
  return out.slice(0, 4);
}
