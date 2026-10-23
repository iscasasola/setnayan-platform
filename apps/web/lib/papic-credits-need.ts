/**
 * lib/papic-credits-need.ts — "HOW MANY DO I NEED?" beside the − / + stepper (owner 2026-10-23: *"make it easier to
 * purchase more. with the choice to compute how many to add and a button to purchase"*).
 *
 *   guests coming (the measured head count) × the per-guest numbers that EXIST
 *     — each named guest's own number (`papic_guest_spend_ceilings`),
 *     — the couple's "everyone else, at most N" for the rest (`events.papic_guest_spend_ceiling_points`),
 *   − credits left
 *   = "You need about N more", and the stepper lands on the smallest rung that covers it.
 *
 * ⛔ NO DEFAULT PER GUEST. Owner rule (2026-08-31, on money): *"don't guess."* When the rest of the guests have no
 * number, the helper ASKS ("How many photos each?") — it never fills one in. `perGuest` below is what the couple
 * typed, or null; nothing in this file supplies a number of its own.
 *
 * ⚠ A FAILED READ IS NEVER A ZERO. A head count or a balance that could not be read gives `unread`, and the helper
 * says "couldn't load" — never "you need 0 more".
 *
 * Pure: the reads are `papicBuySizes`' (studio/papic/actions.ts), the words are the helper's.
 */

export type CreditNeedInputs = {
  /** Guests coming — `papic_event_guest_headcount`, the count the pot divides by. null = the read failed. */
  guestsComing: number | null;
  /** Each NAMED guest's own number, one entry per named guest (only while the per-guest numbers are on). */
  named: readonly number[];
  /** The couple's number for everyone who is not named, or null when they have not set one. */
  everyoneElse: number | null;
};

export type CreditNeed =
  /** A read under it failed — say "couldn't load", never a number. */
  | { kind: 'unread' }
  /** The rest of the guests have no number — ask the couple, right there. */
  | { kind: 'ask'; rest: number }
  /** The sum: `total` the guests may take, `more` still to buy (0 = what is left already covers it). */
  | { kind: 'need'; total: number; more: number; guests: number };

const whole = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

export function creditNeed(i: CreditNeedInputs, left: number | null, perGuest: number | null): CreditNeed {
  if (i.guestsComing === null || left === null) return { kind: 'unread' };
  const guests = whole(i.guestsComing);
  const namedCount = Math.min(i.named.length, guests);
  const namedTotal = i.named.slice(0, namedCount).reduce((s, n) => s + whole(n), 0);
  const rest = guests - namedCount;
  // The rest's share: the couple's stored number, else what they typed into the helper. Never ours.
  const each = i.everyoneElse !== null ? whole(i.everyoneElse) : perGuest !== null ? whole(perGuest) : null;
  if (rest > 0 && each === null) return { kind: 'ask', rest };
  const total = namedTotal + rest * (each ?? 0);
  return { kind: 'need', total, more: Math.max(0, total - whole(left)), guests };
}

/**
 * The smallest rung that covers `more`. Above the top rung → the top rung, and `above` says so (the couple buys the
 * top size and comes back for the rest). `more` 0 → the first rung, nothing to cover.
 */
export function rungFor(rungs: readonly { points: number }[], more: number): { index: number; above: boolean } {
  if (rungs.length === 0) return { index: 0, above: false };
  const at = rungs.findIndex((r) => r.points >= more);
  return at === -1 ? { index: rungs.length - 1, above: true } : { index: at, above: false };
}

/** "You need about 1,240 more" · "What you have covers it" — the helper's one line. */
export function needWords(need: Extract<CreditNeed, { kind: 'need' }>): string {
  return need.more === 0 ? 'What you have covers it' : `You need about ${need.more.toLocaleString('en-PH')} more`;
}
