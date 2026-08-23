import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { claimPeriodicJob, WEEKLY_GAP_MS } from '@/lib/periodic-jobs';
import { parseStoredAsset } from '@/lib/uploads';
import { r2Delete } from '@/lib/r2';
import { deletePublicAsset } from '@/lib/storage';
import {
  FACE_DATA_POST_EVENT_GRACE_DAYS,
  faceDataIsPastRetention,
} from '@/lib/face-data-retention-core';

/**
 * face-data-retention.ts — GUEST FACE DATA IS DELETED THREE MONTHS AFTER THE
 * EVENT ENDS. (RA 10173 · storage limitation.)
 *
 * ─── WHAT WAS WRONG ───────────────────────────────────────────────────────
 * The NPC pack's face row states the period as adopted policy and then admits,
 * in the same row: "ADOPTED 2026-08-17, ENFORCEMENT NOT YET BUILT. No sweep
 * implements this period yet." A retention promise nothing runs is the promise
 * a filing is judged on. This is that sweep.
 *
 * ⚠ THE TWO PATHS THAT ALREADY WORK ARE NOT THIS. A guest can delete their face
 * data at any time ("Delete my face data", Photo Consent OFF → `withdrawFaceConsent`),
 * and account erasure reaches it (`purgeUserGuestBiometrics`). Both are
 * subject-initiated. Neither is a clock, and the pack promises a clock.
 *
 * ─── WHAT IT DELETES, AND WHY EXACTLY THIS MUCH ───────────────────────────
 * The pack scopes the face row across BOTH stores — "Singapore (Supabase — the
 * vectors) + APAC (R2 — the source selfie images)" — so all three of these go
 * together or the promise is only half true:
 *
 *   1. the face vector + model      (the biometric template itself)
 *   2. the enrollment row           (nothing references it — see below)
 *   3. the source selfie in R2      (the image the template was computed from)
 *
 * 🔑 AND THE SELFIE IS ALSO THE GUEST'S AVATAR. `app/[slug]/actions.ts` writes
 * ONE ref to TWO columns: `photo_url` on `guests` and `asset_url` on the
 * enrollment. So deleting the object without clearing `guests.photo_url` leaves
 * a broken picture on the guest's own invitation page, and clearing it without
 * deleting the object retains the biometric source. `purgeUserGuestBiometrics`
 * already names this exact trap. Both move together, in that order — object
 * first, so a deleted row can never orphan a file.
 *
 * ⛔ WHAT IT DOES NOT TOUCH, DELIBERATELY:
 * • `user_face_profiles` — ACCOUNT-scoped, one row per user, with
 *   `source_event_ids` as provenance only. It is the person's own face on their
 *   own account, and it dies with the account (`ON DELETE CASCADE` from
 *   `users`). An event clock has no authority over it; sweeping it here would
 *   delete a living account's face profile because some unrelated wedding
 *   turned 92 days old.
 * • PHOTOS AND TAGS. Verified in the live schema: NOTHING carries a foreign key
 *   to `guest_face_enrollments` — zero references — so deleting an enrollment
 *   cascades nowhere. A tag holds the guest link itself. Guests keep every
 *   photo already delivered, which is the whole point: the face data is what
 *   expires, not the memories it helped find.
 * • An avatar the guest did NOT take as an RSVP selfie (`couple_upload`,
 *   `oauth_google`) — a different object, matched out by exact ref equality.
 *
 * ─── THE POSTURE ──────────────────────────────────────────────────────────
 * 🔒 FAIL CLOSED EVERYWHERE. An unreadable event date, a failed read, an
 * unparseable ref — every one of them SKIPS the row rather than deleting it.
 * There is no inverse to this job: R2 is not versioned and a dropped vector
 * cannot be recomputed from a deleted image. A sweep that skips is recoverable
 * on the next run, a week later. A sweep that deletes on bad information is
 * not. Every branch below is written that way on purpose.
 *
 * CRON-FREE ([[project_setnayan_cron_free]]): a WEEKLY `claimPeriodicJob`
 * compare-and-swap fired from admin-layout `after()` traffic, exactly like
 * `runRetentionSweep` and `runVendorDossierRetention`. Best-effort, never
 * throws.
 */

/** The kill switch. Default ON — a retention job nobody switched on is the gap. */
function sweepEnabled(): boolean {
  return process.env.FACE_DATA_RETENTION_ENABLED !== 'false';
}

export type FaceRetentionSummary = {
  dryRun: boolean;
  graceDays: number;
  /** Enrollment rows examined. */
  scanned: number;
  /** Rows past the period — what a dry run reports without touching anything. */
  eligible: number;
  /** Enrollment rows actually deleted. */
  deleted: number;
  /** Source selfies removed from R2. */
  assetsDeleted: number;
  /** Guest avatars cleared because they pointed at a deleted selfie. */
  avatarsCleared: number;
  /** Rows skipped because the event had no readable date (never deleted). */
  skippedNoClock: number;
  /** R2 objects left behind after a failed delete (reaped by lifecycle rules). */
  assetsFailed: number;
  /** A read or delete that errored — the row survives to the next run. */
  failed: number;
};

function emptySummary(dryRun: boolean): FaceRetentionSummary {
  return {
    dryRun,
    graceDays: FACE_DATA_POST_EVENT_GRACE_DAYS,
    scanned: 0,
    eligible: 0,
    deleted: 0,
    assetsDeleted: 0,
    avatarsCleared: 0,
    skippedNoClock: 0,
    assetsFailed: 0,
    failed: 0,
  };
}

type EnrollmentRow = {
  id: number;
  event_id: string;
  guest_id: string;
  asset_url: string | null;
  events: { event_date: string | null; event_end_date: string | null } | null;
};

/**
 * Face data whose clock has run out, with the event dates that decide it.
 *
 * Bounded by the number of enrollment rows that EXIST, not by the number of
 * events — the join is the filter. `!inner` so a row whose event has vanished
 * is simply absent rather than arriving with a null clock we would then have to
 * decide about.
 *
 * ⚠ AN EMPTY LIST FROM A FAILED READ LOOKS EXACTLY LIKE "NOTHING TO DO". Here
 * that is harmless (we delete nothing) — but the error is returned rather than
 * swallowed so the summary can report `failed` instead of a false clean run.
 */
async function readCandidates(
  admin: ReturnType<typeof createAdminClient>,
  limit: number,
): Promise<{ rows: EnrollmentRow[]; error: string | null }> {
  try {
    const { data, error } = await admin
      .from('guest_face_enrollments')
      .select('id, event_id, guest_id, asset_url, events!inner(event_date, event_end_date)')
      .order('id', { ascending: true })
      .limit(limit);
    if (error) return { rows: [], error: error.message };
    return { rows: (data ?? []) as unknown as EnrollmentRow[], error: null };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Delete one stored asset ref, whatever shape it is in. Mirrors
 * `withdrawFaceConsent`: `r2://bucket/key` goes to r2Delete, a legacy plain URL
 * to deletePublicAsset, and anything unparseable is left alone rather than
 * guessed at.
 */
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

/**
 * The work body. Callable directly (and with `dryRun`) so the behaviour can be
 * proved against a seeded fixture before it is ever pointed at real data.
 */
export async function runFaceDataRetention(
  opts: { limit?: number; dryRun?: boolean } = {},
): Promise<FaceRetentionSummary> {
  // Switching the sweep OFF makes it a DRY RUN, not a no-op: it still reports
  // what it would have deleted. A disabled job that reports nothing is
  // indistinguishable from a broken one.
  const dryRun = opts.dryRun ?? !sweepEnabled();
  const limit = Math.max(1, Math.min(opts.limit ?? 500, 2000));
  const summary = emptySummary(dryRun);

  const admin = createAdminClient();
  const { rows, error } = await readCandidates(admin, limit);
  if (error) {
    console.error('[face-data-retention] candidate read failed:', error);
    summary.failed += 1;
    return summary;
  }

  summary.scanned = rows.length;
  const nowMs = Date.now();

  // Which refs are still spoken for by a row we are NOT deleting. An object is
  // only removed once nothing else points at it — a re-RSVP supersedes an
  // enrollment without necessarily minting a new image, and a shared object
  // deleted early would break a live avatar.
  const eligible: EnrollmentRow[] = [];
  const survivingRefs = new Set<string>();
  for (const row of rows) {
    const dates = row.events;
    if (!dates) {
      summary.skippedNoClock += 1;
      if (row.asset_url) survivingRefs.add(row.asset_url);
      continue;
    }
    const past = faceDataIsPastRetention(dates.event_date, dates.event_end_date, nowMs);
    if (!past) {
      if (row.asset_url) survivingRefs.add(row.asset_url);
      continue;
    }
    // An event with no readable date is reported as such, never swept.
    if (!dates.event_date && !dates.event_end_date) {
      summary.skippedNoClock += 1;
      if (row.asset_url) survivingRefs.add(row.asset_url);
      continue;
    }
    eligible.push(row);
  }
  summary.eligible = eligible.length;
  if (eligible.length === 0) return summary;

  if (dryRun) {
    console.info(
      `[face-data-retention] DRY RUN — ${eligible.length} enrollment(s) past ${FACE_DATA_POST_EVENT_GRACE_DAYS} days; nothing deleted.`,
    );
    return summary;
  }

  for (const row of eligible) {
    const ref = row.asset_url;

    // 1. The source selfie, FIRST — a deleted row must never orphan its file.
    if (ref && !survivingRefs.has(ref)) {
      try {
        if (await deleteStoredAsset(ref)) summary.assetsDeleted += 1;
      } catch (err) {
        // Non-fatal by contract: an orphan is reaped by the R2 lifecycle rule,
        // and the vector below still goes. Losing the vector matters more.
        summary.assetsFailed += 1;
        console.warn('[face-data-retention] selfie delete failed (continuing)', {
          eventId: row.event_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }

      // 2. The avatar pointing at it — cleared ONLY when it is that same object.
      //
      // ⚠ `.select()` is not decoration: without it a matched-nothing update and
      // a matched-one update are the same value, and this counter feeds a log
      // that is a compliance artefact. Counting attempts instead of rows would
      // report avatars cleared that never existed — a guest whose photo came
      // from a couple upload or Google has a different object here and must not
      // be counted, or touched.
      const { data: clearedRows, error: avatarErr } = await admin
        .from('guests')
        .update({ photo_url: null, photo_source: null })
        .eq('guest_id', row.guest_id)
        .eq('photo_url', ref)
        .select('guest_id');
      if (avatarErr) {
        summary.failed += 1;
        console.warn('[face-data-retention] avatar clear failed', {
          eventId: row.event_id,
          error: avatarErr.message,
        });
      } else {
        summary.avatarsCleared += Array.isArray(clearedRows) ? clearedRows.length : 0;
      }
    }

    // 3. The biometric itself.
    const { error: delErr } = await admin
      .from('guest_face_enrollments')
      .delete()
      .eq('id', row.id);
    if (delErr) {
      summary.failed += 1;
      console.warn('[face-data-retention] enrollment delete failed', {
        eventId: row.event_id,
        error: delErr.message,
      });
      continue;
    }
    summary.deleted += 1;
  }

  // Logged, because "what did it delete" is the question a filing asks. Event
  // ids only — never a guest id, a ref or anything resembling the data itself.
  console.info(
    `[face-data-retention] deleted ${summary.deleted} enrollment(s), ` +
      `${summary.assetsDeleted} selfie(s), cleared ${summary.avatarsCleared} avatar(s); ` +
      `${summary.skippedNoClock} skipped (no clock), ${summary.failed} failed.`,
  );
  return summary;
}

/**
 * CRON-FREE weekly face-data retention sweep — fired from admin-layout after().
 * A WEEKLY DB claim guarantees it runs ~once/week across the fleet and survives
 * deploys. Best-effort, never throws.
 */
export async function maybeRunFaceDataRetention(): Promise<void> {
  try {
    if (await claimPeriodicJob('face-data-retention', WEEKLY_GAP_MS)) {
      await runFaceDataRetention();
    }
  } catch {
    /* best-effort — a missed week retries on the next eligible admin request */
  }
}
