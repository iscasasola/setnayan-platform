// V2 Cutover Phase G — sync daemon orchestrator for the 7 offline queues.
//
// CLAUDE.md 2026-05-28 third row "V1 → V2 ARCHITECTURAL PIVOT LOCK" lists
// 7 media services that need offline capture + queued upload during pilot
// venues with weak WiFi. This module is the bus that walks each queue and
// fans out to per-service handlers under ./service-handlers/.
//
// Phase G ships SCAFFOLDING ONLY — per-service handlers return
// `{ ok: false, error: 'V1.x post-pilot' }` placeholders. The orchestrator
// is the real shape; wiring V1.x handlers to real upload paths is the
// last-mile job for each service team (Phase G+1..Phase G+7).
//
// Two surfaces consume this module:
//   1. The service worker (`sw-offline.js`) listens for `sync` events with
//      tag `setnayan-offline-sync` (Background Sync API) and posts a
//      `TRIGGER_SYNC` message to all open clients. The client's
//      `offline-daemon-mount.tsx` receives that message and calls
//      `triggerSyncNow()`.
//   2. The admin diagnostic page (`/admin/offline`) renders a
//      [Trigger sync now] button that calls `triggerSyncNow()` directly
//      so admins can validate the loop end-to-end without waiting for the
//      browser's Background Sync heuristic to fire.
//
// All functions are client-only. They throw on the server (no
// `navigator` / `indexedDB`) — callers should gate on a `'use client'`
// boundary or `typeof window !== 'undefined'`.

import {
  dequeueOfflineItem,
  listOfflineItems,
  updateOfflineItem,
} from './db';
import { syncOne as syncOnePapic } from './service-handlers/papic-handler';
import { syncOne as syncOnePanood } from './service-handlers/panood-handler';
import { syncOne as syncOnePatiktok } from './service-handlers/patiktok-handler';
import { syncOne as syncOnePabati } from './service-handlers/pabati-handler';
import { syncOne as syncOneSde } from './service-handlers/sde-handler';
import { syncOne as syncOneCameraBridge } from './service-handlers/camera-bridge-handler';
import { syncOne as syncOneLiveWall } from './service-handlers/live-wall-handler';
import {
  SERVICE_CODES,
  type OfflineItem,
  type ServiceCode,
  type SyncResult,
  type SyncRunSummary,
} from './types';

// Background Sync API tag — picked up by `sw-offline.js`. Stays in sync
// (no pun intended) between the service worker and this module via this
// shared constant export so a future rename only touches one place.
export const OFFLINE_SYNC_TAG = 'setnayan-offline-sync';

/**
 * Per-service handler dispatch table. Keeps the orchestrator agnostic to
 * which handler ships next — `triggerSyncNow()` walks `SERVICE_CODES`
 * (canonical order from types.ts) and looks up the handler here.
 *
 * Phase G handlers are all stubs returning `{ ok: false, error: 'V1.x
 * post-pilot' }`. Replacing one of these entries with a real upload
 * implementation is the V1.x last-mile job.
 */
const HANDLERS: Record<ServiceCode, (item: OfflineItem) => Promise<SyncResult>> = {
  papic: syncOnePapic,
  panood: syncOnePanood,
  patiktok: syncOnePatiktok,
  pabati: syncOnePabati,
  sde: syncOneSde,
  camera_bridge: syncOneCameraBridge,
  live_wall: syncOneLiveWall,
};

/**
 * Register the daemon with the browser's Background Sync API so the
 * service worker fires `OFFLINE_SYNC_TAG` when connectivity returns
 * (or on its own browser-vendor heuristic).
 *
 * Returns silently on browsers that don't support Background Sync
 * (Safari + most iOS browsers as of 2026-05) — the daemon still works
 * via the admin diagnostic's [Trigger sync now] button + future per-
 * service in-app triggers in V1.x.
 *
 * Called once from `<OfflineDaemonMount />` on mount. Idempotent: calling
 * `sync.register()` with the same tag twice is harmless per spec.
 */
export async function registerSyncDaemon(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    // Background Sync API is gated behind `sync` on the registration. Not
    // every browser exposes it — feature-detect rather than rely on
    // `@types/web` narrowing (which marks it optional).
    const syncManager = (registration as ServiceWorkerRegistration & {
      sync?: { register: (tag: string) => Promise<void> };
    }).sync;
    if (!syncManager) {
      // Browser doesn't expose Background Sync (Safari/Firefox/iOS as of
      // this writing). The admin diagnostic + future in-app triggers
      // still work — we just skip the OS-level callback registration.
      return;
    }
    await syncManager.register(OFFLINE_SYNC_TAG);
  } catch {
    // Service worker not active, sync registration blocked by browser
    // permission, or some other transient failure. Don't throw — the
    // daemon is a best-effort enhancement, not a hard dependency.
  }
}

/**
 * Walk every queue and attempt to upload each item via its handler.
 *
 * Per-item flow:
 *   1. Call handler.
 *   2. On `{ ok: true }` → dequeue.
 *   3. On `{ ok: false, error }` → increment `retry_count`, stash
 *      `last_error`, leave in queue. Admin diagnostic surfaces the
 *      error for the operator.
 *
 * Returns a per-service summary so the admin diagnostic can show
 * "Synced 3 · Failed 1" for each row after the button click.
 *
 * Each service is processed in parallel (Promise.all over SERVICE_CODES)
 * but items within a service drain sequentially — keeps the sync deterministic
 * per service (handlers may need ordering: e.g., Papic photo 1 before
 * photo 2 if downstream depends on file index) and avoids hammering a
 * single backend endpoint with N concurrent uploads from one queue.
 */
export async function triggerSyncNow(): Promise<SyncRunSummary[]> {
  if (typeof window === 'undefined') {
    return SERVICE_CODES.map((service) => ({ service, synced: 0, failed: 0 }));
  }

  return Promise.all(
    SERVICE_CODES.map(async (service) => {
      const handler = HANDLERS[service];
      let items: OfflineItem[] = [];
      try {
        items = await listOfflineItems(service);
      } catch {
        return { service, synced: 0, failed: 0 };
      }

      let synced = 0;
      let failed = 0;

      for (const item of items) {
        let result: SyncResult;
        try {
          result = await handler(item);
        } catch (err) {
          result = {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }

        if (result.ok) {
          try {
            await dequeueOfflineItem(service, item.item_id);
            synced += 1;
          } catch {
            // Dequeue failed — IDB transaction error, quota, etc. Count
            // as failed so admin sees the discrepancy; item stays in
            // queue for next sync pass.
            failed += 1;
          }
        } else {
          try {
            await updateOfflineItem(service, {
              ...item,
              retry_count: item.retry_count + 1,
              last_error: result.error,
            });
          } catch {
            // Update failed — surface as a sync failure for the admin
            // diagnostic without losing the original item.
          }
          failed += 1;
        }
      }

      return { service, synced, failed };
    }),
  );
}
