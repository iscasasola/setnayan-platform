/**
 * apps/web/lib/guest-pass.ts
 *
 * THE FOUR FACTS A DOOR NEEDS — the pass, last slice of the arrival design.
 *
 * The QR already ships. What it lacked is everything a pass is FOR: a guest
 * holding a phone at the door, one bar of signal, someone asking who they are
 * and where they sit. The research's word for the difference is that a pass is
 * a card, not a code in a box.
 *
 * 🔑 NOTHING HERE IS INVENTED. Every field is omitted when the fact does not
 * exist — no "Table TBA", no placeholder time. A pass that states a table the
 * couple has not assigned is worse than a pass that stays quiet about it: the
 * guest believes it, walks to a table, and is moved in front of other people.
 * So this returns only the fields it was given, and the caller renders what it
 * returns.
 *
 * ⚠ THE PARTY LINE COUNTS PEOPLE, NOT PERMISSION. `plus_one_allowed` means the
 * couple ALLOWED a guest to bring someone; it does not mean anyone is coming.
 * Only a named, confirmed +1 makes the pass say "and one guest" — otherwise the
 * pass would announce a seat that was never claimed.
 *
 * Pure: no I/O, no clock. Times are formatted by the caller, which already
 * owns the event's timezone (Manila is the day boundary everywhere in this
 * product — `manilaToday()` in lib/std-views.ts).
 */

export type GuestPassFact = {
  /** Small-caps label: GUEST · TABLE · ARRIVE · BRINGING. */
  label: string;
  value: string;
};

export type GuestPassInput = {
  /** The name on the invitation. A pass with no name is not a pass. */
  displayName: string | null | undefined;
  /** "Table 7" — already formatted by the caller, or null when unassigned. */
  tableLabel?: string | null;
  /** When the doors open, already formatted (e.g. "1:30 PM"), or null. */
  arriveLabel?: string | null;
  /** A CONFIRMED companion's name, never a mere allowance. */
  plusOneName?: string | null;
};

const MAX_VALUE = 48;

function clean(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t.length > 0 ? t.slice(0, MAX_VALUE) : null;
}

/**
 * The facts to print, in the order a door reads them. Returns an empty list
 * when there is no name — the caller then keeps the plain QR card rather than
 * drawing an empty pass.
 */
export function guestPassFacts(input: GuestPassInput): GuestPassFact[] {
  const name = clean(input.displayName);
  if (!name) return [];

  const facts: GuestPassFact[] = [{ label: 'Guest', value: name }];

  const table = clean(input.tableLabel);
  if (table) facts.push({ label: 'Table', value: table });

  const arrive = clean(input.arriveLabel);
  if (arrive) facts.push({ label: 'Arrive', value: arrive });

  const plusOne = clean(input.plusOneName);
  if (plusOne) facts.push({ label: 'Bringing', value: plusOne });

  return facts;
}

/** Does this guest have enough for the card to read as a pass at all? */
export function hasPassFacts(input: GuestPassInput): boolean {
  return guestPassFacts(input).length > 0;
}
