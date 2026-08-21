/**
 * people-you-can-invite-core.ts — the PURE half of the guest-list people
 * picker: three lists of names become one list of candidates.
 *
 * Split out of `people-you-can-invite.ts` so the rules that actually decide
 * what a host sees can be driven by a test instead of read in a docblock. The
 * server module keeps the queries and the authorization; everything below is
 * arithmetic on rows.
 *
 * ── THE THREE RULES, AND WHY EACH ONE IS HERE ─────────────────────────────
 *
 * 1 · ONE NAME, ONE ROW. The same tita is a guest of last year's graduation
 *     AND a person on your People page. Offering her twice makes the host pick
 *     one and wonder what the other was. First source wins, and the order is
 *     deliberate: `event` rows carry a real first/last split and sometimes an
 *     address, so they are the richest thing we can offer.
 *
 * 2 · AN EMAIL RIDES ONLY ON AN `event` ROW. That address is the host's own
 *     record — they typed it, on their own guest list — and it is what lets
 *     the insert trigger relink the SAME person node instead of minting a
 *     stranger. A samahan co-member's address is not the host's to hold
 *     because they share a group, and the roster never exposes one at all.
 *     🔒 This function DROPS an email on any other source rather than trusting
 *     its caller: a rule enforced where the row is built cannot be undone by a
 *     future caller who did not read the header.
 *
 * 3 · SOMEBODY ALREADY ON THE LIST IS MARKED, NEVER DROPPED. Hiding them is
 *     indistinguishable from not having them, and the host types her again.
 *
 * PURE — no I/O, no clock, no database.
 */

export type InvitableSource = 'event' | 'people' | 'samahan';

export type InvitableCandidate = {
  key: string;
  firstName: string;
  /** Empty when the source only knows one word; the sheet asks for the rest. */
  lastName: string;
  name: string;
  source: InvitableSource;
  from: string;
  email: string | null;
};

export type InvitablePerson = InvitableCandidate & { alreadyHere: boolean };

/** Match key for "already here" and for cross-source de-duplication. Names
 *  only, because a name is the one thing all three sources share. */
export function nameKey(first: string, last: string): string {
  return `${first} ${last}`.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * @param candidates in source-priority order — `event` first. See rule 1.
 * @param hereKeys   `nameKey` of everybody already on THIS event's list.
 */
export function assembleInvitable(
  candidates: InvitableCandidate[],
  hereKeys: ReadonlySet<string>,
): InvitablePerson[] {
  const seen = new Set<string>();
  const out: InvitablePerson[] = [];

  for (const c of candidates) {
    const k = nameKey(c.firstName, c.lastName || c.name);
    if (!k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      ...c,
      // RULE 2, enforced here rather than trusted from the caller.
      email: c.source === 'event' ? (c.email?.trim() || null) : null,
      alreadyHere: hereKeys.has(k),
    });
  }

  return out.sort((a, b) => {
    // People you can actually add come first; then alphabetical, which is how
    // anybody scans a list for a name.
    if (a.alreadyHere !== b.alreadyHere) return a.alreadyHere ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}
