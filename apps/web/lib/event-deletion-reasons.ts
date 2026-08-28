/**
 * event-deletion-reasons.ts — why somebody is removing a celebration, and which
 * of four different things is standing in the way.
 *
 * Pure. No I/O, no `server-only` import, no Supabase client — so the client
 * component that renders the panel and the server action that writes the row
 * read the SAME list, and a `node:test` file can exercise both. The gate's own
 * arithmetic stays in `event-deletion-gate.ts`; this is the vocabulary.
 */

/**
 * The six answers, owner 2026-08-28: *"they can pick a reason for deleting. or
 * they state their reason."*
 *
 * 🔑 ORDER IS NOT ALPHABETICAL AND IS NOT ARBITRARY. It runs from the answer
 * that costs us nothing to the ones that cost us something: a celebration that
 * is off, then a tidy-up, then a duplicate, then a competitor, then price. Put
 * "too expensive" first and it reads as a prompt.
 *
 * ⚠ THE CODES ARE STORED AND THE LABELS ARE NOT. Every one of these strings is
 * also a value in the table's CHECK constraint — renaming a code is a migration,
 * renaming a label is copy. A guard pins them against each other.
 */
export const DELETION_REASONS = [
  { code: 'not_happening', label: 'Not happening any more' },
  { code: 'made_by_mistake', label: 'Made it by mistake' },
  { code: 'made_a_new_one', label: 'Made a new one instead' },
  { code: 'using_something_else', label: 'Using something else' },
  { code: 'too_expensive', label: 'Costs too much' },
  { code: 'other', label: 'Something else' },
] as const;

export type DeletionReasonCode = (typeof DELETION_REASONS)[number]['code'];

export const DELETION_REASON_CODES: readonly string[] = DELETION_REASONS.map(
  (r) => r.code,
);

export function isDeletionReasonCode(v: unknown): v is DeletionReasonCode {
  return typeof v === 'string' && DELETION_REASON_CODES.includes(v);
}

export function deletionReasonLabel(code: string): string {
  return DELETION_REASONS.find((r) => r.code === code)?.label ?? code;
}

/**
 * Is this reason complete enough to send?
 *
 * `other` is the only code that makes the free text load-bearing: picking
 * "Something else" and writing nothing tells us literally nothing, and it is
 * also the one somebody presses when the six do not fit — which is exactly when
 * we most want the sentence.
 *
 * ⚠ ENFORCED IN THE APP, NOT IN A CHECK CONSTRAINT. A half-typed sentence must
 * not come back as a database error on a screen somebody is trying to leave.
 */
export function reasonIsComplete(
  code: string,
  text: string | null | undefined,
): boolean {
  if (!isDeletionReasonCode(code)) return false;
  if (code !== 'other') return true;
  return typeof text === 'string' && text.trim().length > 0;
}

/**
 * WHICH of four different things is holding this celebration — the whole point
 * of this file.
 *
 * 🔴 UNTIL 2026-08-28 ALL FOUR WORE ONE SENTENCE: *"Something on this
 * celebration has already been paid for, so it can't be removed here."* Owner,
 * looking at it: ***"still failed to identify"***. And on the celebration he was
 * looking at, that sentence was not even true — read out of production, its bill
 * was still `submitted` and its GCash payment still `pending`. Nothing had been
 * confirmed. **Nobody had checked it.**
 *
 * ─── WHY `awaiting_check` IS ITS OWN ANSWER AND NOT A SOFTER `settled` ──────
 * They are different facts and the couple can act on one of them. "We have your
 * money" is a thing we know; "you sent us a screenshot four minutes after the
 * bill and nobody has opened it" is a thing we can say and then go and do
 * something about. Collapsing them is what produced a sentence that was wrong on
 * the only celebration in production it has ever been shown for.
 */
export type BlockKind =
  /** A count failed. We do not know what has been paid, so we refuse. */
  | 'unreadable'
  /** A supplier the couple paid has not released it. They can be asked. */
  | 'suppliers'
  /** Money we have confirmed: a settled bill, or an official receipt. */
  | 'settled'
  /** A payment was sent and nobody has checked it yet. */
  | 'awaiting_check';

export type BlockEvidence = {
  unreadable: boolean;
  unsettledPaidSuppliers: number | null;
  /** Bills currently sitting in a settled state. */
  settledOrders: number | null;
  /** BIR official receipts against any of this celebration's bills. */
  receiptRows: number | null;
  /** Payment rows an admin has matched. Money we have confirmed. */
  matchedPayments: number | null;
  /** Payment rows still waiting to be looked at. */
  pendingPayments: number | null;
};

/**
 * Returns null when nothing is holding it.
 *
 * ⚠ THE ORDER IS THE OLD ORDER, DELIBERATELY. `unreadable` first because we
 * cannot describe what we could not read; suppliers next because that is the one
 * a couple can do something about immediately and it names WHO; only then our
 * own money. Reordering this changes which sentence a real person reads.
 */
export function blockKind(e: BlockEvidence): BlockKind | null {
  if (e.unreadable) return 'unreadable';
  if ((e.unsettledPaidSuppliers ?? 0) > 0) return 'suppliers';
  if ((e.settledOrders ?? 0) > 0) return 'settled';
  if ((e.receiptRows ?? 0) > 0) return 'settled';
  if ((e.matchedPayments ?? 0) > 0) return 'settled';
  if ((e.pendingPayments ?? 0) > 0) return 'awaiting_check';
  return null;
}

/**
 * Does this block have a door the couple can press — "Ask us to remove it"?
 *
 * ⛔ `unreadable` DOES NOT, and that is on purpose. There is nothing to request
 * about, because we do not yet know whether there is anything to request about;
 * a button there is a door to a room we cannot describe. `suppliers` does not
 * either — it already has its own, better door, which asks the suppliers
 * directly rather than putting a person in the middle of somebody else's money.
 */
export function blockCanBeAsked(kind: BlockKind | null): boolean {
  return kind === 'settled' || kind === 'awaiting_check';
}
