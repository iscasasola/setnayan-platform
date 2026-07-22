import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { getDriveOAuthConfig, refreshDriveAccessToken } from '@/lib/papic-drive';
import { buildPhotoDeliveryFolderName } from '@/lib/photo-delivery-drive';
import {
  createDriveFolder,
  readR2Object,
  uploadFileToDrive,
} from '@/lib/drive-upload';
import {
  type DriveProvider,
  isDriveQuotaExceededError,
} from '@/lib/drive-copy-core';

// Re-export the 2-Drive primitives so existing importers of drive-copy keep working.
export { type DriveProvider, isDriveQuotaExceededError };

// ============================================================================
// Universal Google-Drive copy layer.
//
// Decision: Storage_and_Drive_Copy_Architecture_2026-06-03.md + DECISION_LOG
//           2026-06-03 "Storage & Drive-copy architecture LOCKED".
//
// R2 is the system of record; Google Drive is the couple's PERMANENT COPY of
// six artifacts — Papic · Patiktok · Pabati · Pakanta · Monogram · QR codes.
// Every feeder, after finalizing its R2 object, calls pushToDriveCopy() and
// the bytes are copied into the couple's Drive: one event folder, one
// subfolder per artifact type. (Panood is NOT here — YouTube only.)
//
// Schema: drive_copy_folders + drive_copy_artifacts
//         (20260726000000_drive_copy_layer_foundation.sql).
// Byte primitives: lib/drive-upload.ts (shared with 0009 Photo Delivery).
//
// OAuth grant: this layer reads the per-event Drive grant at
// oauth_grants(provider='drive'). As of Phase 0 (drive-oauth-consolidation)
// this is the SINGLE per-event Drive connection — the Papic connect and the
// Photo Delivery connect both flow through the canonical Drive consent +
// /api/oauth/drive/callback and write provider='drive'. Any event with a
// connected Drive is visible here; feeders that run before a connect just
// enqueue, and the copy runs the moment the grant exists.
// ============================================================================

export const DRIVE_COPY_ARTIFACT_TYPES = [
  'papic',
  'patiktok',
  'pabati',
  'pakanta',
  'monogram',
  'qr_codes',
] as const;

export type DriveCopyArtifactType = (typeof DRIVE_COPY_ARTIFACT_TYPES)[number];

// Human-readable subfolder name per artifact type, created under the event's
// root Drive folder. Matches the layout in the architecture doc.
export const ARTIFACT_SUBFOLDER_NAME: Record<DriveCopyArtifactType, string> = {
  papic: 'Papic',
  patiktok: 'Patiktok',
  pabati: 'Pabati',
  pakanta: 'Pakanta',
  monogram: 'Monogram',
  qr_codes: 'QR Codes',
};

const MAX_ATTEMPTS = 5;
const TOKEN_REFRESH_THRESHOLD_MS = 5 * 60 * 1000; // refresh within 5 min of expiry
const DEFAULT_BATCH_SIZE = 6;

// The 2-Drive primitives (DriveProvider + isDriveQuotaExceededError) are imported
// at the top from the pure core module and re-exported below for existing callers.

export type DriveCopyFile = {
  r2ObjectKey: string;
  fileName: string;
  mimeType?: string;
  sizeBytes?: number | null;
  sourceTable?: string | null;
  sourceRef?: string | null;
  /** Defaults to true — set false only when copying a post-compression file. */
  copiedHighRes?: boolean;
};

export type DriveCopySummary = {
  status: 'ok' | 'no_files' | 'no_drive_connected';
  enqueued: number;
  skipped: number;
  uploaded: number;
  failed: number;
  remaining: number;
};

/**
 * Feeder-facing entry point. Records the artifact files for an event +
 * artifact type, then copies whatever is pending into the couple's Drive.
 *
 * Always safe to call: if the couple has not connected Drive (no 'drive'
 * grant), the files are still enqueued and will be copied by a later batch
 * once the grant exists — the feeder never has to know whether Drive is
 * connected yet.
 */
export async function pushToDriveCopy(input: {
  eventId: string;
  artifactType: DriveCopyArtifactType;
  files: DriveCopyFile[];
}): Promise<DriveCopySummary> {
  if (input.files.length === 0) {
    return { status: 'no_files', enqueued: 0, skipped: 0, uploaded: 0, failed: 0, remaining: 0 };
  }

  const { enqueued, skipped } = await enqueueDriveCopy(input);

  const accessToken = await getEventDriveAccessToken(input.eventId);
  if (!accessToken) {
    // Drive not connected (or token refresh failed). Files stay enqueued for
    // a later batch / the Phase-2 cron tick.
    const remaining = await countPending(input.eventId);
    return { status: 'no_drive_connected', enqueued, skipped, uploaded: 0, failed: 0, remaining };
  }

  const batch = await runDriveCopyBatch({ eventId: input.eventId, accessToken });
  return {
    status: 'ok',
    enqueued,
    skipped,
    uploaded: batch.uploaded,
    failed: batch.failed,
    remaining: batch.remaining,
  };
}

/**
 * Upsert artifact rows. Dedupe key is (event_id, r2_object_key) — re-enqueuing
 * an already-recorded object is a no-op (we never reset an uploaded row), so
 * feeders can call this idempotently. Returns how many were newly enqueued vs
 * skipped as already-present.
 */
export async function enqueueDriveCopy(input: {
  eventId: string;
  artifactType: DriveCopyArtifactType;
  files: DriveCopyFile[];
}): Promise<{ enqueued: number; skipped: number }> {
  if (input.files.length === 0) return { enqueued: 0, skipped: 0 };
  const admin = createAdminClient();

  const keys = input.files.map((f) => f.r2ObjectKey);
  const { data: existingRows } = await admin
    .from('drive_copy_artifacts')
    .select('r2_object_key')
    .eq('event_id', input.eventId)
    .in('r2_object_key', keys);
  const existing = new Set((existingRows ?? []).map((r) => r.r2_object_key as string));

  const newRows = input.files
    .filter((f) => !existing.has(f.r2ObjectKey))
    .map((f) => ({
      event_id: input.eventId,
      artifact_type: input.artifactType,
      source_table: f.sourceTable ?? null,
      source_ref: f.sourceRef ?? null,
      r2_object_key: f.r2ObjectKey,
      file_name: f.fileName,
      mime_type: f.mimeType ?? null,
      size_bytes: f.sizeBytes ?? null,
      copied_high_res: f.copiedHighRes ?? true,
    }));

  if (newRows.length > 0) {
    await admin
      .from('drive_copy_artifacts')
      .upsert(newRows, { onConflict: 'event_id,r2_object_key', ignoreDuplicates: true });
  }

  return { enqueued: newRows.length, skipped: input.files.length - newRows.length };
}

/**
 * Copy a batch of pending artifacts for an event into the couple's Drive.
 * Sequential per file to keep memory bounded (one artifact in memory at a
 * time — same reasoning as the 0009 release worker on Vercel's 1GB ceiling).
 * Ensures each artifact type's subfolder exactly once per call.
 *
 * By default retries rows below MAX_ATTEMPTS (the normal capture/release path).
 * The autonomous retry sweep (lib/papic-drive-copy-retry.ts) passes a raised
 * `attemptCap` (the retry ceiling) to reach rows the normal batch abandoned at
 * MAX_ATTEMPTS, plus a `retryDue` gate that enforces the exponential back-off so
 * a broken Drive is never hammered in a tight loop. Both options default to the
 * pre-existing behaviour, so every other caller is unaffected.
 */
export async function runDriveCopyBatch(input: {
  eventId: string;
  batchSize?: number;
  accessToken?: string;
  /** Retry rows with attempt_count < this. Default MAX_ATTEMPTS (normal path). */
  attemptCap?: number;
  /** Per-row back-off gate (retry sweep). Default: every fetched row is due. */
  retryDue?: (row: { attempt_count: number; last_error_at: string | null }) => boolean;
}): Promise<{ uploaded: number; failed: number; remaining: number }> {
  const admin = createAdminClient();
  const batchSize = input.batchSize ?? DEFAULT_BATCH_SIZE;
  const attemptCap = input.attemptCap ?? MAX_ATTEMPTS;

  const { data: pendingRaw } = await admin
    .from('drive_copy_artifacts')
    .select('artifact_id, artifact_type, r2_object_key, file_name, mime_type, attempt_count, last_error_at')
    .eq('event_id', input.eventId)
    .is('drive_file_id', null)
    .lt('attempt_count', attemptCap)
    .order('attempt_count', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(batchSize);

  // Back-off gate (retry sweep only): drop rows that failed too recently so a
  // permanently-broken Drive is retried increasingly sparsely, never hammered.
  const pending = input.retryDue
    ? (pendingRaw ?? []).filter((r) =>
        input.retryDue!({
          attempt_count: (r.attempt_count as number | null) ?? 0,
          last_error_at: (r.last_error_at as string | null) ?? null,
        }),
      )
    : pendingRaw;

  if (!pending || pending.length === 0) {
    return { uploaded: 0, failed: 0, remaining: 0 };
  }

  const primaryToken =
    input.accessToken ?? (await getEventDriveAccessToken(input.eventId, 'drive'));
  if (!primaryToken) {
    // No token — leave the rows pending without burning a retry attempt.
    return { uploaded: 0, failed: 0, remaining: await countPending(input.eventId) };
  }

  // 2-Drive overflow (owner 2026-07-11): start on Drive #1; if it returns a
  // `storageQuotaExceeded` (Drive #1 is full), fail over to the couple's 2nd
  // Drive (provider='drive_overflow') for THIS file and the rest of the batch.
  // Folder ids are per-Drive, so each provider gets its own folder cache. The
  // overflow token is resolved lazily — only if Drive #1 actually fills.
  const tokens: Record<DriveProvider, string | null> = {
    drive: primaryToken,
    drive_overflow: null,
  };
  const folderCaches: Record<DriveProvider, Map<DriveCopyArtifactType, string>> = {
    drive: new Map(),
    drive_overflow: new Map(),
  };
  let activeProvider: DriveProvider = 'drive';
  let uploaded = 0;
  let failed = 0;

  // Ensure-folder (cached per Drive) → read R2 → upload to that Drive. Throws
  // on any failure so the caller can decide whether to fail over.
  const uploadOne = async (
    art: (typeof pending)[number],
    provider: DriveProvider,
    token: string,
  ): Promise<{ driveFileId: string; folderId: string }> => {
    const artifactType = art.artifact_type as DriveCopyArtifactType;
    const cache = folderCaches[provider];
    let folderId = cache.get(artifactType);
    if (!folderId) {
      const ensured = await ensureArtifactFolder({
        eventId: input.eventId,
        artifactType,
        accessToken: token,
        driveProvider: provider,
      });
      if (!ensured) throw new Error('drive_folder_unavailable');
      folderId = ensured;
      cache.set(artifactType, folderId);
    }
    const bytes = await readR2Object(art.r2_object_key as string);
    const driveFileId = await uploadFileToDrive({
      accessToken: token,
      folderId,
      fileName: art.file_name as string,
      body: bytes,
      mimeType: (art.mime_type as string | null) ?? undefined,
    });
    return { driveFileId, folderId };
  };

  const markUploaded = async (
    artifactId: string,
    driveFileId: string,
    folderId: string,
  ) => {
    await admin
      .from('drive_copy_artifacts')
      .update({
        drive_file_id: driveFileId,
        drive_folder_id: folderId, // folder id identifies which Drive it landed in
        uploaded_at: new Date().toISOString(),
      })
      .eq('artifact_id', artifactId);
  };

  for (const art of pending) {
    let err: unknown = null;
    try {
      const r = await uploadOne(art, activeProvider, tokens[activeProvider] as string);
      await markUploaded(art.artifact_id as string, r.driveFileId, r.folderId);
      uploaded++;
      continue;
    } catch (e) {
      err = e;
      // Drive #1 full → fail over to the 2nd Drive for this + every later file.
      if (isDriveQuotaExceededError(e) && activeProvider === 'drive') {
        if (tokens.drive_overflow === null) {
          tokens.drive_overflow = await getEventDriveAccessToken(
            input.eventId,
            'drive_overflow',
          );
        }
        if (tokens.drive_overflow) {
          activeProvider = 'drive_overflow';
          try {
            const r = await uploadOne(art, 'drive_overflow', tokens.drive_overflow);
            await markUploaded(art.artifact_id as string, r.driveFileId, r.folderId);
            uploaded++;
            continue;
          } catch (e2) {
            err = e2; // overflow also failed → record it below
          }
        }
      }
    }

    // Failure path (primary failed and no usable overflow, or overflow failed).
    failed++;
    const { data: row } = await admin
      .from('drive_copy_artifacts')
      .select('attempt_count')
      .eq('artifact_id', art.artifact_id)
      .maybeSingle();
    await admin
      .from('drive_copy_artifacts')
      .update({
        attempt_count: ((row?.attempt_count as number | null) ?? 0) + 1,
        last_error_text: (err as Error).message.slice(0, 500),
        last_error_at: new Date().toISOString(),
      })
      .eq('artifact_id', art.artifact_id);
  }

  return { uploaded, failed, remaining: await countPending(input.eventId) };
}

/**
 * Find-or-create the event's root Drive folder + the subfolder for one
 * artifact type, caching both ids in drive_copy_folders. Returns the
 * subfolder id (where files of this type are written), or null if the
 * event/grant context is missing.
 */
export async function ensureArtifactFolder(input: {
  eventId: string;
  artifactType: DriveCopyArtifactType;
  accessToken: string;
  /** Which Drive to build folders in (owner 2026-07-11 · 2-Drive overflow). */
  driveProvider?: DriveProvider;
}): Promise<string | null> {
  const admin = createAdminClient();
  const driveProvider: DriveProvider = input.driveProvider ?? 'drive';

  const { data: ev } = await admin
    .from('events')
    .select('display_name, event_date, photo_delivery_folder_id')
    .eq('event_id', input.eventId)
    .maybeSingle();
  if (!ev) return null;

  // Papic shares the couple's existing Photo Delivery folder so the manual
  // "Release to Drive" worker and this auto-sync feeder write to the SAME
  // Drive folder (dedup is per drive_copy_artifacts.r2_object_key). The other
  // artifact types each get their own subfolder under the event root.
  // ⚠ Only on the PRIMARY Drive — photo_delivery_folder_id is a folder id in
  // Drive #1, which does not exist in the overflow Drive; the overflow Drive
  // builds its own fresh folder tree.
  if (
    driveProvider === 'drive' &&
    input.artifactType === 'papic' &&
    ev.photo_delivery_folder_id
  ) {
    return ev.photo_delivery_folder_id as string;
  }

  const rootName = buildPhotoDeliveryFolderName({
    displayName: (ev.display_name as string | null) ?? 'Setnayan Event',
    eventDate: (ev.event_date as string | null) ?? null,
  });

  const rootId = await ensureFolderRow({
    eventId: input.eventId,
    kind: 'root',
    driveProvider,
    create: () =>
      createDriveFolder({ accessToken: input.accessToken, name: rootName, parentId: null }),
  });
  if (!rootId) return null;

  return await ensureFolderRow({
    eventId: input.eventId,
    kind: input.artifactType,
    driveProvider,
    create: () =>
      createDriveFolder({
        accessToken: input.accessToken,
        name: ARTIFACT_SUBFOLDER_NAME[input.artifactType],
        parentId: rootId,
      }),
  });
}

/**
 * Read the event's Drive access token from oauth_grants(provider='drive'),
 * refreshing it when it is missing or within 5 minutes of expiry. Persists
 * the refreshed token. Returns null when there is no active grant or the
 * refresh fails (caller leaves work enqueued).
 */
export async function getEventDriveAccessToken(
  eventId: string,
  provider: DriveProvider = 'drive',
): Promise<string | null> {
  const admin = createAdminClient();
  const { data: grant } = await admin
    .from('oauth_grants')
    .select('grant_id, refresh_token, access_token, access_token_expires_at, revoked_at')
    .eq('event_id', eventId)
    .eq('provider', provider)
    .maybeSingle();
  if (!grant || grant.revoked_at) return null;

  const expiresAt = grant.access_token_expires_at
    ? new Date(grant.access_token_expires_at as string).getTime()
    : 0;
  if (grant.access_token && expiresAt > Date.now() + TOKEN_REFRESH_THRESHOLD_MS) {
    return grant.access_token as string;
  }

  const cfg = await getDriveOAuthConfig();
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
        // A successful refresh proves the refresh_token is still good — clear any
        // prior needs_reauth so a recovered connection stops nagging the couple.
        connection_health: 'ok',
      })
      .eq('grant_id', grant.grant_id);
    return refreshed.access_token;
  } catch {
    // Google rejected the refresh_token (invalid_grant — revoked in the couple's
    // Google security settings, or a password reset). Record it so the
    // couple-facing surfaces can show a "needs reconnect" banner instead of a
    // stale "Connected" while uploads silently stall. Work stays enqueued and
    // resumes the moment they reconnect.
    await admin
      .from('oauth_grants')
      .update({ connection_health: 'needs_reauth' })
      .eq('grant_id', grant.grant_id);
    return null;
  }
}

// ----------------------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------------------

async function ensureFolderRow(input: {
  eventId: string;
  kind: 'root' | DriveCopyArtifactType;
  driveProvider: DriveProvider;
  create: () => Promise<string>;
}): Promise<string | null> {
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from('drive_copy_folders')
    .select('drive_folder_id')
    .eq('event_id', input.eventId)
    .eq('kind', input.kind)
    .eq('drive_provider', input.driveProvider)
    .maybeSingle();
  if (existing?.drive_folder_id) return existing.drive_folder_id as string;

  // Create on Drive, then upsert. A concurrent tick may have created its own
  // folder + row; ignoreDuplicates keeps the first writer's id canonical (the
  // loser's folder becomes an inert drive.file orphan the couple can delete).
  const created = await input.create();
  await admin
    .from('drive_copy_folders')
    .upsert(
      {
        event_id: input.eventId,
        kind: input.kind,
        drive_provider: input.driveProvider,
        drive_folder_id: created,
      },
      { onConflict: 'event_id,kind,drive_provider', ignoreDuplicates: true },
    );

  const { data: canonical } = await admin
    .from('drive_copy_folders')
    .select('drive_folder_id')
    .eq('event_id', input.eventId)
    .eq('kind', input.kind)
    .eq('drive_provider', input.driveProvider)
    .maybeSingle();
  return (canonical?.drive_folder_id as string | undefined) ?? created;
}

async function countPending(eventId: string): Promise<number> {
  const admin = createAdminClient();
  const { count } = await admin
    .from('drive_copy_artifacts')
    .select('artifact_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('drive_file_id', null)
    .lt('attempt_count', MAX_ATTEMPTS);
  return count ?? 0;
}
