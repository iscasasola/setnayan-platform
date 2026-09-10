import 'server-only';

import { R2_BUCKETS, r2List } from '@/lib/r2';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  EMPTY_REFERENCE_SET_REASON,
  VERIFICATION_PREFIX,
  classifyVerificationDocs,
  referencedKeysFrom,
  type VerificationDoc,
} from '@/lib/verification-docs';

/**
 * The server half: read what the database still points at, read what is really
 * in the bucket, and hand the pure classifier both.
 *
 * ── FAIL CLOSED, LOUDLY ─────────────────────────────────────────────────────
 * If either reference source cannot be read, this returns `referencesComplete:
 * false` and the page refuses to offer deletion at all. A partial reference set
 * would mark a LIVE government ID as left over — and the button next to that
 * label is irreversible. Better a page that says "I could not check" than one
 * that quietly under-counts.
 */

export type VerificationDocsReport = {
  docs: VerificationDoc[];
  /** Both reference sources were read. Deletion is refused when false. */
  referencesComplete: boolean;
  /** Why the references are incomplete, for the page to show verbatim. */
  referenceError: string | null;
  /** The bucket could not be listed at all. */
  listingError: string | null;
  truncated: boolean;
};

/**
 * Every R2 key the database still points at.
 *
 * TWO sources, and both must succeed:
 *   · `vendor_verifications` — five `*_r2_key` columns.
 *   · `vendor_verification_applications.doc_uploads` — jsonb slot → VALUE, for
 *     an intake still in progress. Skipping this one would mark a vendor's
 *     half-finished upload as rubbish while they are still filling the form.
 *
 * 🚨 **THIS FUNCTION USED TO COLLECT NOTHING AT ALL, FROM EITHER SOURCE.** It
 * kept `Object.values(...)` entries that were `typeof === 'string'`, and no
 * writer in this codebase has ever produced one — `buildSlotValue` wraps every
 * shape in an object or an array, and the five columns have no writer at all.
 * So the set came back EMPTY with `error: null`, which the page and the delete
 * action both read as "nothing points at this file", and the first real
 * government ID a supplier uploaded would have been offered for permanent
 * deletion. Production is empty today; that is the only reason it never fired.
 *
 * 🔑 **BOTH HALVES ARE NEEDED AND ONLY ONE IS OBVIOUS.** Widening the walk
 * collects `r2://<bucket>/<key>` refs; the listing this set is compared against
 * holds BARE keys. `referencedKeysFrom` adds both forms for exactly that
 * reason — a fix that only widens the walk ships green and deletes the same
 * documents.
 *
 * ⚖ Every value goes through the SAME helper, columns and jsonb alike, so a
 * writer appearing on either source is covered on the day it ships.
 */
async function referencedKeys(): Promise<{ keys: Set<string>; error: string | null }> {
  const admin = createAdminClient();
  const keys = new Set<string>();

  const { data: verifications, error: vErr } = await admin
    .from('vendor_verifications')
    .select(
      'dti_certificate_r2_key, bir_2303_r2_key, mayors_permit_r2_key, government_id_r2_key, bank_account_proof_r2_key',
    );
  if (vErr) {
    return { keys, error: `vendor_verifications: ${vErr.message}` };
  }
  for (const row of verifications ?? []) {
    for (const key of referencedKeysFrom(row)) keys.add(key);
  }

  const { data: applications, error: aErr } = await admin
    .from('vendor_verification_applications')
    .select('doc_uploads');
  if (aErr) {
    return { keys, error: `vendor_verification_applications: ${aErr.message}` };
  }
  for (const row of applications ?? []) {
    const uploads = (row as { doc_uploads?: unknown }).doc_uploads;
    for (const key of referencedKeysFrom(uploads)) keys.add(key);
  }

  return { keys, error: null };
}

/** The set of referenced keys, for a delete action to re-derive at press time. */
export async function referencedVerificationKeys(): Promise<{
  keys: Set<string>;
  error: string | null;
}> {
  return referencedKeys();
}

export async function buildVerificationDocsReport(): Promise<VerificationDocsReport> {
  const { keys, error: referenceError } = await referencedKeys();

  let objects: { key: string; size: number; lastModified: Date | null }[] = [];
  let truncated = false;
  let listingError: string | null = null;
  try {
    const listed = await r2List({
      bucket: R2_BUCKETS.vendorVerification,
      prefix: VERIFICATION_PREFIX,
    });
    objects = listed.objects;
    truncated = listed.truncated;
  } catch (err) {
    listingError = err instanceof Error ? err.message : 'the bucket could not be listed';
  }

  // 🚨 THE STATE THIS PAGE SHIPPED IN, NOW REFUSED. Both reads succeeding and
  // yielding NOTHING, while the bucket holds files, is not "everything here is
  // rubbish" — it is what a reference reader that cannot read looks like. There
  // is no error to trip gate 3 on, so the empty set is the only signal there
  // is. Deleting is switched off until at least one reference is found.
  // ⚖ Yes, this can refuse a genuinely tidy-able bucket. Denial of cleanup is
  // the survivable failure; the other one is not.
  const emptyWhileFilesExist = referenceError === null && keys.size === 0 && objects.length > 0;
  const blockReason = referenceError ?? (emptyWhileFilesExist ? EMPTY_REFERENCE_SET_REASON : null);

  return {
    docs: classifyVerificationDocs(objects, keys).sort((a, b) => a.key.localeCompare(b.key)),
    referencesComplete: blockReason === null,
    referenceError: blockReason,
    listingError,
    truncated,
  };
}
