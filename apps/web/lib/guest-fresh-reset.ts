/**
 * 🔄 RESET A GUEST'S INVITATION — AS IF IT WAS NEVER USED (owner 2026-10-26, on the guest card, verbatim: *"So at the
 * bottom, have (RESET) (DELETE)"* — after a dry run on his own guest list, he wanted that guest's invitation to feel fresh).
 *
 * The DECISIONS, pure, so a test can hold them; the writes are `inline-actions.ts › setGuestRsvp(…, { fresh: true })` and
 * its Undo `restoreGuestRsvpAndSeat(…, fresh)` (+0 server actions — the Vercel route budget sits at its ceiling).
 *
 * WHAT THE REPLY WRITES IS WHAT RESET CLEARS — measured from the one reply writer (`app/[slug]/actions.ts › submitRsvp`
 * and its `nameTheSeats`), not guessed:
 *   · the guest's row — the answer (`rsvp_status` → No reply, its date and who set it → null), meal, dietary, their note
 *     to the couple (`guest_note`; the couple's own note is `notes` and is NOT touched), what to call them
 *     (`display_name` — on a guest's own row only the reply writes it: the card passes it through untouched and a new
 *     guest starts null), the photo-tagging answer (`face_tagging_wanted`), and the "+1 name" mirror (`plus_one_name`,
 *     `plus_one_name_confirmed_at`);
 *   · the +1 seats THEY named in the reply (`rsvp_set_by = 'guest'` on the seat — the reply's mark; a seat the host named
 *     carries none) go back to an unnamed "+N · TBA" seat. NOT deleted: a guest's "+N" IS their rows
 *     (`a_plus_ones_count_is_their_rows`), so deleting one would leave "+1" with no seat under it — the bug that rule
 *     fixed. A seat an account has linked to is left alone (`lockLinkedSeatNames`' rule: that name is the account's);
 *   · their song requests still waiting for the DJ (`pending`). One the DJ already took or turned down is part of the
 *     night's program now, and stays.
 *
 * KEPT: the row itself, the host's info (name, side, role, groups, table and chair, the couple's notes, the mobile on
 * Basic Info — the host can type it too, and nothing records who did), the personal link and QR (they keep working),
 * `invitation_sent_at` (it was sent — Reset does not un-send it), and any linked account (unlinking ROTATES the QR, which
 * Reset promises not to do; ⋯ › Unlink account is that door).
 */
import type { MealPreference, RsvpStatus } from '@/lib/guests';

export const FRESH_RSVP_VALUES: readonly RsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];
export const FRESH_MEAL_VALUES: readonly MealPreference[] = ['beef', 'chicken', 'fish', 'vegetarian', 'vegan', 'kids', 'no_preference'];
export const FRESH_SET_BY = ['guest', 'host'] as const;

/** The guest's own row, as the reply left it — the columns Reset clears, read before the write (the Undo's half). */
export type FreshGuestBefore = {
  guest_id: string;
  rsvp_status: RsvpStatus;
  rsvp_responded_at: string | null;
  rsvp_set_by: 'guest' | 'host' | null;
  meal_preference: MealPreference | null;
  dietary_restrictions: string | null;
  guest_note: string | null;
  display_name: string | null;
  face_tagging_wanted: boolean | null;
  plus_one_name: string | null;
  plus_one_name_confirmed_at: string | null;
};

/** A +1 seat the guest named in the reply, as it was. */
export type FreshSeatBefore = {
  guest_id: string;
  first_name: string | null;
  last_name: string | null;
  name_prefix: string | null;
  middle_name: string | null;
  name_suffix: string | null;
  display_name: string | null;
  plus_one_name_confirmed_at: string | null;
  rsvp_status: RsvpStatus;
  rsvp_responded_at: string | null;
  rsvp_set_by: 'guest' | 'host' | null;
  meal_preference: MealPreference | null;
  dietary_restrictions: string | null;
  /** 0-based position among the guest's live seats — the "+N" its placeholder is numbered by. */
  seat_index: number;
};

/** A song request still waiting, as it was. */
export type FreshSongBefore = {
  request_id: string;
  song_id: number;
  requester_name: string | null;
  created_at: string;
};

/** Everything Reset changed, exactly as it was — what Undo puts back. */
export type FreshBefore = { guest: FreshGuestBefore; seats: FreshSeatBefore[]; songs: FreshSongBefore[] };

/** The guest row's columns Reset writes — and ONLY these. */
export const FRESH_GUEST_COLUMNS = [
  'rsvp_status',
  'rsvp_responded_at',
  'rsvp_set_by',
  'meal_preference',
  'dietary_restrictions',
  'guest_note',
  'display_name',
  'face_tagging_wanted',
  'plus_one_name',
  'plus_one_name_confirmed_at',
] as const satisfies readonly (keyof FreshGuestBefore)[];

/** A named seat's columns Reset writes — and ONLY these. */
export const FRESH_SEAT_COLUMNS = [
  'first_name',
  'last_name',
  'name_prefix',
  'middle_name',
  'name_suffix',
  'display_name',
  'plus_one_name_confirmed_at',
  'rsvp_status',
  'rsvp_responded_at',
  'rsvp_set_by',
  'meal_preference',
  'dietary_restrictions',
] as const satisfies readonly (keyof FreshSeatBefore)[];

/** The guest's row after Reset: never replied. */
export function freshGuestWrite(): Pick<FreshGuestBefore, (typeof FRESH_GUEST_COLUMNS)[number]> {
  return {
    rsvp_status: 'pending',
    rsvp_responded_at: null,
    rsvp_set_by: null,
    meal_preference: null,
    dietary_restrictions: null,
    guest_note: null,
    display_name: null,
    face_tagging_wanted: null,
    plus_one_name: null,
    plus_one_name_confirmed_at: null,
  };
}

/** A seat after Reset: the unnamed "+N · TBA" seat the host's number made (`syncExtraSeats`' shape). */
export function freshSeatWrite(seatIndex: number): Pick<FreshSeatBefore, (typeof FRESH_SEAT_COLUMNS)[number]> {
  return {
    first_name: 'TBA',
    last_name: '+1',
    name_prefix: null,
    middle_name: null,
    name_suffix: null,
    display_name: `+${seatIndex + 1} · TBA`,
    plus_one_name_confirmed_at: null,
    rsvp_status: 'pending',
    rsvp_responded_at: null,
    rsvp_set_by: null,
    meal_preference: null,
    dietary_restrictions: null,
  };
}

/** Which of a guest's live seats the REPLY named (the guest's mark on the seat, a confirmed name, no linked account). */
export function seatsTheGuestNamed<T extends { guest_id: string; rsvp_set_by: string | null; plus_one_name_confirmed_at: string | null }>(
  seats: readonly T[],
  linked: ReadonlySet<string>,
): T[] {
  return seats.filter((s) => s.rsvp_set_by === 'guest' && s.plus_one_name_confirmed_at != null && !linked.has(s.guest_id));
}

/** Is there anything for Reset to clear? (Nothing → the card says so instead of writing.) */
export function freshResetHasWork(b: FreshBefore): boolean {
  const g = b.guest;
  const now = freshGuestWrite();
  const guestDiffers = FRESH_GUEST_COLUMNS.some((c) => (g[c] ?? null) !== (now[c] ?? null));
  return guestDiffers || b.seats.length > 0 || b.songs.length > 0;
}

// ── The Undo's payload comes back from the browser: re-checked here, field by field. ──────────────────────────────────

const TEXT_MAX = 4000;
const isText = (v: unknown): v is string | null => v === null || (typeof v === 'string' && v.length <= TEXT_MAX);
const isStamp = (v: unknown): v is string | null => v === null || (typeof v === 'string' && v.length <= 64 && !Number.isNaN(Date.parse(v)));
const isUuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isSetBy = (v: unknown) => v === null || v === 'guest' || v === 'host';
const isRsvp = (v: unknown) => FRESH_RSVP_VALUES.includes(v as RsvpStatus);
const isMeal = (v: unknown) => v === null || FRESH_MEAL_VALUES.includes(v as MealPreference);

/**
 * The Undo's snapshot, re-checked: every value is one of the column's own (an answer, a meal, a stamp, a short text),
 * the guest is `guestId`, and nothing beyond the listed columns is carried. A crafted payload is refused whole.
 */
export function freshBeforeIsValid(b: unknown, guestId: string): b is FreshBefore {
  if (!b || typeof b !== 'object') return false;
  const { guest: g, seats, songs } = b as FreshBefore;
  if (!g || g.guest_id !== guestId || !isUuid(g.guest_id)) return false;
  if (!isRsvp(g.rsvp_status) || !isStamp(g.rsvp_responded_at) || !isSetBy(g.rsvp_set_by) || !isMeal(g.meal_preference)) return false;
  if (![g.dietary_restrictions, g.guest_note, g.display_name, g.plus_one_name].every(isText)) return false;
  if (!isStamp(g.plus_one_name_confirmed_at)) return false;
  if (!(g.face_tagging_wanted === null || typeof g.face_tagging_wanted === 'boolean')) return false;
  if (!Array.isArray(seats) || seats.length > 4 || !Array.isArray(songs) || songs.length > 50) return false;
  for (const s of seats) {
    if (!s || !isUuid(s.guest_id) || s.guest_id === guestId) return false;
    if (![s.first_name, s.last_name, s.name_prefix, s.middle_name, s.name_suffix, s.display_name, s.dietary_restrictions].every(isText)) return false;
    if (!isStamp(s.plus_one_name_confirmed_at) || !isRsvp(s.rsvp_status) || !isStamp(s.rsvp_responded_at) || !isSetBy(s.rsvp_set_by) || !isMeal(s.meal_preference)) return false;
    if (!Number.isInteger(s.seat_index) || s.seat_index < 0 || s.seat_index > 3) return false;
  }
  for (const x of songs) {
    if (!x || !isUuid(x.request_id) || !Number.isInteger(x.song_id) || x.song_id <= 0) return false;
    if (!(x.requester_name === null || (typeof x.requester_name === 'string' && x.requester_name.trim().length >= 1 && x.requester_name.trim().length <= 40))) return false;
    if (typeof x.created_at !== 'string' || !isStamp(x.created_at)) return false;
  }
  return true;
}

/** The guest row as the Undo writes it back — exactly the snapshot's listed columns. */
export function freshGuestRestore(g: FreshGuestBefore): Pick<FreshGuestBefore, (typeof FRESH_GUEST_COLUMNS)[number]> {
  return Object.fromEntries(FRESH_GUEST_COLUMNS.map((c) => [c, g[c] ?? null])) as Pick<FreshGuestBefore, (typeof FRESH_GUEST_COLUMNS)[number]>;
}

/** A seat as the Undo writes it back — exactly the snapshot's listed columns. */
export function freshSeatRestore(s: FreshSeatBefore): Pick<FreshSeatBefore, (typeof FRESH_SEAT_COLUMNS)[number]> {
  return Object.fromEntries(FRESH_SEAT_COLUMNS.map((c) => [c, s[c] ?? null])) as Pick<FreshSeatBefore, (typeof FRESH_SEAT_COLUMNS)[number]>;
}
