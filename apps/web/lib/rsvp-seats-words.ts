/**
 * 🪑 THE RESERVED SEATS, SAID FIRST — the words of the reply's Seats step and of the +1 step that follows it.
 *
 * Owner, verbatim, 2026-10-25: *"We reserved one seat for you · We reserved two seats for you · Then a screen where
 * they confirm their name and their nickname and contact number then their plus seat"* — approved prototype
 * `Setnayan/prototypes/rsvp_seats_2026-10-25/index.html` (scenarios A–E), "all as recommended":
 *
 *   · the count N INCLUDES the guest — "We reserved two seats for you" is the guest and their +1;
 *   · the extra seats keep the "+1 / +2" naming everywhere (decision 4) — never "Seat 2 / Seat 3";
 *   · a seat list that failed to read says so honestly and claims no count (decision 7, scenario E).
 *
 * One line on screen; the detail goes inside the ⓘ. Pure — the server card and the client +1 step both read it.
 */

const COUNT_WORDS = ['one', 'two', 'three', 'four', 'five'] as const;

/** "one seat" · "two seats" … — a guest holds at most five (themselves + 4). */
export function seatCountWords(n: number): string {
  const whole = Math.max(1, Math.trunc(n));
  const word = COUNT_WORDS[whole - 1] ?? String(whole);
  return whole === 1 ? `${word} seat` : `${word} seats`;
}

/** The Seats step's heading — N includes the guest. */
export function rsvpSeatsHeading(seats: number): string {
  return `We reserved ${seatCountWords(seats)} for you`;
}

/** An extra seat's tag, by SEAT (owner 2026-09-29): "+1", "+2" … — the same as the +1 step's picker. */
export function extraSeatTag(index: number): string {
  return `+${index + 1}`;
}

/** "+1" · "+1 and +2" · "+1, +2 and +3". */
export function extraSeatList(extra: number): string {
  const tags = Array.from({ length: Math.max(0, extra) }, (_, i) => extraSeatTag(i));
  if (tags.length <= 1) return tags[0] ?? '';
  return `${tags.slice(0, -1).join(', ')} and ${tags[tags.length - 1]}`;
}

/**
 * The Seats step's one line and its ⓘ.
 * `namesNext` — the +1 step follows (the couple asks for plus-ones and the list is open).
 */
export function rsvpSeatsLine(input: { seats: number; namesNext: boolean; organizer: string }): { line: string; tip: string } {
  const extra = Math.max(0, input.seats - 1);
  if (extra === 0) {
    return {
      line: 'Just you — see you there.',
      tip: `Your seat is held under your name. Bringing someone? Ask ${input.organizer} — only they can add a seat.`,
    };
  }
  const tip =
    extra === 1
      ? 'A named +1 gets their own invitation, QR and photos. Leave the name blank and the seat is still held for you.'
      : 'Each named seat gets its own invitation, QR and photos. Unnamed seats stay held for you.';
  if (!input.namesNext) return { line: 'One is yours.', tip };
  return {
    line: extra === 1 ? 'One is yours. Name your +1 after this — or later.' : `One is yours. Name ${extraSeatList(extra)} after this — or later.`,
    tip,
  };
}

/**
 * ONE +1's OWN SCREEN — its line under "Who are you bringing?" (owner 2026-10-25: *"one at a time"*, then *"Tick only
 * shows when there is name written. and that is required. If you are not yet sure, delete name"*). The count was
 * already said on the Seats step, so the line names WHICH seat this screen is, then the owner's way out: leave the
 * name empty. Two sentences at most in the ⓘ (house rule).
 */
export function plusOneScreenLine(index: number): { line: string; tip: string } {
  return {
    line: `${extraSeatTag(index)} · Not sure yet? Leave the name empty.`,
    tip: 'A named seat gets its own invitation, QR and photos. Left empty, the seat stays held for you to name later.',
  };
}

/**
 * The +1 step's line when the seat list did NOT read (scenario E, decision 7) — one box, no count claimed. With the
 * list read, each +1 screen says its own line (`plusOneScreenLine`).
 */
export function plusOnesStepLine(input: { extra: number; fallback: boolean }): { line: string; tip: string } {
  if (input.fallback) {
    return {
      line: 'Your seat list didn’t load. Name one now; the rest can be named later from your invitation.',
      tip: 'We could not read who is already named on your seats, so only one box is shown. Nothing you already named is lost.',
    };
  }
  return plusOneScreenLine(Math.max(0, input.extra - 1));
}
