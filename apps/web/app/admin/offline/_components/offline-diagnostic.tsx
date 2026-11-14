'use client';

// V2 Cutover Phase G — admin offline diagnostic (client side).
//
// CLAUDE.md 2026-05-28 third row. Renders the queue-status panel + the
// [Trigger sync now] button on `/admin/offline`. Imported via
// `dynamic({ ssr: false })` from the parent server-component page so the
// IDB calls land on the client without an SSR hop.
//
// Surface contract per the parent page header doc.

// 🪤 THIS FILE RENDERED className="m-table" AND THERE IS NO `.m-table` ANYWHERE
// IN THE REPO. `.m-card` exists, so the name read plausible and styled nothing —
// the same silent-absence failure as a phantom column or a blocked iframe: the
// only symptom is an absence. The class is REMOVED with the hand-rolled table,
// not ported across and not "fixed" by adding a rule to globals.css.
// Corrected 2026-08-17.

import { useEffect, useState } from 'react';
import { CheckCircle2, Inbox, RefreshCw, XCircle, Zap } from 'lucide-react';

import { ConsoleTable } from '@/app/admin/_components/console-table';
import { Badge, Row, Rows, Sec } from '@/app/admin/app-performance/_components/insights-parts';
import { ActionButton } from '@/components/action-button';
import { getOfflineQueueStats } from '@/lib/offline/db';
import { triggerSyncNow } from '@/lib/offline/sync-daemon';
import {
  SERVICE_CODES,
  SERVICE_LABELS,
  type OfflineQueueStat,
  type ServiceCode,
  type SyncRunSummary,
} from '@/lib/offline/types';
import { envFlagEnabled } from '@/lib/env-flag';

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
      envFlagEnabled(process.env.NEXT_PUBLIC_OFFLINE_DAEMON_ENABLED);
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

  /** One status line: a hairline row with ✓ or ✕ at the right (approved drawing, insights.html › Offline daemon). */
  function StatusRow({ ok, title, sub }: { ok: boolean; title: string; sub?: string }) {
    return (
      <Row
        data="offline-status"
        title={title}
        sub={sub}
        trail={
          <Badge tone={ok ? 'ok' : undefined}>
            {ok ? (
              <CheckCircle2 className="h-3.5 w-3.5" aria-label="yes" />
            ) : (
              <XCircle className="h-3.5 w-3.5" aria-label="no" />
            )}
          </Badge>
        }
      />
    );
  }

  return (
    <div>
      <section aria-label="Status">
        <Sec
          title="Status"
          about="Daemon health on this device."
          right={
            <ActionButton
              tone="neutral"
              icon={<RefreshCw />}
              label="Refresh"
              name="Refresh status"
              className="min-h-11"
              onClick={() => setRefreshKey((k) => k + 1)}
            />
          }
        />
        <Rows label="Daemon health on this device" data="offline-status">
          <StatusRow
            ok={status.daemonEnabled}
            title={status.daemonEnabled ? 'Daemon enabled' : 'Daemon disabled'}
            sub={status.daemonEnabled ? 'env flag on' : 'env flag off · default for pilot'}
          />
          <StatusRow
            ok={status.swRegistered}
            title={status.swRegistered ? 'Service worker registered' : 'Service worker not registered'}
          />
          <StatusRow
            ok={status.idbAvailable}
            title={status.idbAvailable ? 'IndexedDB available' : 'IndexedDB not available'}
          />
        </Rows>
      </section>

      <section aria-label="Queue counts">
        <Sec
          title="Queue counts"
          about="Items waiting to upload. Empty during pilot until V1.x handlers ship."
          right={
            <ActionButton
              tone="neutral"
              icon={<Zap />}
              label={busy ? 'Syncing…' : 'Trigger sync now'}
              className="min-h-11"
              onClick={handleTriggerSync}
              disabled={busy}
            />
          }
        />

        {/* `readPermitted` is honestly `true` here for a different reason than
            on the Supabase surfaces: this reads the browser's own IndexedDB, so
            there is no RLS that could silently filter it and no denial mode to
            confuse with emptiness. The only failure this read has is the throw,
            which arrives as `loadError` and becomes NOT MEASURED below. */}
        <ConsoleTable
          rows={loadError ? null : stats}
          readPermitted
          readError={loadError ? { message: loadError } : null}
          reads="the offline queue on this device"
          label="Offline queue counts"
          minWidth="18rem"
          rowKey={(row) => row.service}
          empty={{
            Icon: Inbox,
            title: 'No services registered',
            blurb:
              'The queue lists one row per offline-capable service. An empty list means none is registered on this device yet.',
          }}
          columns={[
            {
              header: 'Service',
              cell: (row) => (
                <>
                  <div className="font-medium text-ink">{SERVICE_LABELS[row.service]}</div>
                  <div className="font-mono text-xs text-ink/70">{row.service}</div>
                </>
              ),
            },
            {
              header: 'Pending',
              align: 'right',
              mono: true,
              cell: (row) => row.pending,
            },
            {
              header: 'Last run',
              hideBelow: 'md',
              cell: (row) => {
                const last = lastRun[row.service];
                return (
                  <span className="whitespace-nowrap text-ink/70">
                    {last ? `Synced ${last.synced} · Failed ${last.failed}` : '—'}
                  </span>
                );
              },
            },
          ]}
        />
      </section>
    </div>
  );
}
