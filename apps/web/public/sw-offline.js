// Setnayan offline daemon v0.1 — Phase G scaffolding · V2 Cutover ·
// CLAUDE.md 2026-05-28 third row.
//
// This is a SEPARATE service worker from the existing `/sw.js` (asset
// cache layer). The existing SW handles the read path (cache-first
// images / stale-while-revalidate static / fonts); this SW handles the
// WRITE path (offline-captured media items that need to be uploaded
// when connectivity returns).
//
// Phase G ships scaffolding only:
//   - Listen for `sync` events tagged `setnayan-offline-sync` (Background
//     Sync API, fired by the browser when connectivity returns after the
//     daemon called sync.register()). Post a `{ type: 'TRIGGER_SYNC' }`
//     message to every open client so they can run `triggerSyncNow()`
//     from `lib/offline/sync-daemon.ts`.
//   - Listen for `message` events with `{ type: 'CHECK_QUEUE_STATUS' }`
//     so a client can ask the SW to broadcast a status check. Today the
//     status itself is read directly via `getOfflineQueueStats()` from
//     IDB on the client; the SW echo is forward-plumbing for V1.x when
//     the admin diagnostic may want a single push-broadcast across tabs.
//   - NO fetch interception. The existing /sw.js owns the read cache;
//     touching fetch here would risk double-handling.
//
// Feature flag: this SW only registers when
// NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED='true' — default OFF for pilot
// per CLAUDE.md 2026-05-28 third row (don't surprise the 5-20 cohort
// with a second SW). The client mount component
// (apps/web/app/_components/offline-daemon-mount.tsx) gates registration.

const OFFLINE_SYNC_TAG = 'setnayan-offline-sync';

self.addEventListener('install', (event) => {
  // Activate immediately so the daemon is live without a reload.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  // Take control of open clients on first activation so the message
  // channel works without a page reload.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('sync', (event) => {
  if (event.tag !== OFFLINE_SYNC_TAG) return;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clients) {
        client.postMessage({ type: 'TRIGGER_SYNC' });
      }
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (!event.data || typeof event.data !== 'object') return;

  if (event.data.type === 'CHECK_QUEUE_STATUS') {
    // Broadcast the status-check request to every open client. Clients
    // hold the IDB connection so they can answer the question; the SW
    // is just the relay. Useful in V1.x when one tab updates IDB and
    // other tabs need to refresh their queue badge.
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: 'CHECK_QUEUE_STATUS' });
      }
    });
  }
});
