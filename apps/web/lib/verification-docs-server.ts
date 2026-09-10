import 'server-only';

import { R2_BUCKETS, r2List } from '@/lib/r2';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  VERIFICATION_PREFIX,
  VERIFICATION_REFERENCE_SOURCES,
  buildVerificationDocsReportFrom,
  foldReferenceReads,
  readReferenceSource,
  type ReferenceQueryClient,
  type ReferenceRead,
  type VerificationDocsReport,
} from '@/lib/verification-docs';

/**
 * The server half: read what the database still points at, read what is really
 * in the bucket, and hand the pure module both.
 *
 * ── THIS MODULE DECIDES NOTHING, ON PURPOSE ─────────────────────────────────
 * It opens with `import 'server-only'`, which is not installed here, so no
 * `node:test` can load it — anything it decides can only ever be guarded by
 * reading its source as text, and FOUR such guards have now been proven
 * decorative by reviewers. Two in round 2: one kept both asserted call sites
 * and threw their results away (`keys.add(key)` 2 → 0, suite green), the other
 * replaced the block-reason expression while leaving both asserted literals in
 * place (gate gone, suite green). Two more in round 3, against the paging this
 * module used to build for itself: the range window was shifted by one row
 * (skipping the FIRST row of the table, offering its five documents for
 * deletion) and the `.order()` was DELETED, and the suite stayed GREEN at 55/55
 * for both — because every test injected a `fetchPage` stub that ignored its
 * arguments, so the real window and the real ordering were exercised by
 * nothing.
 *
 * 🔑 THE ANSWER TO AN UNTESTABLE MODULE IS TO SPLIT THE RULE OUT OF IT, NEVER
 * TO MATCH A LONGER STRING. The table names, the SELECT columns, the ordering,
 * the range arithmetic, the completeness proof, the fold and every gate now
 * live in `verification-docs.ts`, where a test CALLS them and a fake client
 * records what the query asked for. What is left here is a client, a bucket
 * listing, and two function calls. Keep it that way — a condition added to this
 * file is a condition nothing can guard.
 *
 * 🛑 **AND ROUND 3 THEN PUT THREE CONDITIONS BACK INTO THIS FILE, DIRECTLY
 * UNDER THAT SENTENCE.** The error arm, `complete = complete && read.complete`
 * and `complete: complete && !truncated` all sat in `referencedKeys()`, and a
 * reviewer sabotaged each one in turn with the suite GREEN at 72/72 — needle
 * 1 → 0 and the replacement 0 → 1 on every one of the three. They are
 * `foldReferenceReads` in the pure module now, called from here. **The
 * docblock was right and was ignored by the very change that wrote it: the
 * only durable form of this rule is that there is nothing here to guard.**
 *
 * ── FAIL CLOSED, LOUDLY ─────────────────────────────────────────────────────
 * If either reference source cannot be read, or cannot be read TO THE END, or
 * the walk over a stored value hit its depth ceiling, this returns
 * `referencesComplete: false` and the page refuses to offer deletion at all. A
 * partial reference set would mark a LIVE government ID as left over — and the
 * button next to that label is irreversible.
 */

export type { VerificationDocsReport };

/** How many rows one reference page asks for. See `readAllPages`. */
const REFERENCE_PAGE_SIZE = 500;

/**
 * Every R2 key the database still points at.
 *
 * TWO sources, and both must be read in full:
 *   · `vendor_verifications` — five `*_r2_key` columns.
 *   · `vendor_verification_applications.doc_uploads` — jsonb slot → VALUE, for
 *     an intake still in progress. Skipping this one would mark a vendor's
 *     half-finished upload as rubbish while they are still filling the form.
 * Both are described as DATA in `VERIFICATION_REFERENCE_SOURCES`, projecting
 * ONLY the columns that can carry a reference — see that constant for why the
 * primary key must never join them.
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
 * ⚖ Every value goes through the SAME pure helper, columns and jsonb alike, so
 * a writer appearing on either source is covered on the day it ships.
 */
async function referencedKeys(): Promise<{
  keys: Set<string>;
  error: string | null;
  complete: boolean;
}> {
  const client = createAdminClient() as unknown as ReferenceQueryClient;

  // Read every source, then hand the reads to the pure fold. There is no
  // condition here on purpose: the error arm, the completeness conjunction and
  // the depth-truncation arm all used to live on these lines, all three were
  // sabotaged GREEN at 72/72, and they are now `foldReferenceReads`, which a
  // test CALLS. See that function for the three measurements.
  const reads: ReferenceRead[] = [];
  for (const source of VERIFICATION_REFERENCE_SOURCES) {
    reads.push(await readReferenceSource(client, source, { pageSize: REFERENCE_PAGE_SIZE }));
  }

  return foldReferenceReads(reads);
}

/** The set of referenced keys, for a delete action to re-derive at press time. */
export async function referencedVerificationKeys(): Promise<{
  keys: Set<string>;
  error: string | null;
  complete: boolean;
}> {
  return referencedKeys();
}

export async function buildVerificationDocsReport(): Promise<VerificationDocsReport> {
  const { keys, error: referenceError, complete } = await referencedKeys();

  let objects: { key: string; size: number; lastModified: Date | null }[] = [];
  let listingTruncated = false;
  let listingError: string | null = null;
  try {
    const listed = await r2List({
      bucket: R2_BUCKETS.vendorVerification,
      prefix: VERIFICATION_PREFIX,
    });
    objects = listed.objects;
    listingTruncated = listed.truncated;
  } catch (err) {
    listingError = err instanceof Error ? err.message : 'the bucket could not be listed';
  }

  return buildVerificationDocsReportFrom({
    keys,
    referenceError,
    referencesComplete: complete,
    objects,
    listingError,
    listingTruncated,
  });
}
