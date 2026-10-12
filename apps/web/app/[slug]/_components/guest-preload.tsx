'use client';

/**
 * GuestPreload — Task #13 day-of PWA Phase 1.
 *
 * Mounts inside the public guest invitation surface (apps/web/app/[slug]/page.tsx)
 * and, after hydration, posts a `{ type: 'PRELOAD_ASSETS', urls: [...] }`
 * message to the active service worker. The SW handler at sw.js:188 warms the
 * listed URLs into IMAGE_CACHE so the guest's next visit (e.g. at the venue
 * with weak WiFi) is served from cache.
 *
 * Phase 1 asset list — kept under 5MB total to stay well below the 100MB
 * Cache & Offline Strategy budget [[reference_setnayan_cache_strategy]]:
 *   - `/manifest.json` (PWA manifest)
 *   - `/icon-192.svg` + `/icon-512.svg` (app icons / favicon)
 *   - `/{slug}` itself (the SW's navigation fallback path so reload-while-offline
 *     hits SHELL_CACHE)
 *
 * V1.1 follow-up (per Task #9 audit, CLAUDE.md decision-log row 2026-05-22):
 *   per-guest table-assignment Cache API write — needs guest-session-scoped
 *   cache keys + a separate Cache than IMAGE_CACHE so per-guest data doesn't
 *   evict via the 500-entry LRU. Architecture call required before V1.1 ship.
 *
 * Graceful degradation: if `navigator.serviceWorker` isn't available (e.g.
 * Safari Private mode, or the SW hasn't registered yet on first paint), the
 * effect is a no-op. The page still renders correctly — PWA preload is a
 * resilience layer, not a hard dependency.
 */

import { useEffect } from 'react';

type Props = { eventSlug: string };

export function GuestPreload({ eventSlug }: Props) {
  useEffect(() => {
    // Defensive — only post when SW is actually registered + controlling the page.
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const post = () => {
      const sw = navigator.serviceWorker.controller;
      if (!sw) return; // no controlling SW yet — skip silently
      sw.postMessage({
        type: 'PRELOAD_ASSETS',
        urls: [
          '/manifest.json',
          '/icon-192.svg',
          '/icon-512.svg',
          // The slug itself — SW's `fetch` handler caches successful navigations
          // into SHELL_CACHE, so visiting once warms the offline fallback.
          `/${eventSlug}`,
        ],
      });
    };

    // If the SW is already controlling the page, fire immediately. Otherwise
    // wait for it to become ready (first-load case) before posting.
    if (navigator.serviceWorker.controller) {
      post();
    } else {
      navigator.serviceWorker.ready.then(post).catch(() => {
        // Best-effort — SW not available or errored. The page still works.
      });
    }
  }, [eventSlug]);

  return null;
}
