/**
 * Turn a foreign-key refusal on a user delete into a sentence a human can act on.
 *
 * ── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * Deleting a user used to be refused by 48 foreign keys, almost all of them by
 * ACCIDENT: nobody wrote an ON DELETE clause, Postgres fell back to NO ACTION,
 * and the delete failed with a message naming a constraint nobody had ever read.
 * Two sweeps (2026-08-01 and 2026-08-02) gave every one of them a written
 * verdict — see supabase/migrations/*_user_delete_fk_* and
 * tests/db/user-delete-refusing-fks.baseline.txt.
 *
 * THREE still refuse, and those three are decisions rather than oversights. That
 * changes what a failure MEANS. Before, "delete failed" was a bug report. Now it
 * is the system correctly declining to destroy a financial or legal record — and
 * the person on the other end deserves to be told which record and what the
 * alternative is, not handed a constraint name.
 *
 * ⚠ THE ALTERNATIVE IS NOT A SCHEMA CHANGE. It is anonymize-and-retain, which
 * this codebase already implements: `lib/erasure/purge.ts` scrubs the subject's
 * PII in place, tombstones the account and revokes every session WITHOUT issuing
 * a DELETE. Converting one of these three FKs to make a hard delete pass would
 * falsify the record it protects — an unauthorised-looking refund, an orphaned
 * paid order, a contract signature attributed to nobody.
 */

/** A foreign key that deliberately refuses to let its referenced user be deleted. */
type DeliberateBlocker = {
  /** Constraint name as it appears in the Postgres error text. */
  constraint: string;
  /** Plain-English name for the record being protected. */
  record: string;
  /** Why an anonymous actor would falsify this record rather than de-identify it. */
  reason: string;
};

/**
 * Kept in lockstep with tests/db/user-delete-refusing-fks.baseline.txt — that
 * file is the decision, this is the message. A DB test asserts the baseline
 * still names exactly the FKs that refuse; if a fourth is ever added there, add
 * it here too or its failure goes back to being a raw constraint name.
 */
const DELIBERATE_BLOCKERS: readonly DeliberateBlocker[] = [
  {
    constraint: 'order_refunds_refunded_by_admin_id_fkey',
    record: 'a refund they issued',
    reason:
      'a refund is money leaving the business, and a payout attributed to nobody is unauditable',
  },
  {
    constraint: 'supplies_orders_buyer_user_id_fkey',
    record: 'a supplies purchase',
    reason:
      'a completed commercial transaction with a counterparty and a BIR record-keeping duty; the buyer is the record',
  },
  {
    constraint: 'vendor_contract_signatures_signer_user_id_fkey',
    record: 'a signed vendor contract',
    reason:
      'under RA 8792 the signer identity is the legally operative act — anonymising it voids the instrument and destroys the other party’s rights',
  },
];

/**
 * Given a Postgres error message from a failed user delete, return an
 * explanation, or `null` if this is not a recognised deliberate refusal.
 *
 * `null` is meaningful and must NOT be swallowed: it means a foreign key refused
 * that nobody decided on — the exact regression the sweeps closed. Callers
 * should keep logging the raw message in that case.
 */
export function describeUserDeleteBlocker(dbErrorMessage: string): string | null {
  const hit = DELIBERATE_BLOCKERS.find((b) => dbErrorMessage.includes(b.constraint));
  if (!hit) return null;
  return (
    `This account cannot be hard-deleted: it holds ${hit.record}, which Setnayan must retain — ` +
    `${hit.reason}. Erase them instead (Delete on /admin/users already does this): the person’s ` +
    `personal data is scrubbed and the account is locked out, while the transactional record survives.`
  );
}

/** The constraint names this module knows about — exported for the guard test. */
export const DELIBERATE_BLOCKER_CONSTRAINTS: readonly string[] = DELIBERATE_BLOCKERS.map(
  (b) => b.constraint,
);
