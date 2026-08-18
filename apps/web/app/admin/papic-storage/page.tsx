import { HardDrive, CloudOff } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  aggregateEventStorage,
  webCopyBytes,
  BYTES_PER_GB,
  DEFAULT_WEB_COPY_CEILING_GB,
  type StorageRow,
} from '@/lib/papic-storage-telemetry';
import { BackfillTilesButton } from './backfill-tiles-button';
import { listStrandedDriveCopies } from '@/lib/papic-drive-copy-retry';
import { DRIVE_COPY_RETRY_CEILING } from '@/lib/papic-drive-copy-retry-core';
import { PageMasthead } from '@/app/_components/page-masthead';
import { KpiStatCard } from '@/app/admin/_components/kpi-stat-card';
import { ConsoleTable } from '@/app/admin/_components/console-table';

// Read-only admin readout for the Papic storage byte-telemetry (migration
// 20270718100867). Surfaces the two numbers the pricing councils flagged as
// UNMEASURED and asked to lock from real data before hard-coding:
//   • the real web-copy / original RATIO (the modelled "~8%", now born-AVIF), and
//   • the per-event forever-hosted web-copy size (the 40 GB governor was retired
//     2026-07-11 — storage is bounded by born-AVIF compression + the 3-month
//     full-res drop, not a hosting ceiling).
// The whole point: watch these across the first ~50 real Unli events to confirm
// the ₱15,000 Unli capture cap + web-copy ratio hold up, not a guess.

export const dynamic = 'force-dynamic';

const ROW_CAP = 200_000; // safety cap on the readout fetch (per table)

/** The stranded-copies read's own cap, passed to its table as `cap`. */
const STRANDED_LIMIT = 100;

type Row = StorageRow & { event_id: string | null };

function gb(bytes: number): string {
  return `${(bytes / BYTES_PER_GB).toFixed(2)} GB`;
}
function pct(ratio: number | null): string {
  return ratio == null ? '—' : `${(ratio * 100).toFixed(1)}%`;
}

export default async function PapicStoragePage() {
  await requireAdmin();
  const admin = createAdminClient();

  const [photos, guests] = await Promise.all([
    admin
      .from('papic_photos')
      .select('event_id, orig_bytes, display_bytes, tile_bytes, thumb_bytes')
      .limit(ROW_CAP),
    admin
      .from('papic_guest_captures')
      .select('event_id, orig_bytes, display_bytes, tile_bytes, thumb_bytes')
      .limit(ROW_CAP),
  ]);

  /**
   * ⚠ NEITHER READ'S ERROR WAS EVER BOUND, ON A PAGE WHOSE ONLY JOB IS
   * MEASUREMENT. `(photos.data ?? [])` turned a refused read into an empty list,
   * and this page then printed "No measured captures yet — telemetry populates
   * as new Papic photos are taken", i.e. it blamed the absence on nobody having
   * taken a photo. The four tiles above it read 0.0%, 0, 0.00 GB and 0 at the
   * same time. A metrics page that prints zero over a broken read is not
   * slightly wrong: it is a graph saying the business stopped.
   *
   * EITHER read failing makes the aggregate unsound — the totals are a sum over
   * both tables, so a partial answer is a WRONG answer, not a smaller one. So the
   * whole readout resolves to NOT MEASURED unless both succeeded.
   * Corrected 2026-08-17.
   */
  const storageError = photos.error ?? guests.error ?? null;
  const rows: Row[] | null = storageError
    ? null
    : [...((photos.data as Row[] | null) ?? []), ...((guests.data as Row[] | null) ?? [])];
  const measured = rows ?? [];

  // Group by event.
  const byEvent = new Map<string, StorageRow[]>();
  for (const r of measured) {
    if (!r.event_id) continue;
    const list = byEvent.get(r.event_id) ?? [];
    list.push(r);
    byEvent.set(r.event_id, list);
  }

  // Event display names for the ones we have data for.
  const eventIds = [...byEvent.keys()];
  const nameById = new Map<string, string>();
  // The numbers stay true when this fails — only the names go. Said out loud
  // because a column of dashes on a telemetry page reads as missing DATA.
  let eventNamesUnresolved = false;
  if (eventIds.length > 0) {
    const { data: evs, error: evsError } = await admin
      .from('events')
      .select('event_id, display_name')
      .in('event_id', eventIds);
    eventNamesUnresolved = Boolean(evsError) || evs === null;
    for (const e of evs ?? []) {
      nameById.set(e.event_id as string, (e.display_name as string | null) ?? '—');
    }
  }

  const perEventRows = eventIds
    .map((id) => ({
      eventId: id,
      name: nameById.get(id) ?? '—',
      summary: aggregateEventStorage(byEvent.get(id) ?? []),
    }))
    .sort((a, b) => b.summary.totalWebCopyGb - a.summary.totalWebCopyGb);
  const perEvent = rows === null ? null : perEventRows;

  // Portfolio aggregate — the single "real 8%" number, weighted over every
  // measured still (not an average of per-event ratios, which small events skew).
  let totalMeasuredOrig = 0;
  let totalMeasuredStillWeb = 0;
  let totalWebBytes = 0;
  let measuredStills = 0;
  for (const r of measured) {
    // webCopyBytes(), not a local sum: the tile derivative joined this total on
    // 2026-08-13 and a second hand-written copy of the rule is how one of them
    // silently keeps under-reporting.
    const web = webCopyBytes(r);
    totalWebBytes += web > 0 ? web : 0;
    const orig = r.orig_bytes ?? 0;
    if (orig > 0) {
      totalMeasuredOrig += orig;
      totalMeasuredStillWeb += web > 0 ? web : 0;
      measuredStills += 1;
    }
  }
  const portfolioRatio =
    totalMeasuredOrig > 0 ? totalMeasuredStillWeb / totalMeasuredOrig : null;
  const overCeiling = rows === null ? null : perEventRows.filter((e) => e.summary.overWebCopyCeiling).length;
  const capped = measured.length >= ROW_CAP * 2;

  // Drive copies stranded past the retry ceiling (Papic storage PR-4). Each one
  // is a couple's full-res original that never reached their Google Drive after
  // every retry — so the full-res drop is DEFERRING its raw forever (a permanent
  // hot cost). Surfaced so an admin can act: reconnect the couple's Drive, hand
  // off the originals, or accept the retained raw.
  //
  // ⚠ THE CATCH USED TO RETURN `{ total: 0, rows: [] }`, WHICH RENDERED THE
  // GREEN "None stranded — every Drive copy is landing." A thrown read was
  // reported to the reader as an all-clear, in the reassuring colour. `null` now
  // means not measured, and the failure says so.
  const stranded = await listStrandedDriveCopies(STRANDED_LIMIT).catch(() => null);

  // How many captures still have no wall-size copy. `null` when a count could
  // not be measured — filing an unmeasured number under "nothing to do" puts it
  // in the one place a reader has been told they need not look.
  const pendingTiles = await (async (): Promise<number | null> => {
    const [a, b] = await Promise.all([
      admin.from('papic_photos').select('*', { count: 'exact', head: true }).is('tile_r2_key', null),
      admin
        .from('papic_guest_captures')
        .select('*', { count: 'exact', head: true })
        .is('tile_r2_key', null),
    ]);
    if (a.error || b.error || a.count == null || b.count == null) return null;
    return a.count + b.count;
  })().catch(() => null);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <PageMasthead
        title="Papic storage telemetry"
      />

      {/* WALL-SIZE COPIES — the doorway for the tile backfill. The wall renders
          105–192 CSS px squares (310–383 device px); the 320px thumb upscaled
          into that and the 1280px display copy is ~4x heavier than the tile
          needs. Rows captured before 2026-08-13 have no tile and fall back to
          display, so this is where they get one. */}
      <section className="rounded-2xl border border-ink/10 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-ink">Wall-size copies</h2>
        <p className="mt-1 text-sm text-ink/60">
          The 640px copy the memory wall renders. Photos taken before it existed fall
          back to the full-view copy — sharp, but about four times heavier than the
          tile needs.
        </p>
        <BackfillTilesButton pending={pendingTiles} />
      </section>

      {/* Local `Tile` RETIRED — it was one of the 22 hand-rolled stat tiles in
          the admin tree, and it could not render "unknown": it took a string, so
          a refused read reached it already formatted as "0.0%" / "0.00 GB".
          KpiStatCard takes `null` and renders an em-dash, which is the whole
          difference between "we measured nothing" and "there is nothing". */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiStatCard
          label="Real web-copy ratio"
          value={rows === null ? null : pct(portfolioRatio)}
          hint={`modelled ~8% · over ${measuredStills.toLocaleString()} stills`}
        />
        <KpiStatCard
          label="Events with data"
          value={perEvent === null ? null : perEvent.length}
          hint="target ≥ 50 to lock"
        />
        <KpiStatCard
          label="Total web copy hosted"
          value={rows === null ? null : gb(totalWebBytes)}
          hint="forever, on our R2"
        />
        <KpiStatCard
          label={`Events over ${DEFAULT_WEB_COPY_CEILING_GB} GB`}
          value={overCeiling}
          hint="should stay 0"
        />
      </section>

      {capped ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠ Readout capped at {ROW_CAP.toLocaleString()} rows/table — numbers are a
          lower bound. Add a SQL-aggregation RPC before this many captures exist.
        </p>
      ) : null}

      {eventNamesUnresolved ? (
        <p
          role="alert"
          className="rounded-md border border-warn-200/60 bg-warn-50/60 px-3 py-2 text-xs text-warn-900"
        >
          Event names could not be looked up, so the first column below reads as
          dashes. Every byte figure on this page is still measured and still
          true — only the names are missing.
        </p>
      ) : null}

      <ConsoleTable
        rows={perEvent}
        readPermitted
        readError={storageError}
        reads="the storage telemetry"
        label="Per-event storage"
        minWidth="52rem"
        rowKey={(e) => e.eventId}
        empty={{
          Icon: HardDrive,
          title: 'No measured captures yet',
          blurb:
            'Telemetry fills itself as new Papic photos are taken — every born-AVIF derivative records its byte size on the way in. Nothing to set up.',
        }}
        columns={[
          {
            header: 'Event',
            cell: (e) => <span className="block max-w-[16rem] truncate text-ink">{e.name}</span>,
          },
          {
            header: 'Captures',
            align: 'right',
            mono: true,
            cell: (e) => e.summary.captures.toLocaleString(),
          },
          {
            header: 'Stills',
            align: 'right',
            mono: true,
            hideBelow: 'md',
            cell: (e) => e.summary.measuredStills.toLocaleString(),
          },
          {
            header: 'Orig',
            align: 'right',
            mono: true,
            hideBelow: 'lg',
            cell: (e) => gb(e.summary.measuredOrigBytes),
          },
          {
            header: 'Web copy',
            align: 'right',
            mono: true,
            hideBelow: 'md',
            cell: (e) => `${e.summary.totalWebCopyGb.toFixed(2)} GB`,
          },
          {
            header: 'Ratio',
            align: 'right',
            mono: true,
            cell: (e) => (
              <span className={e.summary.overWebCopyCeiling ? 'font-semibold text-warn-900' : 'font-medium text-ink'}>
                {pct(e.summary.webCopyRatio)}
              </span>
            ),
          },
        ]}
      />

      <section className="space-y-3">
        <header className="flex items-center gap-2">
          <CloudOff className="h-5 w-5 text-ink/70" aria-hidden />
          <div>
            <h2 className="text-base font-semibold text-ink">Stranded Drive copies</h2>
            <p className="text-sm text-ink/70">
              Full-res originals that never reached the couple&rsquo;s Google Drive after{' '}
              {DRIVE_COPY_RETRY_CEILING}+ retries. The retry sweep has given up (no hot loop),
              and the full-res drop is deferring each one&rsquo;s raw indefinitely. Reconnect the
              couple&rsquo;s Drive or hand off the originals to clear them.
            </p>
          </div>
        </header>

        <ConsoleTable
          rows={stranded ? stranded.rows : null}
          readPermitted
          readError={stranded ? null : { message: 'The stranded-copies read threw.' }}
          reads="the stranded Drive copies"
          cap={STRANDED_LIMIT}
          label="Stranded Drive copies"
          minWidth="52rem"
          rowKey={(s, i) => `${s.eventId}-${i}`}
          empty={{
            Icon: CloudOff,
            title: 'None stranded',
            blurb:
              'Every Drive copy is landing, or is still inside its back-off retries. This is the state you want — nothing to do.',
          }}
          columns={[
            {
              header: 'Event',
              mono: true,
              cell: (s) => <span className="block max-w-[12rem] truncate text-ink/70">{s.eventId}</span>,
            },
            {
              header: 'Type',
              hideBelow: 'md',
              cell: (s) => <span className="text-ink/70">{s.artifactType}</span>,
            },
            {
              header: 'File',
              cell: (s) => <span className="block max-w-[12rem] truncate text-ink/70">{s.fileName}</span>,
            },
            {
              header: 'Attempts',
              align: 'right',
              mono: true,
              cell: (s) => s.attemptCount.toLocaleString(),
            },
            {
              header: 'Last error',
              hideBelow: 'lg',
              cell: (s) => (
                <span className="block max-w-[16rem] truncate text-xs text-ink/70">
                  {s.lastErrorText ?? '—'}
                </span>
              ),
            },
          ]}
        />
      </section>
    </div>
  );
}
