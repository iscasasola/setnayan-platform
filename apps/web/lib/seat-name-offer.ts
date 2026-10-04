/**
 * seat-name-offer.ts — "Use this on your profile" (B9).
 *
 * Owner, 2026-09-30 (DECISION_LOG "THE EVENT'S FORMAL NAME FILLS THE PERSON'S
 * OWN PROFILE — ONE TAP, NEVER SILENT"): when a guest row linked to an account
 * carries a fuller formal name than the account's profile ("Ms. Claire Estoras
 * Buanhog" on the list, "Claire Buanhog" on the profile), the PERSON — never the
 * host — is offered one line on their own Me tab. One confirm copies the
 * event's name into their profile, filling only the EMPTY parts.
 *
 * ── WHEN IT IS OFFERED ────────────────────────────────────────────────────
 *   · the seat holds a real name (a first AND a last, never the TBA
 *     placeholder);
 *   · the seat carries at least one part the profile lacks — the names DIFFER;
 *   · no part disagrees. A profile that says "Ice" where the seat says
 *     "Indalecio" is the person's own typing, and the ruling forbids replacing
 *     it — so nothing is offered rather than a half-merged name.
 *
 * Because no part disagrees, the profile after the tap reads exactly the
 * event's name (plus any part only the profile had) — the line never shows one
 * name and writes another.
 *
 * Pure: the Me tab, the server action and the unit test all call it, so the
 * line and the write can never disagree about what fills.
 */

import {
  FORMAL_NAME_FIELDS,
  composeFormalName,
  normalizeNamePart,
  type FormalName,
  type FormalNameField,
} from '@/lib/formal-name';

type NameLike = Partial<Record<FormalNameField, string | null | undefined>>;

export type SeatNameOffer = {
  /** The parts the tap writes — only the profile's EMPTY ones. */
  fill: Partial<FormalName>;
  /** The profile's name after the tap, as one line. */
  name: string;
};

const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

export function seatNameOffer(profile: NameLike | null | undefined, seat: NameLike | null | undefined): SeatNameOffer | null {
  if (!seat) return null;
  const first = normalizeNamePart(seat.first_name);
  const last = normalizeNamePart(seat.last_name);
  if (!first || !last || first.toLowerCase() === 'tba') return null;

  const fill: Partial<FormalName> = {};
  const after = {} as FormalName;
  for (const f of FORMAL_NAME_FIELDS) {
    const mine = normalizeNamePart(profile?.[f]);
    const theirs = normalizeNamePart(seat[f]);
    if (mine && theirs && !same(mine, theirs)) return null;
    if (!mine && theirs) fill[f] = theirs;
    after[f] = mine ?? theirs;
  }
  if (Object.keys(fill).length === 0) return null;
  const name = composeFormalName(after);
  return name ? { fill, name } : null;
}
