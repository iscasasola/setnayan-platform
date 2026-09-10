import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimPeriodicJob, WEEKLY_GAP_MS } from '@/lib/periodic-jobs';
import { executeCleanupDelete } from '@/lib/cleanup-delete';
import {
  IDENTITY_VERIFICATION_COLUMNS,
  VENDOR_IDENTITY_RETENTION_DAYS,
  applyApplicationScrub,
  applyVerificationScrub,
  hasIdentityUploads,
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
 *
 * ─── BOTH SWEEPS DELETE ONLY THE VENDOR'S OWN OBJECTS (2026-09-10) ─────────
 * 🔒 Every ref goes through `planApplicationScrub` / `planVerificationScrub`
 * (-core.ts), which admit an object only when it sits under THE ROW'S OWN
 * vendor's folder: `vendors/<id>/verification/` in the private bucket, or
 * `vendors/<id>/` in media for an application slot (a legitimate intake shape).
 * Anything else is refused, counted into `assetsRefused`, and its pointer KEPT.
 *
 * ⚠ CORRECTED. This block used to say `sweepApplications` was "DELIBERATELY NOT
 * constrained" because its refs were "pinned to the vendor's own folder at WRITE
 * time by SEC-1". The pin lived only in the server action; the database let a
 * vendor PATCH its own draft's `doc_uploads` with any string through PostgREST,
 * and the next approve OR reject armed this job to delete another shop's
 * seven-year permit. Both paths are pinned now, by tenant, and the write side
 * is closed by a restrictive policy in migration
 * 20271219262486_every_cleanup_delete_is_pinned. The only deletes go through
 * `executeCleanupDelete` (lib/cleanup-delete.ts), which refuses anything the
 * planner did not prove.
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
  /**
   * Refs REFUSED — on either table — for not sitting under the row's own
   * vendor folder. The object is left alone AND so is the pointer. Non-zero
   * means somebody wrote a ref its writer never files there; look at the row.
   */
  assetsRefused: number;
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
    assetsRefused: 0,
    failed: 0,
  };
}

type AppRow = {
  application_id: string;
  vendor_profile_id: string | null;
  decided_at: string | null;
  doc_uploads: unknown;
};

type VerificationRow = {
  verification_id: string;
  vendor_profile_id: string | null;
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
    .select('application_id, vendor_profile_id, decided_at, doc_uploads')
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

    // 🔒 Only the vendor's OWN objects, per slot all-or-nothing — the whole
    // per-row behaviour is applyApplicationScrub (-core.ts, unit-tested with
    // fake deps). This file supplies the admin client and the executor only.
    const outcome = await applyApplicationScrub(row, {
      deleteObject: executeCleanupDelete,
      onDeleteError: (err) =>
        console.warn('[vendor-identity-retention] object delete failed (continuing)', {
          applicationId: row.application_id,
          error: err instanceof Error ? err.message : String(err),
        }),
      writeDocUploads: async (next) => {
        const { error: upErr } = await admin
          .from('vendor_verification_applications')
          .update({ doc_uploads: next })
          .eq('application_id', row.application_id);
        if (upErr) {
          console.warn('[vendor-identity-retention] scrub failed', {
            applicationId: row.application_id,
            error: upErr.message,
          });
        }
        return { ok: !upErr };
      },
    });
    summary.assetsDeleted += outcome.deleted;
    summary.assetsFailed += outcome.deleteFailed;
    if (outcome.refused > 0) {
      summary.assetsRefused += outcome.refused;
      console.warn(
        '[vendor-identity-retention] REFUSED application ref(s) outside the vendor’s own folder — objects AND pointers kept',
        { applicationId: row.application_id, slots: outcome.refusedSlots },
      );
    }
    if (outcome.writeFailed) {
      summary.failed += 1;
      continue;
    }
    if (!outcome.scrubbed) continue;
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
    .select('verification_id, vendor_profile_id, approved_at, rejected_at, government_id_r2_key, bank_account_proof_r2_key')
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

    // ── DEFENCE IN DEPTH behind migration 20271218766967 ────────────────────
    // These columns had no writer and, until that migration, a forgeable INSERT
    // lane — so the string here could name ANY object in ANY of the five
    // buckets. applyVerificationScrub (-core.ts) admits only the private
    // verification bucket under the row's own vendor folder, and never nulls a
    // column it refused (nulling it would leave the object retained past its
    // declared period with nothing left pointing at it — the RA 10173 failure
    // this job exists to fix).
    const outcome = await applyVerificationScrub(row, {
      deleteObject: executeCleanupDelete,
      onDeleteError: (err) =>
        console.warn('[vendor-identity-retention] object delete failed (continuing)', {
          verificationId: row.verification_id,
          error: err instanceof Error ? err.message : String(err),
        }),
      clearColumns: async (patch) => {
        const { error: upErr } = await admin
          .from('vendor_verifications')
          .update(patch)
          .eq('verification_id', row.verification_id);
        if (upErr) {
          console.warn('[vendor-identity-retention] key clear failed', {
            verificationId: row.verification_id,
            error: upErr.message,
          });
        }
        return { ok: !upErr };
      },
    });
    summary.assetsDeleted += outcome.deleted;
    summary.assetsFailed += outcome.deleteFailed;
    // 🔑 REFUSED, AND SAID SO. A refusal nobody can see is indistinguishable
    // from a delete that happened.
    for (const col of outcome.refusedColumns) {
      summary.assetsRefused += 1;
      console.warn(
        '[vendor-identity-retention] REFUSED an out-of-scope ref — object AND pointer both kept',
        { verificationId: row.verification_id, column: col },
      );
    }
    if (outcome.writeFailed) {
      summary.failed += 1;
      continue;
    }
    if (!outcome.scrubbed) continue;
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
        `${summary.assetsFailed} object(s) failed, ` +
        `${summary.assetsRefused} object(s) refused, ${summary.failed} row(s) failed.`,
    );
  }

  // Its own line, at error level, because it is not routine attrition: every
  // legitimate writer files under the vendor's own folder, so a non-zero count
  // means a ref got in that should never have been written.
  if (summary.assetsRefused > 0) {
    console.error(
      `[vendor-identity-retention] ${summary.assetsRefused} ref(s) did not sit under the row's own ` +
        'vendor folder and were REFUSED. Object and pointer both kept; inspect the rows.',
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
