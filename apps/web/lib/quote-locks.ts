/**
 * 🔒 THE THREE SUPPLIER LOCKS, READ ONCE (owner 2026-11-09 — quotation · payment plan · forms).
 *
 * ⚠ STUB BEHIND ONE FUNCTION (Supplier Build 3 · lane C). Lane B owns the lock toggles and was building the exported
 * lock check when lane C cut its branch; it was not in the tree yet. Every lane-C card asks THIS function and nothing
 * else, so swapping it for lane B's export is a one-line change at integration. Until then it reads the columns lane B's
 * migration `20271329937802` added (`vendor_proposals.changes_locked` / `plan_locked`, `event_form_sends.locked`,
 * `event_question_requests.locked`). The SERVER does not rely on this: `ask_for_a_change()` (migration 20271332041210)
 * re-reads the column and refuses a locked item itself.
 */
export type ItemLocks = { quote: boolean; plan: boolean };

/** The lock flags as a card reads them off a quote row; absent columns read as unlocked ONLY for drawing — never for a write. */
export function quoteLocksOf(row: { changes_locked?: boolean | null; plan_locked?: boolean | null } | null | undefined): ItemLocks {
  return { quote: row?.changes_locked === true, plan: row?.plan_locked === true };
}

/** A sent form's lock. */
export function formLockOf(row: { locked?: boolean | null } | null | undefined): boolean {
  return row?.locked === true;
}
