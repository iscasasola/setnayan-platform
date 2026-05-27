/**
 * IndexedDB local vault for all 7 media services (V2 offline architecture).
 *
 * Per blueprint Part 5 § 1 · "the application initializes a private, isolated
 * storage vault right inside the user's mobile browser using IndexedDB" to
 * buffer media files when the venue's network drops.
 *
 * Object stores:
 *   pending_uploads · queue of captured media awaiting auto-sync
 *   media_blobs     · raw Blob storage (out-of-band from queue metadata)
 *   sync_log        · audit log of successful + failed sync attempts
 *
 * Companion modules:
 *   lib/mediaPipeline.ts          · unified intake interceptor (online vs offline)
 *   _components/OfflineSyncProvider.tsx · top-level provider that wires the
 *                                          background sync daemon to React state
 *
 * Spec corpus: V2_Cutover_Plan_2026-05-28.md Phase G (IndexedDB + offline
 * daemon). Blueprint Part 5 § 1-3.
 */

export const DB_NAME = 'setnayan_offline_vault';
export const DB_VERSION = 1;
export const STORE_PENDING = 'pending_uploads';
export const STORE_BLOBS = 'media_blobs';
export const STORE_SYNC_LOG = 'sync_log';

export type MediaServiceCode =
  | 'PAPIC'
  | 'PABATI'
  | 'PANOOD'
  | 'PATIKTOK'
  | 'SDE'
  | 'CAMERA_BRIDGE'
  | 'LIVE_WALL';

export type PendingUpload = {
  /** Stable client-generated ID · UUID v4 from crypto.randomUUID(). */
  upload_id: string;
  event_id: string;
  vendor_id?: string;
  service_code: MediaServiceCode;
  /** MIME type · used to pick the correct upload endpoint. */
  content_type: string;
  /** Size in bytes · used for progress + 500KB-min-for-Papic check. */
  byte_size: number;
  /** Filename suggestion sent to R2 · server may rewrite. */
  filename: string;
  /** ISO timestamp of original capture · used for EXIF + ordering. */
  captured_at: string;
  /** Geo + device metadata stamped at capture time (blueprint Part 4 § 2). */
  geo_lat?: number;
  geo_lon?: number;
  geo_accuracy_m?: number;
  device_model?: string;
  paired_camera_brand?: string;
  paired_camera_model?: string;
  /** State machine: queued → uploading → done · failed_<n> on retry. */
  status: 'queued' | 'uploading' | 'done' | 'failed';
  retry_count: number;
  next_retry_at?: number; // epoch ms · exponential backoff target
  last_error?: string;
  /** Server-assigned object key once upload succeeds. */
  remote_object_key?: string;
};

export type SyncLogEntry = {
  log_id: string;
  upload_id: string;
  event: 'queued' | 'attempt' | 'success' | 'failure' | 'evicted';
  message?: string;
  at: number;
};

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open (or create) the offline vault. Singleton per page · returns the same
 * promise on repeat calls so concurrent callers don't open duplicate connections.
 */
export function openVault(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.reject(new Error('IndexedDB unavailable (SSR or unsupported browser)'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        const store = db.createObjectStore(STORE_PENDING, { keyPath: 'upload_id' });
        store.createIndex('by_status', 'status', { unique: false });
        store.createIndex('by_event', 'event_id', { unique: false });
        store.createIndex('by_service', 'service_code', { unique: false });
        store.createIndex('by_next_retry', 'next_retry_at', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        // keyPath matches upload_id so blob + metadata pair 1:1.
        db.createObjectStore(STORE_BLOBS, { keyPath: 'upload_id' });
      }
      if (!db.objectStoreNames.contains(STORE_SYNC_LOG)) {
        const store = db.createObjectStore(STORE_SYNC_LOG, { keyPath: 'log_id' });
        store.createIndex('by_upload', 'upload_id', { unique: false });
        store.createIndex('by_at', 'at', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB vault'));
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
  });

  return dbPromise;
}

/**
 * Queue a media capture for offline-tolerant upload. Stores metadata in
 * pending_uploads and raw blob in media_blobs (split because IDB performs
 * better with small metadata records + cleared blob storage on success).
 */
export async function enqueueMedia(
  meta: Omit<PendingUpload, 'upload_id' | 'status' | 'retry_count'>,
  blob: Blob,
): Promise<PendingUpload> {
  const db = await openVault();
  const uploadId = generateUploadId();
  const record: PendingUpload = {
    ...meta,
    upload_id: uploadId,
    status: 'queued',
    retry_count: 0,
  };

  await runTx(db, [STORE_PENDING, STORE_BLOBS, STORE_SYNC_LOG], 'readwrite', (tx) => {
    tx.objectStore(STORE_PENDING).put(record);
    tx.objectStore(STORE_BLOBS).put({ upload_id: uploadId, blob });
    tx.objectStore(STORE_SYNC_LOG).put({
      log_id: generateUploadId(),
      upload_id: uploadId,
      event: 'queued',
      at: Date.now(),
    } satisfies SyncLogEntry);
  });

  return record;
}

/**
 * Read everything currently in queued/failed state · used by the background
 * sync daemon to pick the next batch to flush.
 */
export async function listPendingFlushable(now: number = Date.now()): Promise<PendingUpload[]> {
  const db = await openVault();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readonly');
    const store = tx.objectStore(STORE_PENDING);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = (req.result ?? []) as PendingUpload[];
      const flushable = all.filter((row) => {
        if (row.status === 'done') return false;
        if (row.status === 'uploading') return false;
        if (row.next_retry_at && row.next_retry_at > now) return false;
        return true;
      });
      resolve(flushable);
    };
    req.onerror = () => reject(req.error);
  });
}

/**
 * Pull the Blob for a queued upload. Resolves `null` if missing (treated as
 * orphan record · daemon should evict).
 */
export async function readBlob(uploadId: string): Promise<Blob | null> {
  const db = await openVault();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BLOBS, 'readonly');
    const req = tx.objectStore(STORE_BLOBS).get(uploadId);
    req.onsuccess = () => {
      const row = req.result as { upload_id: string; blob: Blob } | undefined;
      resolve(row?.blob ?? null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markUploading(uploadId: string): Promise<void> {
  await mutatePending(uploadId, (row) => {
    row.status = 'uploading';
  });
}

export async function markSuccess(uploadId: string, remoteObjectKey: string): Promise<void> {
  const db = await openVault();
  await runTx(db, [STORE_PENDING, STORE_BLOBS, STORE_SYNC_LOG], 'readwrite', (tx) => {
    const pendingStore = tx.objectStore(STORE_PENDING);
    const getReq = pendingStore.get(uploadId);
    getReq.onsuccess = () => {
      const row = getReq.result as PendingUpload | undefined;
      if (row) {
        row.status = 'done';
        row.remote_object_key = remoteObjectKey;
        pendingStore.put(row);
      }
    };
    // Drop the blob immediately on success to free storage.
    tx.objectStore(STORE_BLOBS).delete(uploadId);
    tx.objectStore(STORE_SYNC_LOG).put({
      log_id: generateUploadId(),
      upload_id: uploadId,
      event: 'success',
      message: remoteObjectKey,
      at: Date.now(),
    } satisfies SyncLogEntry);
  });
}

export async function markFailure(uploadId: string, error: string): Promise<void> {
  await mutatePending(uploadId, (row) => {
    row.status = 'failed';
    row.retry_count += 1;
    row.last_error = error;
    row.next_retry_at = computeBackoff(row.retry_count);
  });
  const db = await openVault();
  await runTx(db, [STORE_SYNC_LOG], 'readwrite', (tx) => {
    tx.objectStore(STORE_SYNC_LOG).put({
      log_id: generateUploadId(),
      upload_id: uploadId,
      event: 'failure',
      message: error,
      at: Date.now(),
    } satisfies SyncLogEntry);
  });
}

/**
 * Evict an upload past TTL (blueprint says 7-day TTL on local-only items).
 * Drops both the queue record and the blob · log entry preserved.
 */
export async function evictExpired(ttlDays: number = 7): Promise<number> {
  const cutoff = Date.now() - ttlDays * 24 * 60 * 60 * 1000;
  const db = await openVault();
  let evicted = 0;
  await runTx(db, [STORE_PENDING, STORE_BLOBS, STORE_SYNC_LOG], 'readwrite', (tx) => {
    const store = tx.objectStore(STORE_PENDING);
    const cursorReq = store.openCursor();
    cursorReq.onsuccess = () => {
      const cursor = cursorReq.result;
      if (!cursor) return;
      const row = cursor.value as PendingUpload;
      const capturedAt = Date.parse(row.captured_at);
      if (Number.isFinite(capturedAt) && capturedAt < cutoff && row.status !== 'done') {
        tx.objectStore(STORE_BLOBS).delete(row.upload_id);
        tx.objectStore(STORE_SYNC_LOG).put({
          log_id: generateUploadId(),
          upload_id: row.upload_id,
          event: 'evicted',
          message: `Past ${ttlDays}-day TTL · captured_at=${row.captured_at}`,
          at: Date.now(),
        } satisfies SyncLogEntry);
        cursor.delete();
        evicted++;
      }
      cursor.continue();
    };
  });
  return evicted;
}

/**
 * Queue + blob storage usage estimate · drives the upload chip's "queue
 * depth + network mode" surface per CLAUDE.md 2026-05-10 decision-log row
 * "Adaptive compression + offline queue."
 */
export async function vaultStats(): Promise<{
  queued: number;
  uploading: number;
  failed: number;
  done: number;
  estimated_bytes_pending: number;
}> {
  const db = await openVault();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PENDING, 'readonly');
    const req = tx.objectStore(STORE_PENDING).getAll();
    req.onsuccess = () => {
      const all = (req.result ?? []) as PendingUpload[];
      const stats = { queued: 0, uploading: 0, failed: 0, done: 0, estimated_bytes_pending: 0 };
      for (const row of all) {
        if (row.status === 'queued') stats.queued++;
        else if (row.status === 'uploading') stats.uploading++;
        else if (row.status === 'failed') stats.failed++;
        else if (row.status === 'done') stats.done++;
        if (row.status !== 'done') stats.estimated_bytes_pending += row.byte_size;
      }
      resolve(stats);
    };
    req.onerror = () => reject(req.error);
  });
}

// ---------- internals ----------

async function mutatePending(
  uploadId: string,
  mutator: (row: PendingUpload) => void,
): Promise<void> {
  const db = await openVault();
  await runTx(db, [STORE_PENDING], 'readwrite', (tx) => {
    const store = tx.objectStore(STORE_PENDING);
    const req = store.get(uploadId);
    req.onsuccess = () => {
      const row = req.result as PendingUpload | undefined;
      if (!row) return;
      mutator(row);
      store.put(row);
    };
  });
}

function runTx(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  worker: (tx: IDBTransaction) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    worker(tx);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('IDB transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('IDB transaction aborted'));
  });
}

function computeBackoff(retryCount: number): number {
  // 5s · 10s · 30s · 60s · then steady 5min · matches the CLAUDE.md
  // 2026-05-10 row "Adaptive compression + offline queue" lock.
  const stepsMs = [5_000, 10_000, 30_000, 60_000];
  const idx = Math.min(retryCount - 1, stepsMs.length - 1);
  const delay = retryCount >= stepsMs.length + 1
    ? 5 * 60_000
    : (stepsMs[Math.max(0, idx)] ?? 5_000);
  return Date.now() + delay;
}

function generateUploadId(): string {
  // crypto.randomUUID() requires HTTPS or localhost · fall back to a less
  // strong but functional generator on legacy contexts.
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `upl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
