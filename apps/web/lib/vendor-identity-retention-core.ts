/**
 * vendor-identity-retention-core.ts — A SUPPLIER'S RAW IDENTITY UPLOADS GO 90
 * DAYS AFTER WE DECIDE. The decision record stays.
 *
 * Pure logic only; the I/O half is `lib/vendor-identity-retention.ts`.
 *
 * ─── THE PROMISE THIS MAKES TRUE ──────────────────────────────────────────
 * The NPC pack's vendor-verification row (ROPA, regenerated 2026-08-17):
 *
 *   "Raw uploads (government ID, selfie + liveness video, bank micro-deposit,
 *    portfolio): deleted 90 DAYS AFTER the approve/reject decision. The
 *    DECISION RECORD ONLY (outcome, deciding admin, timestamp, screening
 *    result) is retained 7 years (BIR 235 + AMLC AML/CTF). DTI / BIR 2303 /
 *    Mayor's Permit: 7 years."
 *
 * and then: "ADOPTED 2026-08-17, ENFORCEMENT NOT YET BUILT."
 *
 * 🔑 THE PACK NAMES FOUR THINGS AND TWO OF THEM WE NO LONGER COLLECT. The owner
 * pruned the slot list on 2026-07-03 ("we do not need this … what we have, that
 * is it"): `government_id`, `live_selfie`, `phone_email_otp` and
 * `amlc_screening` are RETIRED, and identity confirmation is now the 15-minute
 * Google Meet. The pack was regenerated a MONTH LATER and still declares all of
 * them. That over-declaration is a real defect in the filing and is reported,
 * not silently coded around.
 *
 * ⚠ BUT RETIRED IS NOT THE SAME AS ABSENT, WHICH IS WHY THEY ARE SWEPT ANYWAY.
 * The pruning comment is explicit that values already stored under a retired key
 * "are simply ignored" — ignored, not removed — and
 * `vendor_verifications.government_id_r2_key` is still a live column that
 * `referencedVerificationKeys` still reads. A government ID nobody asks for any
 * more is precisely the file most worth deleting on a clock. Sweeping a slot
 * that is usually empty costs nothing; skipping it because a comment says it is
 * retired is how a passport photo lives in a bucket forever.
 *
 * ⛔ WHAT IS DELIBERATELY NOT SWEPT — over-deleting here is worse than the gap:
 * • `dti_certificate` · `bir_2303` · `mayors_permit` — the pack retains these
 *   SEVEN YEARS. They are the business's registration, not the person's
 *   identity, and deleting them destroys the evidence the decision rested on.
 * • The decision record — outcome, deciding admin, timestamp, reason.
 * • `client_references` · `social_media` · `google_meet` — the pack's 90-day
 *   list does not name them, and inventing scope for a one-way delete is how a
 *   retention job becomes the incident. (`client_references` holds third-party
 *   names and phone numbers with no clock at all; that is a real gap, and it is
 *   flagged for the owner rather than fixed by helping myself to it here.)
 * • An application never DECIDED (draft, withdrawn) — the pack's clock starts at
 *   the approve/reject decision, so an undecided row has not started it. Also a
 *   flagged gap, not a silent widening.
 */

/** Days after the approve/reject decision before raw identity uploads go. */
export const VENDOR_IDENTITY_RETENTION_DAYS = 90;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * `doc_uploads` slots deleted on the 90-day clock — the pack's "raw uploads"
 * list, mapped onto the real JSON keys.
 *
 *   government ID        → government_id      (RETIRED 2026-07-03; legacy rows)
 *   selfie + liveness    → live_selfie        (RETIRED 2026-07-03; legacy rows)
 *   bank micro-deposit   → bank_account_proof (LIVE)
 *   portfolio            → portfolio_samples  (LIVE)
 */
export const IDENTITY_DOC_SLOTS = [
  'government_id',
  'live_selfie',
  'bank_account_proof',
  'portfolio_samples',
] as const;

/**
 * Slots the pack retains for SEVEN YEARS. Named explicitly, and asserted against
 * the delete list in the tests, so the two can never quietly overlap — a slot
 * appearing in both would delete a document we told the NPC we keep.
 */
export const SEVEN_YEAR_DOC_SLOTS = ['dti_certificate', 'bir_2303', 'mayors_permit'] as const;

/**
 * Columns on `vendor_verifications` holding raw identity uploads. `government_id_r2_key`
 * is the retired-but-still-present one; the bank proof is live.
 *
 * ⛔ The three permit columns on that same table are NOT here, for the same
 * reason as above: seven years.
 */
export const IDENTITY_VERIFICATION_COLUMNS = [
  'government_id_r2_key',
  'bank_account_proof_r2_key',
] as const;

/**
 * Has the 90-day clock run out on this decision?
 *
 * 🔒 FAILS CLOSED. No decision timestamp, an unparseable one, or a clock we
 * cannot read returns FALSE — nothing is deleted. R2 is not versioned and a
 * government ID cannot be un-deleted; a sweep that skips is recoverable next
 * week, a sweep that deletes on bad information is not.
 */
export function vendorIdentityIsPastRetention(
  decidedAt: string | null | undefined,
  nowMs: number,
  retentionDays: number = VENDOR_IDENTITY_RETENTION_DAYS,
): boolean {
  if (typeof decidedAt !== 'string' || decidedAt.trim().length === 0) return false;
  const decided = Date.parse(decidedAt);
  if (!Number.isFinite(decided)) return false;
  if (!Number.isFinite(nowMs)) return false;
  return nowMs >= decided + Math.max(0, retentionDays) * MS_PER_DAY;
}

/**
 * The identity-slot subset of a `doc_uploads` object — what may be deleted.
 * Everything else is left exactly as it was.
 *
 * Returned as an object (rather than refs) so the caller can hand it to
 * `collectStoredAssetRefs`, which already knows how to walk the slot union —
 * two of the seven shapes are ARRAYS, and a hand-rolled `.r2_key` read would
 * silently miss every portfolio sample.
 */
export function identityUploadsSubset(docUploads: unknown): Record<string, unknown> {
  if (!docUploads || typeof docUploads !== 'object' || Array.isArray(docUploads)) return {};
  const src = docUploads as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const slot of IDENTITY_DOC_SLOTS) {
    if (src[slot] !== undefined && src[slot] !== null) out[slot] = src[slot];
  }
  return out;
}

/**
 * `doc_uploads` with the identity slots removed and everything else untouched.
 *
 * ⚠ THE SLOT IS REMOVED, NOT BLANKED. A key left present with an empty object
 * still reads as "this document was collected" to the admin queue and to
 * anything counting completion; the honest post-retention state is that the
 * slot is not there. The seven-year documents and the decision record are
 * copied through byte-for-byte.
 */
export function scrubIdentityUploads(docUploads: unknown): Record<string, unknown> {
  if (!docUploads || typeof docUploads !== 'object' || Array.isArray(docUploads)) return {};
  const src = docUploads as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const drop = new Set<string>(IDENTITY_DOC_SLOTS);
  for (const [k, v] of Object.entries(src)) {
    if (!drop.has(k)) out[k] = v;
  }
  return out;
}

/** Does this row still hold anything the 90-day clock covers? */
export function hasIdentityUploads(docUploads: unknown): boolean {
  return Object.keys(identityUploadsSubset(docUploads)).length > 0;
}
