/**
 * /admin/offline — V2 Phase G offline-daemon diagnostic.
 *
 * WHY · Lets the owner verify the IndexedDB + service-worker offline-queue
 *       scaffolding is alive on a given device. Phase G ships
 *       scaffolding only — every per-service handler returns
 *       `{ ok: false, error: 'V1.x post-pilot' }`, so the queues stay
 *       empty during pilot (no production code paths enqueue items yet).
 *       This page is the admin-side smoke test for "did the daemon
 *       initialise? does IndexedDB respond? is the service worker
 *       registered?" — the read-only validation surface for the
 *       substrate per CLAUDE.md 2026-05-28 third row.
 *
 * Surface contract:
 *   • Header eyebrow + display heading + brand-voice intro.
 *   • Status panel — daemon enabled? · SW registered? · IDB available?
 *   • Queue table — one row per service · pending count · last error
 *     (if any) — refreshes on [Refresh] click.
 *   • [Trigger sync now] button — runs `triggerSyncNow()` + shows a
 *     per-service summary (Synced N · Failed N).
 *   • Note panel — "Offline daemon is scaffolded for pilot. Service-
 *     specific sync handlers ship V1.x post-pilot." Brand voice per
 *     [[feedback_setnayan_no_dev_text_post_launch]] — no engineering
 *     jargon, no "TODO" markers in user-facing copy.
 *
 * Implementation note: IndexedDB is client-only, so this page bootstraps
 * via `dynamic({ ssr: false })` against an inner client component. The
 * outer page export is a thin server-component wrapper that sets
 * `metadata` + renders the client child.
 *
 * Cross-references:
 *   • Lib: apps/web/lib/offline/{types,db,sync-daemon}.ts +
 *     service-handlers/*.ts (7 stubs).
 *   • Service worker: apps/web/public/sw-offline.js
 *   • Mount: apps/web/app/_components/offline-daemon-mount.tsx
 *   • Env feature flag: NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED (default OFF
 *     for pilot per CLAUDE.md 2026-05-28 third row).
 *   • Nav entry: apps/web/app/admin/_components/admin-sidebar.tsx
 *     (Operations group · alongside Telemetry).
 *   • Decision log: CLAUDE.md 2026-05-28 third row.
 */

import dynamic from 'next/dynamic';

export const metadata = { title: 'Offline daemon · Admin' };

// Client-only because IndexedDB lives on `window`. Server-render would
// throw on `indexedDB.open`. `ssr: false` lets Next.js render a tiny
// loading shell during hydration; the panel mounts on the client.
const OfflineDiagnostic = dynamic(() => import('./_components/offline-diagnostic'), {
  ssr: false,
  loading: () => (
    <div className="m-card p-6 text-sm text-ink-soft">
      Loading offline diagnostic…
    </div>
  ),
});

export default function AdminOfflinePage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="m-eyebrow">Operations</p>
        <h1 className="m-display-tight mt-2 text-3xl text-ink">Offline daemon</h1>
        <p className="mt-3 max-w-2xl text-sm text-ink-soft">
          The offline daemon scaffolds IndexedDB queues + a background-sync
          service worker for the seven media services. During pilot the
          queues stay empty — the per-service upload paths land alongside
          each service&rsquo;s V1.x refresh.
        </p>
      </header>

      <OfflineDiagnostic />

      <aside className="m-card border border-orange/15 bg-orange/5 p-6">
        <p className="m-eyebrow text-orange">Note</p>
        <p className="mt-2 text-sm text-ink-soft">
          Offline daemon is scaffolded for pilot. Service-specific sync
          handlers ship with the next refresh.
        </p>
      </aside>
    </div>
  );
}
