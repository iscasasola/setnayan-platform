/**
 * business-alaga.ts — the record a business gets when its owner opens a shop.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * A business existed twice and the two halves had never met. Opening a shop
 * (`app/open-shop/actions.ts`) wrote `vendor_profiles` and nothing else; the
 * People page's "A business" alaga was reachable only by typing the name in by
 * hand, a second time, on a different screen. So a supplier who had just spent
 * four screens telling us what their business is called was told, on the People
 * page, that they care for nothing — and a business had no page and no history
 * because it had no record to hang one on.
 *
 * ── WHAT THIS MODULE IS, AND IS NOT ────────────────────────────────────────
 * PURE. It holds no data and does no I/O: it decides WHETHER a shop should get
 * a business alaga and WHAT that row contains. The caller does the reading and
 * writing, so the decision can be asserted without a database (and so the
 * assertion is about behaviour, not about the source of a server action).
 *
 * ── THE FIELDS THAT ARE DELIBERATELY ABSENT ────────────────────────────────
 * A business is NOT a person, and only the person case may carry sensitive PI
 * (RA 10173 §3(l) + minors). So this row carries a name, a kind and a shop id —
 * and no `birth_date`, no `sex`, no `religion`, no `relationship`, and NO
 * consent stamp. That is the same rule `dependent-actions.ts` enforces for a
 * hand-typed business; it is restated as an explicit, asserted shape here
 * because this writer is on a supplier path that nobody would think to check
 * for a child's birthday.
 *
 * ⚠ A FOUNDING DATE IS NOT COLLECTED BY THE WIZARD, so `birth_date` is NULL and
 * stays NULL. Inventing one (the row's created_at, say) would print "founded
 * today" on the shop's own timeline forever — a fabricated fact, drawn as a
 * real one.
 *
 * ── IDEMPOTENCY LIVES IN THE DATABASE, NOT IN THE ORDER OF TWO STATEMENTS ───
 * `dependents_owner_vendor_profile_key` (migration 20271186070892) is a PARTIAL
 * UNIQUE index on (owner_user_id, vendor_profile_id). The caller reads first and
 * writes only when nothing came back, but two concurrent submits would both read
 * empty — the index is what makes the loser a no-op rather than a duplicate.
 * A caller MUST treat the resulting unique violation as success, not failure.
 */

/** The `dependents` row a shop becomes. Field-for-field what the caller inserts. */
export type BusinessAlagaInsert = {
  owner_user_id: string;
  vendor_profile_id: string;
  dependent_kind: 'business';
  name: string;
};

export type BusinessAlagaInput = {
  ownerUserId: string | null | undefined;
  vendorProfileId: string | null | undefined;
  /** `vendor_profiles.business_name` as the wizard captured it. */
  shopName: string | null | undefined;
};

/**
 * The same 128-character cap `addDependent` applies to a hand-typed name, so a
 * business named on one screen and on the other cannot end up stored two
 * different lengths.
 */
export const ALAGA_NAME_MAX = 128;

export function businessAlagaName(shopName: string | null | undefined): string {
  return (shopName ?? '').trim().slice(0, ALAGA_NAME_MAX);
}

/**
 * The row to write, or NULL when there is nothing honest to write.
 *
 * NULL — never a throw, never a partial row — for a missing owner, a missing
 * shop, or a blank name. A nameless record is the one thing the People surface
 * already refuses to render (`dependentSubjects` drops rows it cannot name), so
 * writing one would create a row that exists everywhere except on screen.
 *
 * ⚠ THIS MUST NEVER BECOME A WAY TO FAIL AT OPENING A SHOP. The caller treats
 * NULL as "skip", not as an error — same posture as `resolveHonoreeDependentId`,
 * and the same posture open-shop already takes for the founding team seat and
 * the account-name write.
 */
export function buildBusinessAlagaInsert(input: BusinessAlagaInput): BusinessAlagaInsert | null {
  const ownerUserId = (input.ownerUserId ?? '').trim();
  const vendorProfileId = (input.vendorProfileId ?? '').trim();
  const name = businessAlagaName(input.shopName);
  if (!ownerUserId || !vendorProfileId || !name) return null;
  return {
    owner_user_id: ownerUserId,
    vendor_profile_id: vendorProfileId,
    dependent_kind: 'business',
    name,
  };
}

/**
 * Is this Postgres error the idempotency key doing its job?
 *
 * 23505 on `dependents_owner_vendor_profile_key` means somebody else's request
 * won the race and the record ALREADY EXISTS — which is the outcome we wanted.
 * Reporting it as a failure would turn the guarantee ("exactly one, never a
 * duplicate") into an error message on a supplier's screen.
 */
export function isAlreadyRecorded(error: { code?: string | null; message?: string | null } | null): boolean {
  if (!error) return false;
  if (error.code === '23505') return true;
  return /duplicate key|unique constraint/i.test(error.message ?? '');
}
