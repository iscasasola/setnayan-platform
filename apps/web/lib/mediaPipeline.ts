/**
 * Unified media submission interceptor pipeline (V2 offline architecture).
 *
 * Per blueprint Part 5 § 2 · "the application checks network connectivity
 * state parameters (navigator.onLine === false) before any submission
 * execution. If a venue is completely offline, the system halts transmission
 * timeout errors and gracefully diverts the files to the local IndexedDB
 * cache workspace. Guests and crew experience zero interface lag."
 *
 * This module is the single intake point all 7 media services call when a
 * capture happens. It decides: try-direct-upload vs queue-to-vault. When
 * queued, the OfflineSyncProvider's background daemon picks the items up
 * once `navigator.onLine` flips back to true.
 *
 * Companion: lib/indexedDB.ts (storage primitives) ·
 *            _components/OfflineSyncProvider.tsx (daemon + UI surface).
 *
 * Spec corpus: V2_Cutover_Plan_2026-05-28.md Phase G.
 */

import {
  enqueueMedia,
  listPendingFlushable,
  readBlob,
  markUploading,
  markSuccess,
  markFailure,
  type MediaServiceCode,
  type PendingUpload,
} from './indexedDB';

export type CaptureMetadata = {
  event_id: string;
  vendor_id?: string;
  service_code: MediaServiceCode;
  content_type: string;
  filename: string;
  captured_at?: string;
  geo_lat?: number;
  geo_lon?: number;
  geo_accuracy_m?: number;
  device_model?: string;
  paired_camera_brand?: string;
  paired_camera_model?: string;
};

export type IntakeResult =
  | { route: 'direct'; remote_object_key: string; upload_id?: string }
  | { route: 'queued'; upload_id: string; reason: 'offline' | 'direct_failed' };

const DIRECT_UPLOAD_ENDPOINT = '/api/upload';
/** Per-attempt fetch timeout · short enough to flip to queue fast on weak networks. */
const DIRECT_UPLOAD_TIMEOUT_MS = 8_000;

/**
 * Single intake point for all media captures. Always returns success-shape —
 * caller doesn't have to differentiate online vs offline. The vault queue
 * + background daemon handle the rest.
 */
export async function intakeMedia(
  blob: Blob,
  meta: CaptureMetadata,
): Promise<IntakeResult> {
  const enriched = enrichMetadata(meta, blob);

  // Fast path · navigator.onLine === false → straight to queue. No
  // transmission timeout, no user-visible lag.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const queued = await enqueueMedia(toPending(enriched, blob), blob);
    return { route: 'queued', upload_id: queued.upload_id, reason: 'offline' };
  }

  // Optimistic path · attempt direct upload with a tight timeout. If it
  // fails for any reason (network blip, server 5xx, timeout), fall through
  // to the queue so the daemon can retry asynchronously.
  try {
    const remoteObjectKey = await uploadDirect(blob, enriched);
    return { route: 'direct', remote_object_key: remoteObjectKey };
  } catch (uploadError) {
    const queued = await enqueueMedia(
      toPending(enriched, blob),
      blob,
    );
    // Stamp the error on the queued record so the daemon backoff kicks in
    // from the first retry attempt.
    await markFailure(queued.upload_id, errorMessage(uploadError));
    return { route: 'queued', upload_id: queued.upload_id, reason: 'direct_failed' };
  }
}

/**
 * Drain the queue · invoked by the background daemon when navigator.onLine
 * flips to true OR on a heartbeat interval while online. Returns a summary
 * the provider can surface in the upload chip UI.
 */
export async function flushPendingQueue(): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  remaining_queued: number;
}> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const stats = await listPendingFlushable();
    return { attempted: 0, succeeded: 0, failed: 0, remaining_queued: stats.length };
  }

  const flushable = await listPendingFlushable();
  let succeeded = 0;
  let failed = 0;

  // Sequential flush keeps the burst light on weak post-venue cellular
  // (5-vendor crews on a single 4G hotspot). Parallelism here can land in
  // V2.1 once we have observability on actual reconnect patterns.
  for (const row of flushable) {
    try {
      await markUploading(row.upload_id);
      const blob = await readBlob(row.upload_id);
      if (!blob) {
        await markFailure(row.upload_id, 'blob_missing');
        failed++;
        continue;
      }
      const meta: CaptureMetadata = pendingToMetadata(row);
      const remoteKey = await uploadDirect(blob, meta);
      await markSuccess(row.upload_id, remoteKey);
      succeeded++;
    } catch (err) {
      await markFailure(row.upload_id, errorMessage(err));
      failed++;
    }
  }

  const remaining = await listPendingFlushable();
  return {
    attempted: flushable.length,
    succeeded,
    failed,
    remaining_queued: remaining.length,
  };
}

// ---------- internals ----------

async function uploadDirect(blob: Blob, meta: CaptureMetadata): Promise<string> {
  const form = new FormData();
  form.append('file', blob, meta.filename);
  form.append('event_id', meta.event_id);
  form.append('service_code', meta.service_code);
  if (meta.vendor_id) form.append('vendor_id', meta.vendor_id);
  if (meta.captured_at) form.append('captured_at', meta.captured_at);
  if (meta.geo_lat !== undefined) form.append('geo_lat', String(meta.geo_lat));
  if (meta.geo_lon !== undefined) form.append('geo_lon', String(meta.geo_lon));
  if (meta.geo_accuracy_m !== undefined) form.append('geo_accuracy_m', String(meta.geo_accuracy_m));
  if (meta.device_model) form.append('device_model', meta.device_model);
  if (meta.paired_camera_brand) form.append('paired_camera_brand', meta.paired_camera_brand);
  if (meta.paired_camera_model) form.append('paired_camera_model', meta.paired_camera_model);

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutHandle = controller
    ? setTimeout(() => controller.abort(), DIRECT_UPLOAD_TIMEOUT_MS)
    : null;

  try {
    const res = await fetch(DIRECT_UPLOAD_ENDPOINT, {
      method: 'POST',
      body: form,
      signal: controller?.signal,
    });
    if (!res.ok) {
      throw new Error(`upload_failed_${res.status}`);
    }
    const json = (await res.json()) as { object_key?: string; key?: string };
    const key = json.object_key ?? json.key;
    if (!key) throw new Error('upload_response_missing_key');
    return key;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

function enrichMetadata(meta: CaptureMetadata, blob: Blob): CaptureMetadata {
  const captured = meta.captured_at ?? new Date().toISOString();
  const filename = meta.filename ?? inferFilename(meta, blob);
  const contentType = meta.content_type || blob.type || 'application/octet-stream';
  return {
    ...meta,
    captured_at: captured,
    filename,
    content_type: contentType,
  };
}

function inferFilename(meta: CaptureMetadata, blob: Blob): string {
  const ext = blob.type.includes('video') ? 'mp4'
    : blob.type.includes('jpeg') ? 'jpg'
    : blob.type.includes('png') ? 'png'
    : blob.type.includes('webp') ? 'webp'
    : 'bin';
  const stamp = (meta.captured_at ?? new Date().toISOString()).replace(/[:.]/g, '-');
  return `${meta.service_code.toLowerCase()}-${stamp}.${ext}`;
}

function toPending(
  meta: CaptureMetadata,
  blob: Blob,
): Omit<PendingUpload, 'upload_id' | 'status' | 'retry_count'> {
  return {
    event_id: meta.event_id,
    vendor_id: meta.vendor_id,
    service_code: meta.service_code,
    content_type: meta.content_type,
    byte_size: blob.size,
    filename: meta.filename,
    captured_at: meta.captured_at ?? new Date().toISOString(),
    geo_lat: meta.geo_lat,
    geo_lon: meta.geo_lon,
    geo_accuracy_m: meta.geo_accuracy_m,
    device_model: meta.device_model,
    paired_camera_brand: meta.paired_camera_brand,
    paired_camera_model: meta.paired_camera_model,
  };
}

function pendingToMetadata(row: PendingUpload): CaptureMetadata {
  return {
    event_id: row.event_id,
    vendor_id: row.vendor_id,
    service_code: row.service_code,
    content_type: row.content_type,
    filename: row.filename,
    captured_at: row.captured_at,
    geo_lat: row.geo_lat,
    geo_lon: row.geo_lon,
    geo_accuracy_m: row.geo_accuracy_m,
    device_model: row.device_model,
    paired_camera_brand: row.paired_camera_brand,
    paired_camera_model: row.paired_camera_model,
  };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  if (typeof err === 'string') return err;
  return 'unknown_error';
}
