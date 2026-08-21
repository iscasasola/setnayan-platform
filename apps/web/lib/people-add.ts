/**
 * people-add.ts — ONE WAY TO ADD SOMEONE, and the rules that shape it.
 *
 * Owner, 2026-08-21: *"Adding people, connecting them as family, no spouse (if
 * status is single), they become married after wedding event or manually change
 * it. friends, dependents (alaga)"*.
 *
 * ── WHAT WAS ACTUALLY BROKEN ───────────────────────────────────────────────
 * Two things, both invisible from the screen:
 *
 *  1. **NOTHING WAS EVER SENT.** "Send request" wrote a database row and
 *     stopped. No email, no notification, and the home page counts only
 *     CONFIRMED connections — so a request sat where literally nobody could
 *     meet it unless the other person happened to open the People page. The
 *     alaga rows on that same page have shipped a copy-link + email-it pair
 *     since 2026-07-17; the connection half never got one.
 *
 *  2. **YOU COULD ONLY ADD SOMEBODY WHO ALREADY HAD AN ACCOUNT**, and were not
 *     told so. `kin_pilot_mutual_accounts` (the owner-as-DPO pilot boundary,
 *     migration 20271026100000) refuses any connection where either side is an
 *     unclaimed person — deliberately, because storing named records of people
 *     who never agreed to anything is the sharpest exposure in a kin graph. The
 *     refusal surfaced as "Couldn't send the request." The trigger's own message
 *     names the remedy — *"Invite them first"* — and the invite did not exist.
 *
 * ── SO THE OUTCOME IS DECIDED SERVER-SIDE, AND READS THE SAME EITHER WAY ────
 * `request` — that address has an account: the claim is stored as pending and
 *             they are emailed. Only they can confirm it.
 * `invite`  — that address has no account: NOTHING IS STORED about them (not
 *             even a person node), and they are invited to join.
 *
 * 🔒 **The screen must not tell the two apart.** Distinguishing them would turn
 * this box into an account-existence oracle for any address anyone types. Both
 * land on one sentence, and the copy says plainly that a person who is not on
 * Setnayan yet has to be added again once they join. Honest friction beats a
 * disclosure.
 *
 * ── THE SPOUSE RULE ────────────────────────────────────────────────────────
 * "Spouse" is not offered to someone whose profile does not say they are
 * married. It is not validation — it is the product declining to ask a single
 * person to name their husband. Two ways in, both the owner's:
 *   · their civil status says `married` (they set it themselves, on their
 *     profile — the manual path), or
 *   · a wedding they are a partner in has already HAPPENED on Setnayan.
 * `civil_status` is sensitive personal information under RA 10173 §3(l), stored
 * only with the person's own consent, so this READS it and never writes it. The
 * wedding path is derived every time, never stored.
 *
 * PURE — no I/O, no clock, no database. Callers pass the context in.
 */

import type { CivilStatus } from '@/lib/profile-personalization';
import type { ConnectionRelation } from '@/lib/people-connections';

/** How a submitted "add someone" landed. Decided by the server, never the form. */
export type AddOutcome = 'request' | 'invite';

/** What we know about the adder when we decide which relations to offer. */
export type SpouseContext = {
  /** From `users.civil_status` — null when they have not said (every account today). */
  civilStatus: CivilStatus | null;
  /** TRUE when a wedding this person is a PARTNER in has already taken place. */
  weddingHasHappened: boolean;
};

/** The label a person reads. */
export const RELATION_LABEL: Record<ConnectionRelation, string> = {
  spouse: 'Spouse',
  parent: 'Parent',
  child: 'Child',
  sibling: 'Sibling',
  godparent: 'Ninong / Ninang',
  godchild: 'Inaanak',
  friend: 'Friend',
};

/** The second line under a chip — what picking it actually means. */
export const RELATION_HINT: Record<ConnectionRelation, string> = {
  spouse: 'Your husband or wife',
  parent: 'Your mother or father',
  child: 'Your son or daughter, grown up',
  sibling: 'Your brother or sister',
  godparent: 'Your own ninong or ninang',
  godchild: 'A child you stood for',
  friend: 'Close enough to be at your celebrations',
};

/**
 * Chip order. Deliberately NOT alphabetical: the ones a person reaches for
 * first come first. `godchild` is absent because the ceremony or the other side
 * creates it — the same rule DECLARABLE_RELATIONS already states.
 */
export const ADD_RELATION_ORDER: ConnectionRelation[] = [
  'parent',
  'sibling',
  'child',
  'spouse',
  'godparent',
  'friend',
];

/**
 * May this person declare a spouse? The owner's rule, in ONE place, so the
 * screen and the server action can never disagree about it.
 *
 * ⚠ `null` (nobody has said) reads as NOT married. That is the safe direction:
 * offering "Spouse" to somebody who has told us nothing is exactly the ask the
 * owner objected to, and the profile is one tap away.
 */
export function spouseIsOfferable(ctx: SpouseContext): boolean {
  return ctx.weddingHasHappened || ctx.civilStatus === 'married';
}

/** The relations offered, in chip order, for this person. */
export function offerableRelations(ctx: SpouseContext): ConnectionRelation[] {
  const spouseOk = spouseIsOfferable(ctx);
  return ADD_RELATION_ORDER.filter((r) => r !== 'spouse' || spouseOk);
}

/**
 * The one line explaining a MISSING spouse chip. Silence would read as a
 * missing feature; this says which door opens it.
 */
export function spouseAbsenceNote(ctx: SpouseContext): string | null {
  if (spouseIsOfferable(ctx)) return null;
  if (ctx.civilStatus === 'widowed' || ctx.civilStatus === 'separated') {
    return 'Spouse isn’t offered here. Change your status on your profile if that isn’t right.';
  }
  return 'Getting married on Setnayan? Your spouse can be added once the wedding day has passed — or set “Married” on your profile to add them now.';
}

/**
 * What the adder is told. ONE sentence for both outcomes — see the oracle note
 * at the top of this file — and the second half is the honest caveat, not a
 * hint about which branch ran.
 */
export function addConfirmation(name: string, delivered: boolean): string {
  const who = name.trim() || 'They';
  if (!delivered) {
    return `We couldn’t send the email to ${who}. Copy the link below and send it yourself.`;
  }
  return `Sent to ${who}. They confirm before it connects — and if they’re not on Setnayan yet, add them again once they join.`;
}

/** Trim + lower an email, or null. Same normalisation the resolver keys on. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase();
  if (!v) return null;
  // Deliberately loose: a strict regex here only rejects real addresses
  // (plus-tags, long TLDs). The send either reaches them or reports that it did
  // not, which is a truer test than any pattern.
  return v.includes('@') && !v.startsWith('@') && !v.endsWith('@') ? v : null;
}

/** A person's own first name, for the invitation's "X added you" line. */
export function firstNameOf(displayName: string | null | undefined): string | null {
  const v = (displayName ?? '').trim();
  if (!v) return null;
  return v.split(/\s+/)[0] ?? null;
}
