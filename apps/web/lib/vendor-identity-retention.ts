import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimPeriodicJob, WEEKLY_GAP_MS } from '@/lib/periodic-jobs';
import { parseStoredAsset } from '@/lib/uploads';
import { r2Delete } from '@/lib/r2';
import { deletePublicAsset } from '@/lib/storage';
import { collectStoredAssetRefs } from '@/lib/erasure/coverage';
import {
  IDENTITY_VERIFICATION_COLUMNS,
  VENDOR_IDENTITY_RETENTION_DAYS,
  hasIdentityUploads,
  identityUploadsSubset,
  scrubIdentityUploads,
  vendorIdentityIsPastRetention,
} from '@/lib/vendor-identity-retention-core';

/**
 * vendor-identity-retention.ts — A SUPPLIER'S RAW IDENTITY UPLOADS ARE DELETED
 * 90 DAYS AFTER WE APPROVE OR REJECT THEM. (RA 10173 · storage limitation.)
 *
 * ─── WHAT WAS WRONG ───────────────────────────────────────────────────────
 * The NPC pack states the period and admits in the same row: "ADOPTED
 * 2026-08-17, ENFORCEMENT NOT YET BUILT." Nothing deletes these files on a
 * clock. `/admin/verification-docs` can delete one at a time, but ONLY objects
 * that are provably UNREFERENCED — an orphan cleaner, and by construction the
 * opposite of this job, which retires files that are still referenced and then
 * clears the reference.
 *
 * `vendor-dossier-retention` is the nearest shipped relative and does not cover
 * this: that is Deep Search web-research data, regenerable and transient. These
 * are somebody's identity documents.
 *
 * ─── WHAT IT DELETES ──────────────────────────────────────────────────────
 * The pack's "raw uploads" list only — government ID, selfie/liveness, bank
 * micro-deposit, portfolio — across BOTH stores that hold them:
 *   • `vendor_verification_applications.doc_uploads` (the per-intake JSONB)
 *   • `vendor_verifications` identity key columns (the older workflow record)
 * and the R2 objects behind them, in the private vendor-verification bucket.
 *
 * ⛔ AND NOTHING ELSE. DTI / BIR 2303 / Mayor's Permit are retained SEVEN YEARS
 * and are copied through untouched; so is the decision record, which is the
 * point of keeping the row at all. The slot list and that boundary live in
 * `-core.ts` and are asserted against each other in its tests, because a slot
 * drifting from one list to the other would delete a document we told the
 * regulator we keep.
 *
 * ─── THE POSTURE ──────────────────────────────────────────────────────────
 * 🔒 FAIL CLOSED, AND ORDER MATTERS. R2 objects go FIRST, then the pointer is
 * cleared — clearing the pointer first leaves the file addressable with nothing
 * left to say whose it was, which is the ordering `purgeVendorVerificationDocuments`
 * already settled. Any unreadable clock, failed read or unparseable ref SKIPS the
 * row. This is irreversible: the bucket is not versioned.
 *
 * CRON-FREE ([[project_setnayan_cron_free]]): a WEEKLY `claimPeriodicJob` claim
 * fired from admin-layout `after()`. Best-effort, never throws.
 */

/** Kill switch. Default ON — a retention job nobody switched on is the gap. */
function sweepEnabled(): boolean {
  return process.env.VENDOR_IDENTITY_RETENTION_ENABLED !== 'false';
}

export type VendorIdentityRetentionSummary = {
  dryRun: boolean;
  retentionDays: number;
  /** Decided rows examined across both tables. */
  scanned: number;
  /** Rows past 90 days that still held something in scope. */
  eligible: number;
  /** Rows whose identity slots/columns were cleared. */
  scrubbed: number;
  /** R2 objects deleted. */
  assetsDeleted: number;
  /** Objects left behind after a failed delete (reaped by lifecycle rules). */
  assetsFailed: number;
  /** A read or write that errored — the row survives to the next run. */
  failed: number;
};

function emptySummary(dryRun: boolean): VendorIdentityRetentionSummary {
  return {
    dryRun,
    retentionDays: VENDOR_IDENTITY_RETENTION_DAYS,
    scanned: 0,
    eligible: 0,
    scrubbed: 0,
    assetsDeleted: 0,
    assetsFailed: 0,
    failed: 0,
  };
}

/** Delete one stored ref, whatever shape it is in. Unparseable → left alone. */
async function deleteStoredAsset(ref: string): Promise<boolean> {
  const parsed = parseStoredAsset(ref);
  if (parsed?.kind === 'r2') {
    await r2Delete({ bucket: parsed.bucket, key: parsed.key });
    return true;
  }
  if (parsed?.kind === 'legacy_url') {
    await deletePublicAsset({ publicUrl: parsed.url });
    return true;
  }
  return false;
}

type AppRow = {
  application_id: string;
  decided_at: string | null;
  doc_uploads: unknown;
};

type VerificationRow = {
  verification_id: string;
  approved_at: string | null;
  rejected_at: string | null;
  government_id_r2_key: string | null;
  bank_account_proof_r2_key: string | null;
};

/**
 * The per-intake applications. `decided_at` is the clock: the pack starts it at
 * the approve/reject decision, so a draft or withdrawn row has not started one.
 */
async function sweepApplications(
  admin: ReturnType<typeof createAdminClient>,
  summary: VendorIdentityRetentionSummary,
  nowMs: number,
  dryRun: boolean,
  limit: number,
): Promise<void> {
  const { data, error } = await admin
    .from('vendor_verification_applications')
    .select('application_id, decided_at, doc_uploads')
    .not('decided_at', 'is', null)
    .order('decided_at', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('[vendor-identity-retention] application read failed:', error.message);
    summary.failed += 1;
    return;
  }

  const rows = (data ?? []) as unknown as AppRow[];
  summary.scanned += rows.length;

  for (const row of rows) {
    if (!vendorIdentityIsPastRetention(row.decided_at, nowMs)) continue;
    if (!hasIdentityUploads(row.doc_uploads)) continue;
    summary.eligible += 1;
    if (dryRun) continue;

    // The objects first — a cleared pointer must never orphan a file.
    const refs = collectStoredAssetRefs(identityUploadsSubset(row.doc_uploads));
    for (const ref of refs) {
      try {
        if (await deleteStoredAsset(ref)) summary.assetsDeleted += 1;
      } catch (err) {
        summary.assetsFailed += 1;
        console.warn('[vendor-identity-retention] object delete failed (continuing)', {
          applicationId: row.application_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const { error: upErr } = await admin
      .from('vendor_verification_applications')
      .update({ doc_uploads: scrubIdentityUploads(row.doc_uploads) })
      .eq('application_id', row.application_id);
    if (upErr) {
      summary.failed += 1;
      console.warn('[vendor-identity-retention] scrub failed', {
        applicationId: row.application_id,
        error: upErr.message,
      });
      continue;
    }
    summary.scrubbed += 1;
  }
}

/**
 * The older workflow record. Same clock, taken from whichever of approve/reject
 * actually happened; only the two identity key columns are cleared, never the
 * three permit columns.
 */
async function sweepVerifications(
  admin: ReturnType<typeof createAdminClient>,
  summary: VendorIdentityRetentionSummary,
  nowMs: number,
  dryRun: boolean,
  limit: number,
): Promise<void> {
  const { data, error } = await admin
    .from('vendor_verifications')
    .select('verification_id, approved_at, rejected_at, government_id_r2_key, bank_account_proof_r2_key')
    .or('approved_at.not.is.null,rejected_at.not.is.null')
    .limit(limit);
  if (error) {
    console.error('[vendor-identity-retention] verification read failed:', error.message);
    summary.failed += 1;
    return;
  }

  const rows = (data ?? []) as unknown as VerificationRow[];
  summary.scanned += rows.length;

  for (const row of rows) {
    // Whichever decision was actually taken. A row carrying both (it should not)
    // takes the LATER one — the clock can only ever be pushed outwards.
    const decidedAt =
      row.approved_at && row.rejected_at
        ? (Date.parse(row.approved_at) > Date.parse(row.rejected_at)
            ? row.approved_at
            : row.rejected_at)
        : (row.approved_at ?? row.rejected_at);
    if (!vendorIdentityIsPastRetention(decidedAt, nowMs)) continue;

    const present = IDENTITY_VERIFICATION_COLUMNS.filter(
      (c) => typeof row[c] === 'string' && (row[c] as string).length > 0,
    );
    if (present.length === 0) continue;
    summary.eligible += 1;
    if (dryRun) continue;

    for (const col of present) {
      try {
        if (await deleteStoredAsset(row[col] as string)) summary.assetsDeleted += 1;
      } catch (err) {
        summary.assetsFailed += 1;
        console.warn('[vendor-identity-retention] object delete failed (continuing)', {
          verificationId: row.verification_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const patch: Record<string, null> = {};
    for (const col of present) patch[col] = null;
    const { error: upErr } = await admin
      .from('vendor_verifications')
      .update(patch)
      .eq('verification_id', row.verification_id);
    if (upErr) {
      summary.failed += 1;
      console.warn('[vendor-identity-retention] key clear failed', {
        verificationId: row.verification_id,
        error: upErr.message,
      });
      continue;
    }
    summary.scrubbed += 1;
  }
}

/**
 * The work body. Callable with `dryRun` so the behaviour can be shown against a
 * seeded fixture before it is ever pointed at real documents.
 */
export async function runVendorIdentityRetention(
  opts: { limit?: number; dryRun?: boolean } = {},
): Promise<VendorIdentityRetentionSummary> {
  // Switching it off makes it a DRY RUN, not a no-op — a disabled job that
  // reports nothing is indistinguishable from a broken one.
  const dryRun = opts.dryRun ?? !sweepEnabled();
  const limit = Math.max(1, Math.min(opts.limit ?? 500, 2000));
  const summary = emptySummary(dryRun);
  const admin = createAdminClient();
  const nowMs = Date.now();

  await sweepApplications(admin, summary, nowMs, dryRun, limit);
  await sweepVerifications(admin, summary, nowMs, dryRun, limit);

  if (summary.eligible > 0) {
    console.info(
      `[vendor-identity-retention] ${dryRun ? 'DRY RUN — would scrub' : 'scrubbed'} ` +
        `${dryRun ? summary.eligible : summary.scrubbed} row(s), ` +
        `${summary.assetsDeleted} object(s) deleted, ` +
        `${summary.assetsFailed} object(s) failed, ${summary.failed} row(s) failed.`,
    );
  }
  return summary;
}

/**
 * CRON-FREE weekly identity-document retention sweep — fired from admin-layout
 * after(). A WEEKLY DB claim guarantees ~once/week across the fleet and survives
 * deploys. Best-effort, never throws.
 */
export async function maybeRunVendorIdentityRetention(): Promise<void> {
  try {
    if (await claimPeriodicJob('vendor-identity-retention', WEEKLY_GAP_MS)) {
      await runVendorIdentityRetention();
    }
  } catch {
    /* best-effort — a missed week retries on the next eligible admin request */
  }
}
