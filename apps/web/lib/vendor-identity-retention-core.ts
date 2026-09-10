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

import { collectStoredAssetRefs } from '@/lib/erasure/coverage';
import {
  planCleanupDelete,
  vendorIdentityUploadScope,
  vendorVerificationRecordScope,
  type PlannedDelete,
} from '@/lib/cleanup-delete-scope';

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

// ============================================================================
// THE DELETES ARE PINNED TO THE VENDOR'S OWN FOLDER — BOTH SWEEPS (2026-09-10)
//
// ⚠ CORRECTED. PR #5401 pinned the `vendor_verifications` column path to the
// verification BUCKET and left the applications path unpinned on purpose, with a
// docblock saying its refs were "already tenancy-pinned at WRITE time by SEC-1"
// and a test titled "THE ASYMMETRY IS DELIBERATE" defending it. Both were wrong
// about where the pin lived. SEC-1 is in the SERVER ACTION
// (app/vendor-dashboard/verify/actions.ts); the DATABASE held no such rule —
// `authenticated` holds column INSERT and UPDATE on `doc_uploads` and `status`,
// the owner's draft policy constrains only who owns the row, and the table had no
// trigger. So a vendor PATCHed its own draft through PostgREST with the public
// anon key, naming another shop's seven-year DTI permit or a stranger's logo, and
// moved it to pending_review. The day any admin approved OR rejected it, this
// sweep's admin client deleted both. Proven as a real authenticated session in
// the replay and read in production by the object before this change.
//
// The reviewer's point that made the bucket-only pin wrong for applications
// stands and is kept: a legitimate slot CAN live at
// `r2://setnayan-media/vendors/<own id>/…` (vendorOwnedMediaPolicy). So the pin
// is by TENANT — the vendor's own folder in either bucket — not by bucket alone.
// The write side is closed too (a restrictive policy in migration
// 20271219…_every_cleanup_delete_is_pinned); this is the half that holds even if
// a future writer forgets.
//
// 🔒 REFUSED ⇒ COUNTED, and the pointer is KEPT. Per slot, all-or-nothing: a
// slot holding any ref outside the vendor's folder is left exactly as it was —
// no delete, no scrub — so the refusal is re-reported every pass instead of
// being tidied into an unreachable file.
// ============================================================================

export type ApplicationScrubPlan = {
  /** Objects proven to be this vendor's own identity uploads. */
  deletes: PlannedDelete[];
  /** Refs refused — outside the vendor's own folder. */
  refused: number;
  /** Identity slots left untouched because they held a refused ref. */
  refusedSlots: string[];
  /** Identity slots whose every ref was in scope — removed from `nextDocUploads`. */
  scrubbedSlots: string[];
  /** `doc_uploads` with ONLY the scrubbed slots removed. */
  nextDocUploads: Record<string, unknown>;
};

/**
 * What the 90-day sweep may do to one decided application. Pure; the sweep
 * executes it. `vendor_profile_id` MUST be the row's own column, read by the job.
 */
export function planApplicationScrub(row: {
  vendor_profile_id: string | null;
  doc_uploads: unknown;
}): ApplicationScrubPlan {
  const scope = vendorIdentityUploadScope(row.vendor_profile_id);
  const subset = identityUploadsSubset(row.doc_uploads);
  const deletes: PlannedDelete[] = [];
  const refusedSlots: string[] = [];
  const scrubbedSlots: string[] = [];
  let refused = 0;

  for (const slot of Object.keys(subset)) {
    const refs = collectStoredAssetRefs(subset[slot]);
    const present = refs.map((ref) => ({ ref, decision: planCleanupDelete(ref, scope) }));
    const inScope = present.filter((p) => p.decision.ok);
    const outOfScope = present.filter((p) => !p.decision.ok);
    if (outOfScope.length > 0) {
      refused += outOfScope.length;
      refusedSlots.push(slot);
      continue;
    }
    for (const p of inScope) {
      if (p.decision.ok) deletes.push(p.decision.target);
    }
    scrubbedSlots.push(slot);
  }

  const src =
    row.doc_uploads && typeof row.doc_uploads === 'object' && !Array.isArray(row.doc_uploads)
      ? (row.doc_uploads as Record<string, unknown>)
      : {};
  const drop = new Set(scrubbedSlots);
  const nextDocUploads: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (!drop.has(k)) nextDocUploads[k] = v;
  }
  return { deletes, refused, refusedSlots, scrubbedSlots, nextDocUploads };
}

export type VerificationKeyColumn = (typeof IDENTITY_VERIFICATION_COLUMNS)[number];

export type VerificationScrubPlan = {
  deletes: PlannedDelete[];
  /** Columns refused — the object AND the pointer are kept. */
  refused: VerificationKeyColumn[];
  /** Columns whose object was proven the vendor's own — the ONLY ones to null. */
  clear: VerificationKeyColumn[];
};

/**
 * What the sweep may do to one decided `vendor_verifications` row: the private
 * verification bucket AND the vendor's own `vendors/<id>/` folder there.
 */
export function planVerificationScrub(
  row: { vendor_profile_id: string | null } & Partial<Record<VerificationKeyColumn, string | null>>,
): VerificationScrubPlan {
  const scope = vendorVerificationRecordScope(row.vendor_profile_id);
  const present = IDENTITY_VERIFICATION_COLUMNS.filter(
    (c) => typeof row[c] === 'string' && (row[c] as string).length > 0,
  );
  const inScope = present.filter((c) => planCleanupDelete(row[c], scope).ok);
  const refused = present.filter((c) => !planCleanupDelete(row[c], scope).ok);
  const deletes: PlannedDelete[] = [];
  for (const col of inScope) {
    const decision = planCleanupDelete(row[col], scope);
    if (decision.ok) deletes.push(decision.target);
  }
  return { deletes, refused, clear: inScope };
}
