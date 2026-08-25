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
 * 1 · ONE NAME, ONE ROW — UNLESS IT IS TWO PEOPLE. The same tita is a guest of
 *     last year's graduation AND a person on your People page. Offering her
 *     twice makes the host pick one and wonder what the other was. First source
 *     wins, and the order is deliberate: `event` rows carry a real first/last
 *     split and sometimes an address, so they are the richest we can offer.
 *     ⚠ But a name is not an identity. Two candidates with DIFFERENT known
 *     addresses are two different people and both are emitted; merging them
 *     would put one person's address on the other's guest row, and the
 *     Save-the-Date mails it. See the note at the merge itself.
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
  /** name key → the effective addresses already emitted under that name. */
  const kept = new Map<string, Array<string | null>>();
  const out: InvitablePerson[] = [];

  for (const c of candidates) {
    const k = nameKey(c.firstName, c.lastName || c.name);
    if (!k) continue;

    // RULE 2, enforced here rather than trusted from the caller.
    const email = c.source === 'event' ? (c.email?.trim().toLowerCase() || null) : null;

    const already = kept.get(k);
    if (already) {
      /*
        🚨 RULE 1 HAS A LIMIT, AND IT IS AN IDENTITY. Two people really can
        share a name — the cousin Maria Santos on last year's guest list and the
        colleague Maria Santos on another. Collapsing them on the name alone
        emitted ONE row, and the survivor was spread wholesale, so picking
        "Maria Santos" wrote the OTHER Maria's address onto the new guest — and
        the Save-the-Date mails every guest of the event who has one. The screen
        could not warn anybody: it renders the name and the `from` line, and the
        address never reaches the browser at all.

        So a merge now requires the two to be COMPATIBLE: at least one address
        unknown, or the same address twice. Two known-and-different addresses
        are two people, and both rows are emitted — the `from` line under each
        is what tells them apart, which is the whole reason it is there.

        ⚖ This is the boundary `app/join/[eventId]/actions.ts` already draws
        for an ambiguous name match: admit the ambiguity rather than guess.
      */
      const compatible = already.some((e) => e === null || email === null || e === email);
      if (compatible) continue;
    }

    kept.set(k, [...(already ?? []), email]);
    out.push({ ...c, email, alreadyHere: hereKeys.has(k) });
  }

  return out.sort((a, b) => {
    // People you can actually add come first; then alphabetical, which is how
    // anybody scans a list for a name.
    if (a.alreadyHere !== b.alreadyHere) return a.alreadyHere ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}


/**
 * ── THE GROUP GESTURE (2026-08-25) ────────────────────────────────────────
 * A samahan reaches this picker one name at a time. These two turn that into
 * "the whole barkada" without inventing a link between a group and a guest
 * list: the group is a FILTER over rows that are already offered, and what
 * lands are ordinary guests the couple owns.
 */

/** Does this candidate match what the host typed? Name OR the `from` line —
 *  the `from` line is what makes a samahan's name select its members. */
export function matchesInvitableQuery(
  row: { name: string; from: string },
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return row.name.toLowerCase().includes(q) || row.from.toLowerCase().includes(q);
}

/**
 * Choosing (or letting go of) everyone currently shown.
 *
 * 🔑 SOMEBODY ALREADY ON THE LIST IS NEVER TOUCHED — not when choosing, and not
 * when clearing. Adding a guest twice is the mistake this sheet exists to
 * prevent, and a bulk control is exactly where it would happen.
 * 🔑 AND IT NEVER DISTURBS A PICK THAT IS NOT SHOWN. A host who chose two
 * people, then searched for a samahan, must not lose those two.
 */
export function chooseAllShown(
  picked: Readonly<Record<string, boolean>>,
  shown: readonly { key: string; alreadyHere: boolean }[],
  letGo: boolean,
): Record<string, boolean> {
  const next: Record<string, boolean> = { ...picked };
  for (const row of shown) {
    if (row.alreadyHere) continue;
    if (letGo) delete next[row.key];
    else next[row.key] = true;
  }
  return next;
}
