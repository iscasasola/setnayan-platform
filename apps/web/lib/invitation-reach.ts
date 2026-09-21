/**
 * invitation-reach.ts — WHO can actually receive an invitation, and who cannot.
 *
 * ── THE MEASURED PROBLEM (CTRL-B4, re-measured 2026-09-22) ──────────────────
 * Production: **146 guests · 0 with `invitation_sent_at` · 5 with an email · 0
 * with a mobile and no email.** So 141 of 146 guests are reachable by **no
 * channel at all**, and the couple's Invite step can never complete.
 *
 * 🔑 A SCREEN THAT REPORTS ONLY "SENT" IS A LIE OF OMISSION HERE. "5 sent" is
 * true and useless; the fact that decides what a couple does next is that 141
 * people have no address on file. This module computes both, once, so the two
 * numbers cannot be shown apart or drift apart.
 *
 * Pure and total — every field is derived from the rows the caller already read.
 */

export type GuestReachRow = {
  email?: string | null;
  mobile?: string | null;
  invitation_sent_at?: string | null;
};

export type InvitationReach = {
  /** Every guest on the list. */
  total: number;
  /** Guests the couple has recorded as invited. */
  marked: number;
  /** Not yet marked. */
  remaining: number;
  /** Not marked, and holds an email address — the set a send can actually reach. */
  sendable: number;
  /**
   * Holds NO email and NO mobile. The number that turns "nothing happened" into
   * something a couple can act on.
   *
   * ⚠ Counted across the WHOLE list, not only the unmarked. A guest handed a
   * printed card is still unreachable electronically, and hiding that once they
   * are marked would make the number fall for the wrong reason.
   */
  unreachable: number;
};

/** Trimmed non-empty string, or null. A whitespace-only address reaches nobody. */
function present(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Does this guest hold an address a send could use? */
export function hasEmailAddress(g: GuestReachRow): boolean {
  return present(g.email) !== null;
}

/** Can this guest be reached electronically at all? */
export function isReachable(g: GuestReachRow): boolean {
  return present(g.email) !== null || present(g.mobile) !== null;
}

/** One pass over the list; every number the invitation screen needs. */
export function invitationReach(guests: readonly GuestReachRow[]): InvitationReach {
  let marked = 0;
  let sendable = 0;
  let unreachable = 0;
  for (const g of guests) {
    const isMarked = present(g.invitation_sent_at) !== null;
    if (isMarked) marked += 1;
    if (!isMarked && hasEmailAddress(g)) sendable += 1;
    if (!isReachable(g)) unreachable += 1;
  }
  return {
    total: guests.length,
    marked,
    remaining: guests.length - marked,
    sendable,
    unreachable,
  };
}

/**
 * The sentence the couple reads about who cannot be reached.
 *
 * Returns null when everyone is reachable — there is nothing to say, and a
 * "0 unreachable" line is noise that trains people to stop reading the row.
 */
export function unreachableSentence(r: InvitationReach): string | null {
  if (r.unreachable <= 0) return null;
  if (r.unreachable === r.total) {
    return `None of your ${r.total} guests has an email or mobile on file, so none can be sent one — add addresses, or hand these out yourself.`;
  }
  return `${r.unreachable} of ${r.total} have no email or mobile on file, so they cannot be sent one — add an address, or hand theirs out yourself.`;
}
