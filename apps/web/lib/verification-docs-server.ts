import 'server-only';

import { R2_BUCKETS, r2List } from '@/lib/r2';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  VERIFICATION_PREFIX,
  buildVerificationDocsReportFrom,
  collectReferencedKeys,
  readAllPages,
  type VerificationDocsReport,
} from '@/lib/verification-docs';

/**
 * The server half: read what the database still points at, read what is really
 * in the bucket, and hand the pure module both.
 *
 * ── THIS MODULE DECIDES NOTHING, ON PURPOSE ─────────────────────────────────
 * It opens with `import 'server-only'`, which is not installed here, so no
 * `node:test` can load it — anything it decides can only ever be guarded by
 * reading its source as text, and two such guards were proven decorative by an
 * adversarial reviewer: one kept both asserted call sites and threw their
 * results away (`keys.add(key)` 2 → 0, suite green), the other replaced the
 * block-reason expression while leaving both asserted literals in place (gate
 * gone, suite green). BOTH of those decisions now live in `verification-docs.ts`
 * where a test can CALL them. What is left here is fetching, and fetching only.
 * 🔑 The answer to an untestable module is to split the rule out of it, never
 * to match a longer string. Keep it that way — a condition added to this file
 * is a condition nothing can guard.
 *
 * ── FAIL CLOSED, LOUDLY ─────────────────────────────────────────────────────
 * If either reference source cannot be read, or cannot be read TO THE END, this
 * returns `referencesComplete: false` and the page refuses to offer deletion at
 * all. A partial reference set would mark a LIVE government ID as left over —
 * and the button next to that label is irreversible.
 */

export type { VerificationDocsReport };

/** How many rows one reference page asks for. See `readAllPages`. */
const REFERENCE_PAGE_SIZE = 500;

/**
 * Read one reference table to exhaustion.
 *
 * 🔴 **THE `.range()` LOOP IS THE POINT, NOT A TIDY-UP.** Neither of these
 * SELECTs used to carry a `.limit()`, a `.range()` or a count, while PostgREST
 * caps the rows it returns (Supabase's documented default for that setting is
 * 1000). A capped read comes back LARGE, NON-EMPTY and INCOMPLETE with
 * `error: null` — past the error gate and past the empty-set gate — and every
 * document belonging to a row beyond the cap is then offered for permanent
 * deletion.
 *
 * ⚖ `.order()` on the primary key is what makes paging meaningful: without a
 * stable order, two pages can return the same row and miss another.
 */
async function readReferenceTable(
  table: 'vendor_verifications' | 'vendor_verification_applications',
  pkColumn: 'verification_id' | 'application_id',
  columns: string,
): Promise<{ rows: unknown[]; error: string | null; complete: boolean }> {
  const admin = createAdminClient();
  return readAllPages(
    async (from, to) => {
      const { data, error } = await admin
        .from(table)
        .select(columns)
        .order(pkColumn, { ascending: true })
        .range(from, to);
      return {
        rows: (data ?? null) as unknown[] | null,
        error: error ? `${table}: ${error.message}` : null,
      };
    },
    { pageSize: REFERENCE_PAGE_SIZE },
  );
}

/**
 * Every R2 key the database still points at.
 *
 * TWO sources, and both must be read in full:
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
 * ⚖ Every value goes through the SAME pure helper, columns and jsonb alike, so
 * a writer appearing on either source is covered on the day it ships.
 */
async function referencedKeys(): Promise<{
  keys: Set<string>;
  error: string | null;
  complete: boolean;
}> {
  const verifications = await readReferenceTable(
    'vendor_verifications',
    'verification_id',
    'verification_id, dti_certificate_r2_key, bir_2303_r2_key, mayors_permit_r2_key, government_id_r2_key, bank_account_proof_r2_key',
  );
  if (verifications.error) {
    return { keys: new Set(), error: verifications.error, complete: false };
  }

  const applications = await readReferenceTable(
    'vendor_verification_applications',
    'application_id',
    'application_id, doc_uploads',
  );
  if (applications.error) {
    return { keys: new Set(), error: applications.error, complete: false };
  }

  // The whole row goes in for the columns table (the walk finds every `*_r2_key`
  // without naming one, so a sixth column is covered the day it is added), and
  // the jsonb blob goes in for the applications table.
  const keys = collectReferencedKeys([
    ...verifications.rows,
    ...applications.rows.map((row) => (row as { doc_uploads?: unknown }).doc_uploads),
  ]);

  return { keys, error: null, complete: verifications.complete && applications.complete };
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
