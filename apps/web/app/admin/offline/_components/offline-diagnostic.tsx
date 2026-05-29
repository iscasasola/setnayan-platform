'use client';

// V2 Cutover Phase G — admin offline diagnostic (client side).
//
// CLAUDE.md 2026-05-28 third row. Renders the queue-status panel + the
// [Trigger sync now] button on `/admin/offline`. Imported via
// `dynamic({ ssr: false })` from the parent server-component page so the
// IDB calls land on the client without an SSR hop.
//
// Surface contract per the parent page header doc.

import { useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, XCircle, Zap } from 'lucide-react';

import { getOfflineQueueStats } from '@/lib/offline/db';
import { triggerSyncNow } from '@/lib/offline/sync-daemon';
import {
  SERVICE_CODES,
  SERVICE_LABELS,
  type OfflineQueueStat,
  type ServiceCode,
  type SyncRunSummary,
} from '@/lib/offline/types';

type Status = {
  daemonEnabled: boolean;
  swRegistered: boolean;
  idbAvailable: boolean;
};

type LastRunRow = SyncRunSummary | null;

export default function OfflineDiagnostic() {
  const [status, setStatus] = useState<Status>({
    daemonEnabled: false,
    swRegistered: false,
    idbAvailable: false,
  });
  const [stats, setStats] = useState<OfflineQueueStat[]>(
    SERVICE_CODES.map((service) => ({ service, pending: 0 })),
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRun, setLastRun] = useState<Record<ServiceCode, LastRunRow>>(
    () => SERVICE_CODES.reduce(
      (acc, service) => ({ ...acc, [service]: null }),
      {} as Record<ServiceCode, LastRunRow>,
    ),
  );
  const [busy, setBusy] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  // Status checks — daemon-enabled flag (env var) + SW registration +
  // IDB availability. Re-checks on every refreshKey bump.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const daemonEnabled =
      process.env.NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED === 'true';
    const idbAvailable = typeof indexedDB !== 'undefined';

    let cancelled = false;
    (async () => {
      let swRegistered = false;
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration(
            '/sw-offline.js',
          );
          swRegistered = Boolean(registration);
        } catch {
          swRegistered = false;
        }
      }
      if (cancelled) return;
      setStatus({ daemonEnabled, swRegistered, idbAvailable });
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  // Load queue stats on mount + refresh.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let cancelled = false;
    (async () => {
      try {
        const rows = await getOfflineQueueStats();
        if (cancelled) return;
        setStats(rows);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setLoadError(message);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function handleTriggerSync() {
    setBusy(true);
    try {
      const summary = await triggerSyncNow();
      const nextLastRun = SERVICE_CODES.reduce(
        (acc, service) => ({
          ...acc,
          [service]: summary.find((s) => s.service === service) ?? null,
        }),
        {} as Record<ServiceCode, LastRunRow>,
      );
      setLastRun(nextLastRun);
      // Re-pull stats so the table reflects any dequeues.
      setRefreshKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  function StatusPill({ ok, label }: { ok: boolean; label: string }) {
    return (
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden />
        ) : (
          <XCircle className="h-4 w-4 text-ink-soft" aria-hidden />
        )}
        <span className="text-sm text-ink">{label}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="m-card p-6">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <p className="m-eyebrow">Status</p>
            <p className="mt-1 text-sm text-ink-soft">
              Daemon health on this device.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setRefreshKey((k) => k + 1)}
            className="m-btn inline-flex items-center gap-2 text-sm"
            aria-label="Refresh status"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            Refresh
          </button>
        </header>
        <div className="grid gap-3 sm:grid-cols-3">
          <StatusPill
            ok={status.daemonEnabled}
            label={
              status.daemonEnabled
                ? 'Daemon enabled (env flag on)'
                : 'Daemon disabled (env flag off · default for pilot)'
            }
          />
          <StatusPill
            ok={status.swRegistered}
            label={
              status.swRegistered
                ? 'Service worker registered'
                : 'Service worker not registered'
            }
          />
          <StatusPill
            ok={status.idbAvailable}
            label={
              status.idbAvailable
                ? 'IndexedDB available'
                : 'IndexedDB not available'
            }
          />
        </div>
      </section>

      <section className="m-card p-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="m-eyebrow">Queue counts</p>
            <p className="mt-1 text-sm text-ink-soft">
              Items waiting to upload. Empty during pilot until V1.x
              handlers ship.
            </p>
          </div>
          <button
            type="button"
            onClick={handleTriggerSync}
            disabled={busy}
            className="m-btn inline-flex items-center gap-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Zap className="h-4 w-4" aria-hidden />
            {busy ? 'Syncing…' : 'Trigger sync now'}
          </button>
        </header>

        {loadError ? (
          <p className="rounded border border-orange/40 bg-orange/5 p-3 text-sm text-ink">
            Couldn&rsquo;t read queue stats: {loadError}
          </p>
        ) : (
          <div className="overflow-hidden rounded border border-ink/10">
            <table className="m-table w-full text-sm">
              <thead>
                <tr className="bg-cream-soft text-left">
                  <th className="px-4 py-2 font-medium text-ink-soft">Service</th>
                  <th className="px-4 py-2 font-medium text-ink-soft">Pending</th>
                  <th className="px-4 py-2 font-medium text-ink-soft">Last run</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((row) => {
                  const last = lastRun[row.service];
                  return (
                    <tr
                      key={row.service}
                      className="border-t border-ink/5 align-middle"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">
                          {SERVICE_LABELS[row.service]}
                        </div>
                        <div className="font-mono text-xs text-ink-soft">
                          {row.service}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-ink">
                        {row.pending}
                      </td>
                      <td className="px-4 py-3 text-ink-soft">
                        {last
                          ? `Synced ${last.synced} · Failed ${last.failed}`
                          : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
