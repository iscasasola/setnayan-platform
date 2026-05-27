'use client';

/**
 * OfflineSyncProvider (V2 offline architecture · top-level mount).
 *
 * Wires the IndexedDB vault + media-pipeline interceptor to React state
 * so any consumer surface can render the queue chip ("12 queued · 3
 * uploading · medium") and trigger a manual flush. The provider also
 * runs the background auto-synchronization daemon described in
 * blueprint Part 5 § 3 · "The exact millisecond the user or technical
 * crew leaves the dead venue zone and picks up a stable cellular data
 * or home connection post-event, the background worker automatically
 * triggers a mass upload synchronization."
 *
 * Mount near the root of every capture-surface tree (Papic seat,
 * Pabati guestbook, Patiktok booth, Panood camera op, SDE callback
 * receiver, Camera Bridge UI, Live Wall projector handshake).
 *
 * Companions:
 *   lib/indexedDB.ts          · IndexedDB primitives
 *   lib/mediaPipeline.ts      · intake + flush
 *
 * Spec corpus: V2_Cutover_Plan_2026-05-28.md Phase G. Blueprint Part 5.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { flushPendingQueue } from '@/lib/mediaPipeline';
import { vaultStats, evictExpired } from '@/lib/indexedDB';

export type NetworkMode = 'strong' | 'medium' | 'weak' | 'offline' | 'unknown';

export type OfflineSyncState = {
  /** Wall-clock online state · derived from navigator.onLine + listeners. */
  is_online: boolean;
  /** Recent bandwidth estimate · drives the upload chip mode label. */
  network_mode: NetworkMode;
  /** Vault counts · refreshed every heartbeat. */
  queued_count: number;
  uploading_count: number;
  failed_count: number;
  done_count: number;
  estimated_bytes_pending: number;
  /** True while flushPendingQueue() is in flight. */
  is_flushing: boolean;
  /** Timestamp of the most recent successful flush attempt. */
  last_flush_at: number | null;
  /** Result of most recent flush · used for the upload chip's transient state. */
  last_flush_summary: {
    attempted: number;
    succeeded: number;
    failed: number;
    remaining_queued: number;
  } | null;
};

export type OfflineSyncApi = OfflineSyncState & {
  /** Force a flush attempt regardless of heartbeat schedule. */
  flushNow: () => Promise<void>;
  /** Force an eviction sweep · honors the blueprint 7-day TTL. */
  evictExpiredNow: (ttlDays?: number) => Promise<number>;
};

const HEARTBEAT_MS = 30_000; // 30s · matches the "rolling 30-second bandwidth estimator" memory rule
const STATS_REFRESH_MS = 5_000;
const EVICTION_INTERVAL_MS = 60 * 60_000; // hourly sweep

const OfflineSyncContext = createContext<OfflineSyncApi | null>(null);

const initialState: OfflineSyncState = {
  is_online: typeof navigator === 'undefined' ? true : navigator.onLine,
  network_mode: 'unknown',
  queued_count: 0,
  uploading_count: 0,
  failed_count: 0,
  done_count: 0,
  estimated_bytes_pending: 0,
  is_flushing: false,
  last_flush_at: null,
  last_flush_summary: null,
};

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OfflineSyncState>(initialState);
  const flushInFlightRef = useRef(false);

  // ---- Refresh vault stats periodically ------------------------------------
  const refreshStats = useCallback(async () => {
    try {
      const stats = await vaultStats();
      setState((prev) => ({
        ...prev,
        queued_count: stats.queued,
        uploading_count: stats.uploading,
        failed_count: stats.failed,
        done_count: stats.done,
        estimated_bytes_pending: stats.estimated_bytes_pending,
      }));
    } catch {
      // SSR contexts or browsers without IDB · silent skip.
    }
  }, []);

  // ---- Single canonical flush wrapper · guards against re-entry ------------
  const flushNow = useCallback(async () => {
    if (flushInFlightRef.current) return;
    flushInFlightRef.current = true;
    setState((prev) => ({ ...prev, is_flushing: true }));
    try {
      const summary = await flushPendingQueue();
      setState((prev) => ({
        ...prev,
        is_flushing: false,
        last_flush_at: Date.now(),
        last_flush_summary: summary,
      }));
      await refreshStats();
    } catch {
      setState((prev) => ({ ...prev, is_flushing: false }));
    } finally {
      flushInFlightRef.current = false;
    }
  }, [refreshStats]);

  const evictExpiredNow = useCallback(async (ttlDays?: number) => {
    try {
      const count = await evictExpired(ttlDays);
      await refreshStats();
      return count;
    } catch {
      return 0;
    }
  }, [refreshStats]);

  // ---- Network state listeners --------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onOnline = () => {
      setState((prev) => ({ ...prev, is_online: true, network_mode: 'unknown' }));
      // Daemon trigger · the millisecond connectivity returns, flush.
      void flushNow();
    };
    const onOffline = () => {
      setState((prev) => ({ ...prev, is_online: false, network_mode: 'offline' }));
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Read NetworkInformation API if available · feeds network_mode.
    type NavWithConn = Navigator & {
      connection?: {
        effectiveType?: string;
        downlink?: number;
        addEventListener?: (ev: string, cb: () => void) => void;
        removeEventListener?: (ev: string, cb: () => void) => void;
      };
    };
    const conn = (navigator as NavWithConn).connection;
    const computeMode = (): NetworkMode => {
      if (!navigator.onLine) return 'offline';
      if (!conn) return 'unknown';
      const downlink = conn.downlink ?? 0;
      if (downlink >= 5) return 'strong';
      if (downlink >= 1) return 'medium';
      return 'weak';
    };
    const updateMode = () =>
      setState((prev) => ({ ...prev, network_mode: computeMode() }));

    updateMode();
    conn?.addEventListener?.('change', updateMode);

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      conn?.removeEventListener?.('change', updateMode);
    };
  }, [flushNow]);

  // ---- Heartbeats: stats + flush + eviction --------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    void refreshStats();

    const statsTimer = window.setInterval(() => void refreshStats(), STATS_REFRESH_MS);
    const flushTimer = window.setInterval(() => {
      if (!navigator.onLine) return;
      void flushNow();
    }, HEARTBEAT_MS);
    const evictTimer = window.setInterval(() => void evictExpiredNow(), EVICTION_INTERVAL_MS);

    return () => {
      window.clearInterval(statsTimer);
      window.clearInterval(flushTimer);
      window.clearInterval(evictTimer);
    };
  }, [refreshStats, flushNow, evictExpiredNow]);

  // ---- Service Worker auto-sync registration (best-effort) -----------------
  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('SyncManager' in window)) return;

    navigator.serviceWorker.ready.then((reg) => {
      const swReg = reg as ServiceWorkerRegistration & {
        sync?: { register: (tag: string) => Promise<void> };
      };
      swReg.sync?.register('setnayan-media-flush').catch(() => {
        // Background sync isn't critical · the in-page heartbeat covers it.
      });
    }).catch(() => {
      // No SW · in-page daemon still works.
    });
  }, []);

  // ---- Context value -------------------------------------------------------
  const value = useMemo<OfflineSyncApi>(
    () => ({
      ...state,
      flushNow,
      evictExpiredNow,
    }),
    [state, flushNow, evictExpiredNow],
  );

  return (
    <OfflineSyncContext.Provider value={value}>
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync(): OfflineSyncApi {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) {
    throw new Error('useOfflineSync must be used inside <OfflineSyncProvider>.');
  }
  return ctx;
}

/**
 * Compact upload-chip surface · matches the "12 queued · 3 uploading · medium"
 * pattern from the CLAUDE.md 2026-05-10 row "Adaptive compression + offline
 * queue." Drop into the capture surface's top bar.
 */
export function UploadChip({ className }: { className?: string }) {
  const sync = useOfflineSync();
  const label = chipLabel(sync);
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        className ??
        'inline-flex items-center gap-2 rounded-full border border-cream-300 bg-cream-50 px-3 py-1 text-xs font-medium text-ink'
      }
    >
      <span
        aria-hidden
        className={modeDotClass(sync.network_mode)}
      />
      <span>{label}</span>
      {sync.failed_count > 0 ? (
        <button
          type="button"
          onClick={() => void sync.flushNow()}
          className="ml-1 rounded-full border border-terracotta/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-terracotta hover:bg-terracotta/10"
          disabled={sync.is_flushing}
        >
          {sync.is_flushing ? 'Retrying…' : 'Retry'}
        </button>
      ) : null}
    </div>
  );
}

function chipLabel(s: OfflineSyncState): string {
  const segments: string[] = [];
  if (s.queued_count > 0) segments.push(`${s.queued_count} queued`);
  if (s.uploading_count > 0) segments.push(`${s.uploading_count} uploading`);
  if (s.failed_count > 0) segments.push(`${s.failed_count} retrying`);
  if (segments.length === 0) segments.push('all synced');
  segments.push(s.network_mode);
  return segments.join(' · ');
}

function modeDotClass(mode: NetworkMode): string {
  const base = 'inline-block size-2 rounded-full';
  switch (mode) {
    case 'strong':  return `${base} bg-emerald-500`;
    case 'medium':  return `${base} bg-amber-500`;
    case 'weak':    return `${base} bg-amber-300`;
    case 'offline': return `${base} bg-rose-500`;
    default:        return `${base} bg-cream-400`;
  }
}
