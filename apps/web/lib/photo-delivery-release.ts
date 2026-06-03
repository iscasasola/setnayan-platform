import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  getDriveOAuthConfig,
  refreshDriveAccessToken,
} from '@/lib/papic-drive';
import { readR2Object, uploadFileToDrive } from '@/lib/drive-upload';
import { emitNotification } from '@/lib/notification-emit';

// 0009 Photo Delivery — release + tick business logic.
//
// Two entry points:
//
//   enqueueRelease({ eventId, userId })
//     - validates events.photo_delivery_status ∈ {'connected','failed'}
//     - lists undelivered papic_photos for the event (hidden_at IS NULL)
//     - creates a photo_delivery_jobs row
//     - upserts photo_delivery_artifacts (idempotent; re-releases reuse rows)
//     - flips events.photo_delivery_status='releasing' OR 'complete' if 0 files
//
//   processBatchForEvent({ eventId, batchSize })
//     - picks the newest open job for the event
//     - refreshes the Drive access_token if near expiry
//     - uploads up to batchSize artifacts via Drive's multipart endpoint
//     - per-file: success → set drive_file_id + uploaded_at; failure →
//       attempt_count++, last_error_text, last_error_at
//     - rolls up counters onto photo_delivery_jobs + progress_pct on events
//     - flips events.photo_delivery_status='complete' when no pending
//       artifacts remain, or 'failed' if every remaining artifact is at the
//       5-retry cap

const MAX_ATTEMPTS = 5;
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refresh within 5 min of expiry

type EnqueueResult =
  | { ok: true; jobId: string; totalFiles: number; alreadyComplete: boolean }
  | { ok: false; reason: string };

export async function enqueueRelease(input: {
  eventId: string;
  userId: string;
}): Promise<EnqueueResult> {
  const admin = createAdminClient();

  // 1. Verify event is releasable.
  const { data: ev } = await admin
    .from('events')
    .select('event_id, photo_delivery_status, photo_delivery_folder_id')
    .eq('event_id', input.eventId)
    .maybeSingle();
  if (!ev) return { ok: false, reason: 'event_not_found' };
  if (!ev.photo_delivery_folder_id) {
    return { ok: false, reason: 'drive_not_connected' };
  }
  const status = ev.photo_delivery_status as string;
  if (!['connected', 'failed', 'complete'].includes(status)) {
    return { ok: false, reason: `not_releasable_in_status:${status}` };
  }

  // 2. List deliverable photos.
  const { data: allPhotos, error: photosErr } = await admin
    .from('papic_photos')
    .select('photo_id, r2_object_key, size_bytes')
    .eq('event_id', input.eventId)
    .is('hidden_at', null);
  if (photosErr) return { ok: false, reason: `papic_photos_query:${photosErr.message.slice(0, 64)}` };

  // Phase 2 dedup: skip photos the Drive-copy auto-sync feeder already copied
  // (both write to the same events.photo_delivery_folder_id), so a manual
  // "Release to Drive" never produces a duplicate file. Match on r2_object_key.
  const { data: copiedRows } = await admin
    .from('drive_copy_artifacts')
    .select('r2_object_key')
    .eq('event_id', input.eventId)
    .not('drive_file_id', 'is', null);
  const copiedKeys = new Set((copiedRows ?? []).map((r) => r.r2_object_key as string));
  const photos = (allPhotos ?? []).filter(
    (p) => !copiedKeys.has(p.r2_object_key as string),
  );

  const totalFiles = photos.length;
  const totalBytes = (photos ?? []).reduce(
    (acc, p) => acc + (Number(p.size_bytes) || 0),
    0,
  );

  // 3. Create the job row.
  const { data: job, error: jobErr } = await admin
    .from('photo_delivery_jobs')
    .insert({
      event_id: input.eventId,
      triggered_by_user_id: input.userId,
      status: totalFiles === 0 ? 'complete' : 'queued',
      total_files: totalFiles,
      total_bytes: totalBytes,
      ...(totalFiles === 0 ? { completed_at: new Date().toISOString() } : {}),
    })
    .select('job_id')
    .single();
  if (jobErr || !job) {
    return { ok: false, reason: `job_insert:${jobErr?.message.slice(0, 64) ?? 'no_id'}` };
  }
  const jobId = job.job_id as string;

  // 4. If nothing to upload, flip event status and exit.
  if (totalFiles === 0) {
    await admin
      .from('events')
      .update({
        photo_delivery_status: 'complete',
        photo_delivery_progress_pct: 100,
        photo_delivery_started_at: new Date().toISOString(),
        photo_delivery_completed_at: new Date().toISOString(),
        photos_released_at: new Date().toISOString(),
      })
      .eq('event_id', input.eventId);
    return { ok: true, jobId, totalFiles: 0, alreadyComplete: true };
  }

  // 5. Upsert artifacts. Re-release reuses any row that already has a
  //    drive_file_id; new photos get fresh rows.
  const artifactRows = (photos ?? []).map((p) => ({
    job_id: jobId,
    event_id: input.eventId,
    source_table: 'papic_photos' as const,
    source_photo_id: p.photo_id as string,
    r2_object_key: p.r2_object_key as string,
    size_bytes: (p.size_bytes as number | null) ?? null,
  }));
  const { error: artErr } = await admin
    .from('photo_delivery_artifacts')
    .upsert(artifactRows, {
      onConflict: 'event_id,source_table,source_photo_id',
      ignoreDuplicates: false,
    });
  if (artErr) {
    return { ok: false, reason: `artifact_upsert:${artErr.message.slice(0, 64)}` };
  }

  // 6. Flip event status + stamp release.
  const nowIso = new Date().toISOString();
  await admin
    .from('events')
    .update({
      photo_delivery_status: 'releasing',
      photo_delivery_progress_pct: 0,
      photo_delivery_started_at: nowIso,
      photo_delivery_failed_count: 0,
      photos_released_at: nowIso,
    })
    .eq('event_id', input.eventId);

  return { ok: true, jobId, totalFiles, alreadyComplete: false };
}

export async function processBatchForEvent(input: {
  eventId: string;
  batchSize?: number;
}): Promise<{
  eventId: string;
  uploaded: number;
  failed: number;
  remaining: number;
  status: 'running' | 'complete' | 'failed' | 'idle';
}> {
  const admin = createAdminClient();
  const batchSize = input.batchSize ?? 6;

  // 1. Find active job.
  const { data: job } = await admin
    .from('photo_delivery_jobs')
    .select('job_id, status, total_files, total_bytes, uploaded_files, failed_files, uploaded_bytes')
    .eq('event_id', input.eventId)
    .in('status', ['queued', 'running', 'paused'])
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!job) return { eventId: input.eventId, uploaded: 0, failed: 0, remaining: 0, status: 'idle' };
  const jobId = job.job_id as string;

  // 2. Pull pending artifacts (drive_file_id IS NULL AND attempt_count < cap).
  const { data: artifacts } = await admin
    .from('photo_delivery_artifacts')
    .select('artifact_id, source_photo_id, r2_object_key, size_bytes, attempt_count')
    .eq('event_id', input.eventId)
    .is('drive_file_id', null)
    .lt('attempt_count', MAX_ATTEMPTS)
    .order('attempt_count', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(batchSize);

  if (!artifacts || artifacts.length === 0) {
    // Nothing pending. Either everything is done, or all remaining are at
    // the retry cap. Inspect the residual to decide final status.
    return await finalizeJob({ eventId: input.eventId, jobId });
  }

  // 3. Load OAuth grant + ensure access token is fresh.
  const accessToken = await ensureFreshAccessToken({ eventId: input.eventId });
  if (!accessToken) {
    // Drive grant gone or refresh failed — surface as job failure.
    await admin
      .from('photo_delivery_jobs')
      .update({ status: 'failed', last_error_text: 'access_token_unavailable', last_error_at: new Date().toISOString() })
      .eq('job_id', jobId);
    await admin
      .from('events')
      .update({ photo_delivery_status: 'failed' })
      .eq('event_id', input.eventId);
    return { eventId: input.eventId, uploaded: 0, failed: 0, remaining: artifacts.length, status: 'failed' };
  }

  // 4. Read the folder id once.
  const { data: folderRow } = await admin
    .from('events')
    .select('photo_delivery_folder_id')
    .eq('event_id', input.eventId)
    .maybeSingle();
  const folderId = folderRow?.photo_delivery_folder_id as string | undefined;
  if (!folderId) {
    return { eventId: input.eventId, uploaded: 0, failed: 0, remaining: artifacts.length, status: 'failed' };
  }

  // 5. Mark job running while we work.
  if (job.status !== 'running') {
    await admin.from('photo_delivery_jobs').update({ status: 'running' }).eq('job_id', jobId);
  }

  // 6. Process each artifact sequentially. (Concurrency would help, but
  //    keeps memory bounded for Vercel's 1GB function ceiling at high
  //    photo sizes; can revisit once we measure real-world batch latency.)
  let uploaded = 0;
  let failed = 0;
  let uploadedBytesDelta = 0;

  for (const art of artifacts) {
    const r2Key = art.r2_object_key as string;
    const sourcePhotoId = art.source_photo_id as string;
    try {
      const bytes = await readR2Object(r2Key);
      const driveFileId = await uploadFileToDrive({
        accessToken,
        folderId,
        fileName: deriveFileNameFromKey(r2Key, sourcePhotoId),
        body: bytes,
      });
      await admin
        .from('photo_delivery_artifacts')
        .update({
          drive_file_id: driveFileId,
          uploaded_at: new Date().toISOString(),
        })
        .eq('artifact_id', art.artifact_id);
      uploaded++;
      uploadedBytesDelta += bytes.byteLength;
    } catch (e) {
      failed++;
      const msg = (e as Error).message.slice(0, 500);
      await admin
        .from('photo_delivery_artifacts')
        .update({
          attempt_count: (art.attempt_count as number) + 1,
          last_error_text: msg,
          last_error_at: new Date().toISOString(),
        })
        .eq('artifact_id', art.artifact_id);
    }
  }

  // 7. Roll job counters + event progress.
  const newUploadedFiles = (job.uploaded_files as number) + uploaded;
  const newFailedFiles = (job.failed_files as number) + failed;
  const newUploadedBytes = (job.uploaded_bytes as number) + uploadedBytesDelta;
  const total = (job.total_files as number) || 1;
  const progressPct = Math.min(100, Math.floor((newUploadedFiles / total) * 100));

  await admin
    .from('photo_delivery_jobs')
    .update({
      uploaded_files: newUploadedFiles,
      failed_files: newFailedFiles,
      uploaded_bytes: newUploadedBytes,
    })
    .eq('job_id', jobId);

  await admin
    .from('events')
    .update({
      photo_delivery_status: 'uploading',
      photo_delivery_progress_pct: progressPct,
      photo_delivery_failed_count: newFailedFiles,
    })
    .eq('event_id', input.eventId);

  // 8. If the batch was smaller than batchSize, we're at the tail —
  //    finalize to either 'complete' or 'failed' depending on residual.
  if (artifacts.length < batchSize) {
    return await finalizeJob({ eventId: input.eventId, jobId });
  }

  return {
    eventId: input.eventId,
    uploaded,
    failed,
    remaining: artifacts.length,
    status: 'running',
  };
}

async function finalizeJob(input: {
  eventId: string;
  jobId: string;
}): Promise<{
  eventId: string;
  uploaded: number;
  failed: number;
  remaining: number;
  status: 'running' | 'complete' | 'failed' | 'idle';
}> {
  const admin = createAdminClient();
  const { count: pendingCount } = await admin
    .from('photo_delivery_artifacts')
    .select('artifact_id', { count: 'exact', head: true })
    .eq('event_id', input.eventId)
    .is('drive_file_id', null)
    .lt('attempt_count', MAX_ATTEMPTS);

  if ((pendingCount ?? 0) > 0) {
    return { eventId: input.eventId, uploaded: 0, failed: 0, remaining: pendingCount ?? 0, status: 'running' };
  }

  const { count: terminalFails } = await admin
    .from('photo_delivery_artifacts')
    .select('artifact_id', { count: 'exact', head: true })
    .eq('event_id', input.eventId)
    .is('drive_file_id', null)
    .gte('attempt_count', MAX_ATTEMPTS);

  const status: 'complete' | 'failed' = (terminalFails ?? 0) > 0 ? 'failed' : 'complete';
  const nowIso = new Date().toISOString();
  await admin
    .from('photo_delivery_jobs')
    .update({ status, completed_at: nowIso })
    .eq('job_id', input.jobId);
  await admin
    .from('events')
    .update({
      photo_delivery_status: status,
      photo_delivery_completed_at: nowIso,
      ...(status === 'complete' ? { photo_delivery_progress_pct: 100 } : {}),
    })
    .eq('event_id', input.eventId);

  // Fire couple-side notifications + emails once per job. notification_sent_at
  // is the idempotency guard — repeated finalizeJob calls (e.g. on every
  // empty-batch tick after a job already finalized) won't fan out again.
  await fanOutFinalizationNotice({ eventId: input.eventId, jobId: input.jobId, finalStatus: status, failedCount: terminalFails ?? 0 });

  return { eventId: input.eventId, uploaded: 0, failed: 0, remaining: 0, status };
}

async function fanOutFinalizationNotice(input: {
  eventId: string;
  jobId: string;
  finalStatus: 'complete' | 'failed';
  failedCount: number;
}): Promise<void> {
  const admin = createAdminClient();

  // Idempotency: only emit if notification_sent_at is still NULL.
  const { data: jobRow } = await admin
    .from('photo_delivery_jobs')
    .select('notification_sent_at, total_files, uploaded_files')
    .eq('job_id', input.jobId)
    .maybeSingle();
  if (!jobRow || jobRow.notification_sent_at) return;

  // Stamp first so a concurrent ticker won't re-emit. Race is fine: at
  // worst two ticks both write the same timestamp; the followup
  // emitNotification call below still only runs from this path.
  await admin
    .from('photo_delivery_jobs')
    .update({ notification_sent_at: new Date().toISOString() })
    .eq('job_id', input.jobId);

  const { data: ev } = await admin
    .from('events')
    .select('display_name, photo_delivery_folder_name')
    .eq('event_id', input.eventId)
    .maybeSingle();
  const displayName = (ev?.display_name as string | undefined) ?? 'your event';
  const folderName = (ev?.photo_delivery_folder_name as string | undefined) ?? '';

  const { data: couples } = await admin
    .from('event_members')
    .select('user_id')
    .eq('event_id', input.eventId)
    .eq('member_type', 'couple');
  const recipients = (couples ?? []).map((r) => r.user_id as string);

  const relatedUrl = `/dashboard/${input.eventId}/add-ons/photo-delivery`;

  if (input.finalStatus === 'complete') {
    const uploaded = (jobRow.uploaded_files as number) ?? 0;
    const total = (jobRow.total_files as number) ?? uploaded;
    const title = 'Photos delivered to your Google Drive';
    const body =
      `${uploaded} of ${total} photo${total === 1 ? '' : 's'} uploaded to ` +
      (folderName ? `“${folderName}” in ` : '') +
      `your Drive. Open the panel to see the folder link or push a re-delivery if more photos come in.`;
    for (const userId of recipients) {
      await emitNotification({
        userId,
        type: 'photo_delivery_complete',
        title,
        body,
        relatedUrl,
      });
    }
  } else {
    const title = 'Photo delivery hit a snag';
    const body =
      `${input.failedCount} photo${input.failedCount === 1 ? '' : 's'} couldn’t be uploaded for ${displayName} after 5 retries. ` +
      `Open the panel to review the failures, redeliver, or disconnect and reconnect Drive.`;
    for (const userId of recipients) {
      await emitNotification({
        userId,
        type: 'photo_delivery_failed',
        title,
        body,
        relatedUrl,
      });
    }
  }
}

async function ensureFreshAccessToken(input: {
  eventId: string;
}): Promise<string | null> {
  const admin = createAdminClient();
  // Phase 0: Photo Delivery now reads the single unified Drive grant
  // (provider='drive'), shared with Papic + the drive-copy layer.
  const { data: grant } = await admin
    .from('oauth_grants')
    .select('grant_id, refresh_token, access_token, access_token_expires_at, revoked_at')
    .eq('event_id', input.eventId)
    .eq('provider', 'drive')
    .maybeSingle();
  if (!grant || grant.revoked_at) return null;

  const expiresAt = grant.access_token_expires_at
    ? new Date(grant.access_token_expires_at as string).getTime()
    : 0;
  if (
    grant.access_token &&
    expiresAt > Date.now() + TOKEN_REFRESH_THRESHOLD_MS
  ) {
    return grant.access_token as string;
  }

  const cfg = getDriveOAuthConfig();
  if (!cfg.ready) return null;

  try {
    const refreshed = await refreshDriveAccessToken({
      refreshToken: grant.refresh_token as string,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
    });
    const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    await admin
      .from('oauth_grants')
      .update({
        access_token: refreshed.access_token,
        access_token_expires_at: newExpiresAt,
        last_refreshed_at: new Date().toISOString(),
      })
      .eq('grant_id', grant.grant_id);
    return refreshed.access_token;
  } catch {
    return null;
  }
}

// readR2Object + uploadToDrive moved to lib/drive-upload.ts (as readR2Object +
// uploadFileToDrive) on 2026-06-03 — shared verbatim with the universal
// Drive-copy layer (lib/drive-copy.ts) so there is one R2→Drive path, not two.

function deriveFileNameFromKey(r2Key: string, fallbackId: string): string {
  const parts = r2Key.split('/');
  const last = parts[parts.length - 1];
  return last && last.length > 0 ? last : `${fallbackId}.bin`;
}
