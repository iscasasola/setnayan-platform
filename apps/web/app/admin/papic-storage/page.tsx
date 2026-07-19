import { HardDrive } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  aggregateEventStorage,
  BYTES_PER_GB,
  DEFAULT_WEB_COPY_CEILING_GB,
  type StorageRow,
} from '@/lib/papic-storage-telemetry';

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
      .select('event_id, orig_bytes, display_bytes, thumb_bytes')
      .limit(ROW_CAP),
    admin
      .from('papic_guest_captures')
      .select('event_id, orig_bytes, display_bytes, thumb_bytes')
      .limit(ROW_CAP),
  ]);

  const rows: Row[] = [
    ...((photos.data as Row[] | null) ?? []),
    ...((guests.data as Row[] | null) ?? []),
  ];

  // Group by event.
  const byEvent = new Map<string, StorageRow[]>();
  for (const r of rows) {
    if (!r.event_id) continue;
    const list = byEvent.get(r.event_id) ?? [];
    list.push(r);
    byEvent.set(r.event_id, list);
  }

  // Event display names for the ones we have data for.
  const eventIds = [...byEvent.keys()];
  const nameById = new Map<string, string>();
  if (eventIds.length > 0) {
    const { data: evs } = await admin
      .from('events')
      .select('event_id, display_name')
      .in('event_id', eventIds);
    for (const e of evs ?? []) {
      nameById.set(e.event_id as string, (e.display_name as string | null) ?? '—');
    }
  }

  const perEvent = eventIds
    .map((id) => ({
      eventId: id,
      name: nameById.get(id) ?? '—',
      summary: aggregateEventStorage(byEvent.get(id) ?? []),
    }))
    .sort((a, b) => b.summary.totalWebCopyGb - a.summary.totalWebCopyGb);

  // Portfolio aggregate — the single "real 8%" number, weighted over every
  // measured still (not an average of per-event ratios, which small events skew).
  let totalMeasuredOrig = 0;
  let totalMeasuredStillWeb = 0;
  let totalWebBytes = 0;
  let measuredStills = 0;
  for (const r of rows) {
    const web = (r.display_bytes ?? 0) + (r.thumb_bytes ?? 0);
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
  const overCeiling = perEvent.filter((e) => e.summary.overWebCopyCeiling).length;
  const capped = rows.length >= ROW_CAP * 2;

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center gap-3">
        <HardDrive className="h-6 w-6 text-mulberry" aria-hidden />
        <div>
          <h1 className="text-lg font-semibold text-ink">Papic storage telemetry</h1>
          <p className="text-sm text-ink/60">
            The real web-copy ratio + per-event web-copy size, measured from actual
            captures. Watch these across the first ~50 Unli events to confirm the
            ₱15,000 Unli capture cap and the born-AVIF web-copy ratio hold up in the wild.
          </p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label="Real web-copy ratio"
          value={pct(portfolioRatio)}
          sub={`modelled ~8% · over ${measuredStills.toLocaleString()} stills`}
        />
        <Tile
          label="Events with data"
          value={perEvent.length.toLocaleString()}
          sub="target ≥ 50 to lock"
        />
        <Tile label="Total web copy hosted" value={gb(totalWebBytes)} sub="forever, on our R2" />
        <Tile
          label={`Events over ${DEFAULT_WEB_COPY_CEILING_GB} GB`}
          value={overCeiling.toLocaleString()}
          sub="should stay 0"
        />
      </section>

      {capped ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠ Readout capped at {ROW_CAP.toLocaleString()} rows/table — numbers are a
          lower bound. Add a SQL-aggregation RPC before this many captures exist.
        </p>
      ) : null}

      <section className="overflow-x-auto rounded-lg border border-ink/10">
        <table className="w-full text-sm">
          <thead className="bg-ink/[0.03] text-left text-xs text-ink/60">
            <tr>
              <th className="px-3 py-2 font-medium">Event</th>
              <th className="px-3 py-2 text-right font-medium">Captures</th>
              <th className="px-3 py-2 text-right font-medium">Stills</th>
              <th className="px-3 py-2 text-right font-medium">Orig</th>
              <th className="px-3 py-2 text-right font-medium">Web copy</th>
              <th className="px-3 py-2 text-right font-medium">Ratio</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/5">
            {perEvent.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-center text-ink/50" colSpan={6}>
                  No measured captures yet — telemetry populates as new Papic photos
                  are taken (born-AVIF derivatives record their byte sizes).
                </td>
              </tr>
            ) : (
              perEvent.map((e) => (
                <tr
                  key={e.eventId}
                  className={e.summary.overWebCopyCeiling ? 'bg-amber-50/60' : undefined}
                >
                  <td className="max-w-[16rem] truncate px-3 py-2 text-ink">{e.name}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink/70">
                    {e.summary.captures.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink/70">
                    {e.summary.measuredStills.toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink/70">
                    {gb(e.summary.measuredOrigBytes)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink/70">
                    {e.summary.totalWebCopyGb.toFixed(2)} GB
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium text-ink">
                    {pct(e.summary.webCopyRatio)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="sn-tile p-3">
      <p className="text-[11px] uppercase tracking-wide text-ink/50">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink">{value}</p>
      <p className="text-[11px] text-ink/55">{sub}</p>
    </div>
  );
}
