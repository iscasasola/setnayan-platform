'use client';

// V2 Cutover Phase G — client-side mount for the offline daemon.
//
// CLAUDE.md 2026-05-28 third row "V1 → V2 ARCHITECTURAL PIVOT LOCK" —
// scaffolds the IndexedDB + service-worker daemon that holds offline
// captures for the 7 media services. This component:
//
//   1. Registers `/sw-offline.js` as a SECOND service worker (alongside
//      the existing `/sw.js` asset-cache worker registered in layout.tsx).
//   2. Calls `registerSyncDaemon()` to wire up Background Sync.
//   3. Listens for `TRIGGER_SYNC` messages from the SW (fired when
//      Background Sync wakes the worker) and runs `triggerSyncNow()`
//      to drain the queues.
//
// Renders nothing (returns null). Mounted in `app/layout.tsx` behind
// the `NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED` env feature flag — default
// OFF for pilot per CLAUDE.md 2026-05-28 third row so the 5-20 family
// cohort doesn't get surprised by a second SW or background-sync
// permission prompt.
//
// Idempotent: re-mount (e.g., on hot reload in dev) is safe because the
// SW registration check + Background Sync registration both no-op on
// repeated calls per their respective specs.

import { useEffect } from 'react';

import { registerSyncDaemon, triggerSyncNow } from '@/lib/offline/sync-daemon';

export function OfflineDaemonMount() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    let cancelled = false;

    // Register the second SW + arm Background Sync. Both calls are
    // best-effort — they no-op on browsers that don't support the
    // Background Sync API (Safari, Firefox) without throwing.
    const setupPromise = (async () => {
      try {
        await navigator.serviceWorker.register('/sw-offline.js');
      } catch {
        // Service worker registration failed (HTTPS gating, quota,
        // browser disabled). Silent — the daemon is a best-effort
        // enhancement; the surfaces still work online.
        return;
      }
      if (cancelled) return;
      await registerSyncDaemon();
    })();

    // Listen for `TRIGGER_SYNC` from the SW when Background Sync wakes
    // it up. Each tab gets the message; whichever tab runs it first
    // drains the queue (IDB transactions serialize cross-tab so this
    // is safe — at-most-once delivery per item even if every tab
    // tries to run the sync).
    const onMessage = (event: MessageEvent) => {
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'TRIGGER_SYNC') {
        // Fire-and-forget — `triggerSyncNow()` is itself best-effort
        // and never throws on bad input. Errors get surfaced in the
        // admin diagnostic, not via uncaught promise rejections.
        void triggerSyncNow();
      }
    };
    navigator.serviceWorker.addEventListener('message', onMessage);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('message', onMessage);
      // The setup promise is intentionally not cancelled — once SW
      // registration starts, letting it finish is safer than racing
      // a cleanup (and re-mounting later would just no-op anyway).
      void setupPromise;
    };
  }, []);

  return null;
}
