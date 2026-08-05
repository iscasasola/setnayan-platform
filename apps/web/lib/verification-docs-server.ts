import 'server-only';

import { R2_BUCKETS, r2List } from '@/lib/r2';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  VERIFICATION_PREFIX,
  classifyVerificationDocs,
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
 *   · `vendor_verification_applications.doc_uploads` — jsonb slot → key, for an
 *     intake still in progress. Skipping this one would mark a vendor's
 *     half-finished upload as rubbish while they are still filling the form.
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
    for (const value of Object.values(row as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim().length > 0) keys.add(value.trim());
    }
  }

  const { data: applications, error: aErr } = await admin
    .from('vendor_verification_applications')
    .select('doc_uploads');
  if (aErr) {
    return { keys, error: `vendor_verification_applications: ${aErr.message}` };
  }
  for (const row of applications ?? []) {
    const uploads = (row as { doc_uploads?: unknown }).doc_uploads;
    if (uploads && typeof uploads === 'object') {
      for (const value of Object.values(uploads as Record<string, unknown>)) {
        if (typeof value === 'string' && value.trim().length > 0) keys.add(value.trim());
      }
    }
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

  return {
    docs: classifyVerificationDocs(objects, keys).sort((a, b) => a.key.localeCompare(b.key)),
    referencesComplete: referenceError === null,
    referenceError,
    listingError,
    truncated,
  };
}
