/**
 * May THIS signed-in account spend a supplier claim link?
 *
 * A claim link (`/vendor/claim/<token>/finalize`) turns the signed-in account
 * into the supplier the couple recorded: it opens (or fills) a shop for it,
 * asks the couple for access, and marks the link CLAIMED — once, for good.
 *
 * 🔴 THE CASE THIS REFUSES (2026-11-05). A couple who taps the link they just
 * made (to check it), or a supplier's phone that is still signed in to a
 * personal couple account, reached finalize as a CUSTOMER — and finalize opened
 * a shop for that couple account and spent the link. The real supplier then
 * met "This link was already used."
 *
 * The signal is the one the account already carries:
 *   · `users.account_type = 'vendor'` — set by `/signup?as=vendor`, the door
 *     every new supplier on a claim link signs up through; or
 *   · the account owns a shop or holds a seat on one (`hasVendorAccess`, the
 *     same fact `lib/roles.ts` reports).
 * Either one is supplier intent. A `customer` account with neither is not, and
 * is refused BEFORE anything is written, so the link stays unspent.
 * (`admin` accounts are Setnayan's own and pass — the §10a internal account
 * dogfoods supplier flows.)
 *
 * Pure: finalize passes in what it read, and a read it could not make is
 * `null`, which is refused as "unmeasured" (try again) — never a guess in
 * either direction, because the action it guards cannot be undone.
 */
export type ClaimAccountFacts = {
  /** `users.account_type`, or null when the row could not be read. */
  accountType: string | null;
  /** Owns a shop or holds a seat; null when that read failed. */
  hasVendorAccess: boolean | null;
};

export type ClaimAccountVerdict = { ok: true } | { ok: false; reason: 'not_a_supplier' | 'unmeasured' };

export function claimAccountVerdict(facts: ClaimAccountFacts): ClaimAccountVerdict {
  if (facts.hasVendorAccess === true) return { ok: true };
  if (facts.accountType === 'vendor' || facts.accountType === 'admin') return { ok: true };
  if (facts.accountType === null || facts.hasVendorAccess === null) return { ok: false, reason: 'unmeasured' };
  return { ok: false, reason: 'not_a_supplier' };
}
